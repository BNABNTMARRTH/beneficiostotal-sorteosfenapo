import { Router } from 'express';
import config, { sheetsConfigured } from '../config.js';
import { canonicalizePhone, generateFolio } from '../services/folio.js';
import * as otp from '../services/otp.js';
import * as sheets from '../services/sheets.js';
import * as whatsapp from '../services/whatsapp.js';

const router = Router();

// ── 1. Enviar código OTP por WhatsApp ─────────────────────
router.post('/enviar-codigo', async (req, res) => {
  const { whatsapp: rawWhatsapp } = req.body || {};

  if (!rawWhatsapp) {
    return res.status(400).json({ error: 'Escribe tu número de WhatsApp.' });
  }

  const whatsappNumber = canonicalizePhone(rawWhatsapp);
  if (!whatsappNumber) {
    return res.status(400).json({ error: 'Número de WhatsApp inválido. Usa 10 dígitos (ej. 4441234567).' });
  }

  // Anti-duplicado: si ya está registrado, avisamos y devolvemos su folio
  try {
    const existing = await sheets.findRegistroByWhatsapp(whatsappNumber);
    if (existing) {
      return res.json({
        yaRegistrado: true,
        folio: existing.folio || '',
        nombre: existing.nombre || '',
        fecha: existing.fecha || '',
      });
    }
  } catch (err) {
    console.error('[enviar-codigo] Error al verificar duplicado:', err?.message || err);
    if (sheetsConfigured()) {
      return res.status(500).json({ error: 'No pudimos validar tu registro. Intenta de nuevo en unos segundos.' });
    }
  }

  if (otp.inResendCooldown(whatsappNumber)) {
    return res.status(429).json({
      error: 'Espera un momento para pedir otro código.',
      seconds: otp.secondsUntilResend(whatsappNumber),
    });
  }

  // En modo dry-run usamos el código demo 000000 (para desarrollo/pruebas)
  const code = config.dryRun ? config.demoOtpCode : otp.generateOtp(whatsappNumber);
  if (config.dryRun) {
    otp.generateOtp(whatsappNumber); // crea la entrada
    otp.overrideOtpCode(whatsappNumber, config.demoOtpCode);
  }

  const message = [
    `Tu codigo para participar en el *SORTEO TOTAL FENAPO 2026* es:`,
    ``,
    `*${code}*`,
    ``,
    `Ingresalo en la pagina para generar tu boleto. Valido por 10 minutos.`,
    ``,
    `Si no solicitaste este codigo, ignora este mensaje.`,
  ].join('\n');

  console.log(`[enviar-codigo] Enviando OTP a ${whatsappNumber} (code=${code}, dryRun=${config.dryRun})`);
  const result = await whatsapp.sendMessage(whatsappNumber, message);
  console.log(`[enviar-codigo] Resultado: sent=${result.sent}, dryRun=${result.dryRun}, error=${result.error || 'ninguno'}`);

  if (!result.sent && !result.dryRun) {
    return res.status(502).json({
      error: 'No pudimos enviar el codigo. Verifica que el numero tenga WhatsApp activo.',
    });
  }

  return res.json({
    ok: true,
    dryRun: result.dryRun,
    seconds: 60,
  });
});

// ── 2. Registrar (valida OTP → folio → sheet → WhatsApp) ──
router.post('/registro', async (req, res) => {
  const {
    nombre: rawNombre,
    esCliente,
    cuenta,
    whatsapp: rawWhatsapp,
    email,
    otp: otpCode,
    origen,
  } = req.body || {};

  const whatsappNumber = canonicalizePhone(rawWhatsapp);
  if (!whatsappNumber) {
    return res.status(400).json({ error: 'Número de WhatsApp inválido.' });
  }

  const nombre = String(rawNombre || '').trim();
  if (!nombre) {
    return res.status(400).json({ error: 'Escribe tu nombre completo.' });
  }

  const esClienteTotal = esCliente === 'si' || esCliente === 'true' || esCliente === true;
  const cuentaValue = String(cuenta || '').trim();
  if (esClienteTotal && !/^\d{6,20}$/.test(cuentaValue)) {
    return res.status(400).json({ error: 'Escribe un número de cuenta válido.' });
  }

  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim())) {
    return res.status(400).json({ error: 'Escribe un correo válido o déjalo vacío.' });
  }

  const verified = otp.verifyOtp(whatsappNumber, otpCode);
  if (!verified.ok) {
    const reasons = {
      expired: 'El código expiró. Solicita uno nuevo.',
      too_many: 'Demasiados intentos. Solicita un código nuevo.',
      invalid: 'Código incorrecto. Revísalo e intenta de nuevo.',
    };
    return res.status(400).json({ error: reasons[verified.reason] || 'Código inválido.' });
  }

  // Anti-duplicado final (por si acaso entre OTP y registro)
  let existing = null;
  try {
    existing = await sheets.findRegistroByWhatsapp(whatsappNumber);
  } catch { /* continúa con el registro */ }
  if (existing) {
    return res.json({
      yaRegistrado: true,
      folio: existing.folio || '',
      nombre: existing.nombre || '',
      fecha: existing.fecha || '',
    });
  }

  // Folio único (con reintentos contra el sheet si está configurado)
  let folio = generateFolio();
  try {
    const existingFolios = await sheets.getExistingFolios();
    for (let i = 0; i < 5; i++) {
      if (!existingFolios.has(folio)) break;
      folio = generateFolio();
    }
  } catch { /* sin sheet: el folio aleatorio es suficiente */ }

  const cuentaColumna = esClienteTotal ? cuentaValue : 'No es cliente';

  let escritoEnSheet = false;
  try {
    escritoEnSheet = await sheets.appendRegistro({
      folio,
      nombre,
      cuenta: cuentaColumna,
      whatsapp: whatsappNumber,
      email: String(email || '').trim(),
      origen: String(origen || 'Landing Index'),
      enviado: 'NO',
    });
  } catch (err) {
    console.error('[registro] Error al escribir en el sheet:', err?.message || err);
    if (sheetsConfigured()) {
      return res.status(500).json({ error: 'No pudimos guardar tu registro. Intenta de nuevo.' });
    }
  }

  // Mensaje de confirmación con folio + boleto digital
  const ticketUrl = `${config.frontendUrl}/index.html?ticket=${encodeURIComponent(folio)}`;
  const message = [
    `🎉 *¡FELICIDADES ${nombre}!*`,
    ``,
    `Tu participación en el *SORTEO TOTAL FENAPO 2026* está confirmada. 🎫`,
    ``,
    `*Tu folio:* ${folio}`,
    `*Participante:* ${nombre}`,
    `*Premio:* ${config.premio}`,
    `*Sorteo:* ${config.fechaSorteo || 'Próximamente'}`,
    ``,
    `🔗 Tu boleto digital: ${ticketUrl}`,
    ``,
    `*Guarda este mensaje.* Tu folio es tu boleto. ¡Mucha suerte! 🍀`,
  ].join('\n');

  const result = await whatsapp.sendMessage(whatsappNumber, message);
  if (result.sent) {
    try { await sheets.markSent(folio); } catch { /* noop */ }
  }

  return res.json({
    ok: true,
    folio,
    nombre,
    premio: config.premio,
    fechaSorteo: config.fechaSorteo,
    ticketUrl,
    dryRun: result.dryRun,
  });
});

// ── Config para el frontend ───────────────────────────────
router.get('/config', (req, res) => {
  res.json({
    premio: config.premio,
    fechaSorteo: config.fechaSorteo,
    folioFormato: 'TPF2026-XXXXXX',
    dryRun: config.dryRun,
    videos: {
      anuncio: 'assets/rifa/video_anuncio.mp4',
      celebracion: 'assets/rifa/video_celebracion.mp4',
    },
  });
});

router.get('/health', (req, res) => {
  res.json({
    ok: true,
    whatsapp: whatsapp.getWhatsAppStatus(),
    sheets: sheets.isConfigured(),
  });
});

// ── Consulta pública de un registro (saludo VIP del frontend) ──
router.get('/registro/consulta', async (req, res) => {
  const whatsappNumber = canonicalizePhone(String(req.query.whatsapp || ''));
  if (!whatsappNumber) {
    return res.status(400).json({ ok: false, error: 'Falta un WhatsApp válido.' });
  }

  try {
    const found = await sheets.findRegistroByWhatsapp(whatsappNumber);
    if (!found || !found.folio) {
      return res.json({ ok: true, exists: false });
    }
    return res.json({ ok: true, exists: true, folio: found.folio, nombre: found.nombre, fecha: found.fecha });
  } catch (err) {
    console.error('[registro/consulta] Error al buscar:', err?.message || err);
    return res.status(502).json({ ok: false, error: err?.message || 'Error al consultar' });
  }
});

router.get('/whatsapp/status', (req, res) => {
  res.json(whatsapp.getWhatsAppStatus());
});

// ── Prueba rápida de entrega de WhatsApp ──────────────────
router.post('/whatsapp/test', async (req, res) => {
  const { whatsapp: rawWhatsapp } = req.body || {};
  const numero = canonicalizePhone(rawWhatsapp);
  if (!numero) {
    return res.status(400).json({ error: 'Número inválido. Usa 10 dígitos (ej. 4441234567).' });
  }

  const jid = `${numero}@s.whatsapp.net`;
  const texto = `🧪 Mensaje de prueba del SORTEO TOTAL FENAPO 2026.\nSi recibes esto, el envío de WhatsApp funciona correctamente.`;

  const status = whatsapp.getWhatsAppStatus();
  if (!status.connected && !status.dryRun) {
    return res.json({ ok: false, sent: false, error: 'WhatsApp no conectado.' });
  }
  if (status.dryRun) {
    return res.json({ ok: true, sent: false, dryRun: true, error: 'En modo demo no se envía.' });
  }

  const result = await whatsapp.sendMessage(numero, texto);
  const onWa = await whatsapp.checkOnWhatsApp(numero);
  const watchedJids = [result.jid || jid];
  if (onWa?.lid) watchedJids.push(`${onWa.lid}`);
  const delivery = await whatsapp.waitForDelivery(watchedJids, 6000);

  console.log(`[whatsapp/test] ${numero} → sent=${result.sent}, jid=${result.jid}, delivery=${delivery?.statusName}, error=${delivery?.error || result.error || 'ninguno'}, onWhatsApp=${onWa?.exists}`);

  return res.json({
    ok: true,
    sent: result.sent,
    delivery: delivery?.statusName || 'sin-estado',
    status: delivery?.status,
    error: delivery?.error || result.error || null,
    timedOut: Boolean(delivery?.timedOut),
    onWhatsApp: onWa,
  });
});

router.get('/whatsapp/qr', (req, res) => {
  const status = whatsapp.getWhatsAppStatus();
  const wantImg = String(req.query.format || '') === 'img';
  const qr = whatsapp.getRawQr();
  const qrUrl = qr ? `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qr)}` : '';

  if (wantImg) {
    // Uso dentro de <img>: redirige a la imagen del QR (o 204 si aún no hay / ya conectó).
    if (!status.connected && qr) return res.redirect(302, qrUrl);
    return res.status(204).end();
  }

  if (status.connected) {
    return res.send(`
      <html>
        <head>
          <title>WhatsApp Conectado</title>
          <style>
            body { font-family: sans-serif; text-align: center; padding: 50px; background: #f8f9fa; }
            .container { background: white; padding: 30px; border-radius: 12px; display: inline-block; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
            h2 { color: #10B981; }
            p { color: #666; font-size: 16px; }
            .btn { background: #8B5CF6; color: white; padding: 10px 20px; border-radius: 8px; text-decoration: none; display: inline-block; margin-top: 15px; }
          </style>
        </head>
        <body>
          <div class="container">
            <h2>¡WhatsApp Conectado! ✅</h2>
            <p>El servicio de mensajes de validación está en línea y funcionando.</p>
            <a href="${config.frontendUrl}" class="btn">Ir a la Web</a>
          </div>
        </body>
      </html>
    `);
  }
  if (!qr) {
    return res.send(`
      <html>
        <head>
          <title>Generando QR...</title>
          <meta http-equiv="refresh" content="3">
          <style>
            body { font-family: sans-serif; text-align: center; padding: 50px; background: #f8f9fa; }
            .container { background: white; padding: 30px; border-radius: 12px; display: inline-block; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
            h2 { color: #8B5CF6; }
            p { color: #666; }
          </style>
        </head>
        <body>
          <div class="container">
            <h2>Generando código QR... 🔄</h2>
            <p>Por favor, espera unos segundos. La página se recargará automáticamente.</p>
          </div>
        </body>
      </html>
    `);
  }
  res.send(`
    <html>
      <head>
        <title>Conectar WhatsApp</title>
        <style>
          body { font-family: sans-serif; text-align: center; padding: 50px; background: #f8f9fa; }
          .container { background: white; padding: 30px; border-radius: 12px; display: inline-block; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
          h2 { color: #8B5CF6; }
          img { margin: 20px; border: 1px solid #ddd; padding: 10px; border-radius: 8px; }
          p { color: #666; font-size: 14px; }
        </style>
        <script>
          setInterval(async () => {
            try {
              const res = await fetch('/api/health');
              const data = await res.json();
              if (data.whatsapp && data.whatsapp.connected) {
                window.location.reload();
              }
            } catch (e) {}
          }, 3000);
        </script>
      </head>
      <body>
        <div class="container">
          <h2>Conecta tu WhatsApp</h2>
          <p>Escanea el código QR desde tu celular (WhatsApp > Dispositivos vinculados > Vincular un dispositivo).</p>
          <img src="${qrUrl}" alt="QR Code" />
          <p>El sistema se actualizará automáticamente una vez que completes el escaneo.</p>
        </div>
      </body>
    </html>
  `);
});

// ── Webhook opcional (Apps Script: registros manuales) ────
router.post('/webhook/sheets', async (req, res) => {
  if (!config.webhookSecret) {
    return res.status(404).json({ error: 'Webhook no habilitado.' });
  }
  const provided = req.headers['x-webhook-secret'] || req.body?.secret;
  if (provided !== config.webhookSecret) {
    return res.status(401).json({ error: 'Secreto inválido.' });
  }

  const { nombre, whatsapp: rawWhatsapp, folio: rawFolio, cuenta } = req.body || {};
  const whatsappNumber = canonicalizePhone(rawWhatsapp);
  if (!whatsappNumber || !String(nombre || '').trim()) {
    return res.status(400).json({ error: 'Faltan datos.' });
  }

  const folio = String(rawFolio || '').trim() || generateFolio();
  const ticketUrl = `${config.frontendUrl}/index.html?ticket=${encodeURIComponent(folio)}`;
  const message = [
    `🎉 *¡FELICIDADES ${nombre}!*`,
    ``,
    `Tu participación en el *SORTEO TOTAL FENAPO 2026* está confirmada. 🎫`,
    ``,
    `*Tu folio:* ${folio}`,
    `🔗 Tu boleto digital: ${ticketUrl}`,
    ``,
    `*Guarda este mensaje.* ¡Mucha suerte! 🍀`,
  ].join('\n');

  const result = await whatsapp.sendMessage(whatsappNumber, message);
  return res.json({ ok: true, folio, dryRun: result.dryRun });
});

// ── Guardar likes de eventos ──────────────────────────────
router.post('/eventos/like', async (req, res) => {
  const { id } = req.body || {};
  if (!id) {
    return res.status(400).json({ error: 'Falta el ID del evento.' });
  }

  try {
    const newLikes = await sheets.incrementEventLike(id);
    return res.json({ ok: true, id, likes: newLikes });
  } catch (err) {
    console.error('[eventos/like] Error al incrementar likes:', err?.message || err);
    return res.status(500).json({ error: 'No se pudo guardar el like en Google Sheets.' });
  }
});

export default router;
