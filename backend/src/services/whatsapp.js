import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  Browsers,
  makeCacheableSignalKeyStore,
} from '@whiskeysockets/baileys';
import pino from 'pino';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import config from '../config.js';
import { canonicalizePhone } from './folio.js';
import { sendViaBBC, bbcConfigured } from './bbc.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const AUTH_DIR = path.resolve(__dirname, '../../data/baileys-auth');

let sock = null;
let state = {
  connected: false,
  connecting: false,
  qr: '',
  lastError: '',
  startedAt: null,
  userPhone: '',
};
let starting = false;

// Registro de mensajes entrantes de usuarios (para corroborar la Misión 1)
const incomingMessagesMap = new Map();

export function registerIncomingMessage(fromNumber, text = '') {
  const clean = canonicalizePhone(fromNumber);
  if (clean) {
    incomingMessagesMap.set(clean, {
      text,
      at: Date.now(),
      date: new Date().toISOString(),
    });
    console.log(`[whatsapp] ✓ Mensaje entrante registrado de ${clean}: "${String(text).slice(0, 60)}"`);
  }
}

export function hasUserSentMessage(phone) {
  const clean = canonicalizePhone(phone);
  if (!clean) return false;
  return incomingMessagesMap.has(clean);
}

// ── Seguimiento de entrega de mensajes salientes ─────────
const deliveryMap = new Map(); // messageId → entry
const deliveryByJid = new Map(); // jid → entry

const jidCache = new Map(); // 5 min

// Almacén de mensajes enviados: Baileys pide el contenido original en los
// retries/re-cifrados E2EE (getMessage). Guardamos el texto completo.
const sentMessagesStore = new Map();

// IMPORTANTE: el status 2 (SERVER_ACK) solo significa que el servidor de
// WhatsApp aceptó el mensaje. NO confirma que llegó al dispositivo destino.
// La entrega real al dispositivo es status 3 (leído), 4 (reproducido) o un
// receipt.update con delivered/readTimestamp.
const STATUS_NAMES = {
  0: 'error',
  1: 'pendiente',
  2: 'enviado-al-servidor',
  3: 'leido',
  4: 'reproducido',
};

function touch(fn) {
  try { fn(); } catch { /* noop */ }
}

function isDeviceDelivered(entry) {
  if (!entry) return false;
  return entry.status === 3 || entry.status === 4 || entry.receipt === true;
}

function recordDelivery(u) {
  const id = u?.key?.id;
  const jid = u?.key?.remoteJid || 'desconocido';
  const status = u?.status ?? u?.update?.status;
  const err = u?.error ? (u.error?.message || String(u.error)) : '';
  const statusName = STATUS_NAMES[status] || (status === undefined ? 'ack' : status);
  const entry = { status, statusName, error: err, at: new Date().toISOString(), id: id || '', jid };
  if (id) deliveryMap.set(id, entry);
  if (jid && id) deliveryByJid.set(jid, entry);
  if (statusName !== 'pendiente') {
    console.log(`[whatsapp] Entrega ${jid} id=${id || '?'}: ${statusName}${err ? ' · error: ' + err : ''}`);
  }
}

function recordReceipt(u) {
  const id = u?.key?.id;
  const jid = u?.key?.remoteJid || 'desconocido';
  const receipt = u?.receipt || {};
  const estado = (receipt.read || receipt.readTimestamp) ? 'leido'
    : (receipt.delivered || receipt.deliveredTimestamp) ? 'entregado-al-dispositivo'
      : 'recibido';
  const entry = { statusName: estado, status: 99, error: '', at: new Date().toISOString(), id: id || '', jid, receipt: true };
  if (id) deliveryMap.set(id, entry);
  if (jid && id) deliveryByJid.set(jid, entry);
  console.log(`[whatsapp] Receipt ${jid} id=${id || '?'}: ${estado}`);
}

// Polling del estado de un mensaje por su id.
function waitForMessage(id, timeoutMs) {
  return new Promise((resolve) => {
    const started = Date.now();
    const timer = setInterval(() => {
      const entry = deliveryMap.get(id);
      if (entry && (entry.status === 2 || entry.status === 3 || entry.status === 4 || entry.receipt || entry.statusName === 'error')) {
        clearInterval(timer);
        return resolve({ ...entry, deliveredToDevice: isDeviceDelivered(entry) });
      }
      if (Date.now() - started >= timeoutMs) {
        clearInterval(timer);
        const e = deliveryMap.get(id);
        const st = e?.statusName || 'pendiente';
        return resolve({ ...(e || {}), statusName: st, deliveredToDevice: isDeviceDelivered(e) });
      }
    }, 250);
  });
}

export function getWhatsAppStatus() {
  return {
    connected: state.connected,
    connecting: state.connecting,
    hasQr: Boolean(state.qr),
    dryRun: config.dryRun,
    configured: true,
    userPhone: state.userPhone || '',
    outbound: config.whatsappOutbound || 'bbc',
    bbc: bbcConfigured(),
  };
}

export function getRawQr() {
  return state.qr;
}

export function getLastDelivery(jid) {
  return deliveryByJid.get(jid) || null;
}

export async function checkOnWhatsApp(number) {
  if (!sock) return { exists: null, error: 'Sin sesión' };
  try {
    const res = await sock.onWhatsApp(`${number}@s.whatsapp.net`);
    const found = Array.isArray(res) ? res[0] : res;
    console.log(`[whatsapp] onWhatsApp ${number}: ${JSON.stringify(res)}`);
    return { exists: Boolean(found?.exists), jid: found?.jid || '', lid: found?.lid || '' };
  } catch (err) {
    console.error('[whatsapp] Error en onWhatsApp:', err?.message || err);
    return { exists: null, error: String(err?.message || err) };
  }
}

async function resolveJid(number) {
  const cached = jidCache.get(number);
  if (cached && Date.now() - cached.at < 5 * 60 * 1000) return cached.info;

  let info = { jid: number, lid: '', exists: null };
  try {
    const res = await sock.onWhatsApp(`${number}@s.whatsapp.net`);
    const found = Array.isArray(res) ? res[0] : res;
    if (found?.jid) info.jid = String(found.jid).split('@')[0];
    if (found?.lid) info.lid = String(found.lid);
    info.exists = Boolean(found?.exists);
  } catch { /* usa el número canónico */ }

  jidCache.set(number, { info, at: Date.now() });
  if (info.jid !== number) {
    console.log(`[whatsapp] JID resuelto: ${number} → ${info.jid} (exists=${info.exists}, lid=${info.lid ? 'sí' : 'no'})`);
  }
  return info;
}

// Elimina las sesiones E2EE (Signal) que Baileys guarda por contacto para forzar
// que el siguiente envío establezca una sesión nueva desde cero.
// Baileys 6.7.x guarda las sesiones como session-<jid>.json en la raíz de baileys-auth.
function clearContactSessions(pn, lid) {
  if (!fs.existsSync(AUTH_DIR)) return 0;
  const bases = [String(pn || '').split('@')[0], String(lid || '').split('@')[0]].filter(Boolean);
  if (!bases.length) return 0;
  let removed = 0;
  for (const f of fs.readdirSync(AUTH_DIR)) {
    if (f.startsWith('session-') && bases.some((b) => f.includes(b))) {
      try { fs.unlinkSync(path.join(AUTH_DIR, f)); removed++; } catch { /* noop */ }
    }
  }
  return removed;
}

export async function startWhatsApp() {
  if (starting) return;
  starting = true;
  state.connecting = true;
  state.startedAt = state.startedAt || new Date().toISOString();

  try {
    const { state: authState, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
    const logger = pino({ level: config.baileysLogLevel || 'silent' });

    const socketOpts = {
      auth: {
        creds: authState.creds,
        keys: makeCacheableSignalKeyStore(authState.keys, logger),
      },
      logger,
      browser: Browsers.macOS('Chrome'),
      syncFullHistory: false,
      // Hostinger tiene latencia alta hacia los servidores de WhatsApp: las queries
      // de inicialización (fetchProps/app-state) pueden tardar. Damos margen amplio.
      defaultQueryTimeoutMs: 180000,
      markOnlineOnConnect: false,
      shouldIgnoreJid: (jid) => jid?.includes('@broadcast'),
      getMessage: async (key) => {
        const cached = key?.id ? sentMessagesStore.get(key.id) : null;
        if (cached) return cached;
        return { conversation: '' };
      },
    };

    if (config.whatsappVersion) {
      socketOpts.version = config.whatsappVersion;
      console.log(`[whatsapp] Versión de WhatsApp fijada: ${config.whatsappVersion.join('.')}`);
    }

    sock = makeWASocket(socketOpts);

    touch(() => sock.ev.on('creds.update', saveCreds));

    sock.ev.on('connection.update', (update) => {
      const { connection, lastDisconnect, qr } = update || {};
      if (qr) state.qr = qr;
      if (connection === 'connecting') state.connecting = true;
      if (connection === 'open') {
        state.connected = true;
        state.connecting = false;
        state.qr = '';
        state.lastError = '';
        const userJid = sock?.user?.id;
        if (userJid) {
          state.userPhone = userJid.split('@')[0].split(':')[0];
        }
        console.log('[whatsapp] Sesión de WhatsApp conectada.');
        // En Hostinger las queries de inicialización (fetchProps/count de prekeys)
        // a veces tardan o se caen, y si no se suben las prekeys del dispositivo
        // ningún destinatario puede establecer sesión E2EE con nosotros. Forzamos
        // la subida directa (sin consultar primero el conteo).
        setTimeout(async () => {
          try {
            if (sock?.uploadPreKeys) {
              await sock.uploadPreKeys();
              console.log('[whatsapp] Prekeys subidas al servidor correctamente.');
            }
          } catch (err) {
            console.error('[whatsapp] Error al subir prekeys:', err?.message || err);
          }
        }, 5000);
      }
      if (connection === 'close') {
        state.connected = false;
        state.connecting = false;
        state.userPhone = '';
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        if (statusCode !== DisconnectReason.loggedOut) {
          const errMsg = lastDisconnect?.error?.message || 'desconexión';
          state.lastError = errMsg;
          console.log(`[whatsapp] Desconectado (${errMsg}). Reconectando...`);
          setTimeout(() => { starting = false; startWhatsApp(); }, 4000);
        } else {
          console.log('[whatsapp] Sesión cerrada (logged out). Escanea el QR para reconectar.');
        }
      }
    });

    sock.ev.on('messages.update', (updates) => {
      for (const u of updates || []) recordDelivery(u);
    });

    sock.ev.on('messages.receipt.update', (updates) => {
      for (const u of updates || []) recordReceipt(u);
    });

    // ── Mensajes entrantes ──
    // Solo se registran (para corroborar la Misión 1). El número 4447110396 ya
    // tiene su asistente de IA vinculado que responde; aquí NO se auto-responde.
    sock.ev.on('messages.upsert', (mUpdate) => {
      try {
        const msgs = mUpdate?.messages || [];
        for (const msg of msgs) {
          if (!msg.message) continue;
          if (msg.key?.fromMe) continue;
          const remoteJid = msg.key?.remoteJid || '';
          if (!remoteJid || remoteJid.includes('@g.us')) continue;

          const rawPhone = remoteJid.split('@')[0].split(':')[0];
          const text = msg.message?.conversation ||
            msg.message?.extendedTextMessage?.text ||
            msg.message?.imageMessage?.caption || '';

          registerIncomingMessage(rawPhone, text);
        }
      } catch (err) {
        console.error('[whatsapp] Error procesando messages.upsert:', err?.message || err);
      }
    });
  } catch (err) {
    state.lastError = String(err?.message || err);
    console.error('[whatsapp] Error al iniciar:', err);
    starting = false;
  }
}

// Envía un mensaje de texto a un número en formato internacional (52XXXXXXXXXX).
// Opciones: { waitMs, checkOnWhatsApp, retryFreshSession }
// Devuelve: { sent, delivered, deliveredToDevice, delivery, error?, jid?, messageId?, retriedViaLid?, exists? }
//  - delivered / deliveredToDevice = true SOLO cuando el dispositivo destino confirma.
//  - delivery = estado real ('enviado-al-servidor' ≠ 'leido'/'entregado-al-dispositivo').
export async function sendMessage(to, text, opts = {}) {
  const { waitMs = 0, checkOnWhatsApp = false, retryFreshSession = true, device = '' } = opts || {};

  if (config.dryRun) {
    console.log(`[whatsapp][dry-run] Mensaje para ${to}:\n${text}`);
    return { sent: false, dryRun: true };
  }

  // ── Canal de salida ──
  // 'bbc'     → SOLO BuilderBot Cloud (canal confiable; Baileys no se usa para enviar)
  // 'auto'    → Baileys primero, BBC como respaldo si no confirma el dispositivo
  // 'baileys' → solo Baileys (sin respaldo)
  const outbound = config.whatsappOutbound || 'bbc';

  if (outbound === 'bbc') {
    if (!bbcConfigured()) {
      return { sent: false, dryRun: false, error: 'WHATSAPP_OUTBOUND=bbc pero faltan BBC_PROJECT_ID/BBC_API_KEY', via: 'bbc' };
    }
    console.log(`[whatsapp] Enviando por BBC → ${to}`);
    const bbcResult = await sendViaBBC(to, text);
    if (bbcResult.sent) {
      return { sent: true, dryRun: false, delivered: true, deliveredToDevice: true, delivery: 'entregado-via-bbc', via: 'bbc' };
    }
    console.error(`[whatsapp] BBC falló para ${to}: ${bbcResult.error || 'desconocido'}`);
    return { sent: false, dryRun: false, delivery: 'error', via: 'bbc', error: `BBC: ${bbcResult.error || 'fallo desconocido'}` };
  }

  if (!state.connected) {
    // Modo auto: sin sesión de Baileys, intentamos por BBC.
    if (outbound === 'auto' && bbcConfigured()) {
      console.log(`[whatsapp] Baileys desconectado → enviando por BBC (${to})`);
      const bbcResult = await sendViaBBC(to, text);
      if (bbcResult.sent) {
        return { sent: true, dryRun: false, delivered: true, deliveredToDevice: true, delivery: 'entregado-via-bbc', via: 'bbc' };
      }
      return { sent: false, dryRun: false, error: `WhatsApp no conectado y BBC falló: ${bbcResult.error || 'desconocido'}`, via: 'ninguno' };
    }
    return { sent: false, dryRun: false, error: 'WhatsApp no conectado' };
  }

  const info = await resolveJid(to);

  if (info.exists === false && checkOnWhatsApp) {
    return {
      sent: false,
      dryRun: false,
      error: 'El número no está registrado en WhatsApp. Verifícalo e intenta de nuevo.',
      exists: false,
      jid: info.jid,
    };
  }

  const pnJid = `${info.jid}@s.whatsapp.net`;
  const lidJid = info.lid ? String(info.lid) : '';
  const via = config.whatsappVia;

  // Si se indica un device concreto (ej. "3"), dirigimos el envío a esa
  // instancia concreta del contacto (521XXXXXXXXXX:3@...).
  const devSuffix = device ? `:${device}` : '';
  const pnJidDev = `${info.jid}${devSuffix}@s.whatsapp.net`;
  const lidJidDev = info.lid ? `${String(info.lid).replace('@lid', `${devSuffix}@lid`)}` : '';

  // auto / lid: prioriza el LID (la entrega real fluye por el LID del destinatario).
  // pn: solo al número canónico (521XXXXXXXXXX@s.whatsapp.net).
  let primaryJid, secondaryJid;
  if (device) {
    primaryJid = lidJidDev || pnJidDev;
    secondaryJid = lidJidDev ? pnJidDev : '';
  } else if (via === 'pn') {
    primaryJid = pnJid;
    secondaryJid = '';
  } else {
    primaryJid = lidJid || pnJid;
    secondaryJid = lidJid ? pnJid : '';
  }

  // Plan de intentos: 1) JID principal · 2) mismo JID con sesión E2EE limpia
  // (fuerza re-establecer sesión con el contacto) · 3) JID alterno con sesión limpia.
  const plan = [];
  if (primaryJid) plan.push({ jid: primaryJid, clear: false });
  if (retryFreshSession && primaryJid) plan.push({ jid: primaryJid, clear: true });
  if (secondaryJid && secondaryJid !== primaryJid) plan.push({ jid: secondaryJid, clear: true });

  const attemptSend = async (jid, clear) => {
    if (clear) {
      const cleared = clearContactSessions(info.jid, info.lid);
      console.log(`[whatsapp] Reintento con sesión E2EE limpia (${cleared} archivos) → ${jid}`);
    }
    console.log(`[whatsapp] Enviando a ${jid} (canonical=${to}, conectado=${state.connected}, via=${jid === lidJid ? 'LID' : 'PN'})`);
    const sent = await sock.sendMessage(jid, { text });
    const messageId = sent?.key?.id || '';
    if (messageId) {
      sentMessagesStore.set(messageId, sent?.message || { conversation: text });
    }
    if (!messageId || waitMs <= 0) {
      return { messageId, jid, statusName: 'enviado', deliveredToDevice: false, error: '' };
    }
    const delivery = await waitForMessage(messageId, waitMs);
    return { messageId, jid, ...delivery, error: delivery?.error || '' };
  };

  let last = null;
  let usedJid = primaryJid;
  let messageId = '';

  for (const step of plan) {
    try {
      last = await attemptSend(step.jid, step.clear);
      usedJid = step.jid;
      messageId = last.messageId;
    } catch (err) {
      console.error(`[whatsapp] Error al enviar a ${step.jid}:`, err?.message || err);
      last = { statusName: 'error', deliveredToDevice: false, error: String(err?.message || err), messageId: '' };
      usedJid = step.jid;
    }
    if (last.deliveredToDevice) break;
  }

  const deliveryName = last?.statusName || 'pendiente';
  const deliveredToDevice = Boolean(last?.deliveredToDevice);
  const serverAck = deliveredToDevice || deliveryName === 'enviado-al-servidor' || deliveryName === 'leido' || deliveryName === 'reproducido';

  if (!serverAck && last?.error) {
    return { sent: false, dryRun: false, error: last.error, jid: usedJid };
  }

  // ── Fallback a BuilderBot Cloud (BBC, solo en modo 'auto') ──
  // Si Baileys aceptó el mensaje pero el dispositivo destino no confirma
  // entrega, reenviamos por la API de BBC (canal confiable) para garantizar
  // que el usuario reciba su OTP / confirmación de registro.
  let canal = 'baileys';
  let bbcResult = null;
  if (!deliveredToDevice && outbound === 'auto' && bbcConfigured()) {
    console.log(`[whatsapp] Sin confirmación de dispositivo vía Baileys → reintentando por BBC (${to})`);
    bbcResult = await sendViaBBC(to, text);
    if (bbcResult.sent) {
      canal = 'bbc';
      return {
        sent: true,
        dryRun: false,
        jid: usedJid,
        messageId,
        delivered: true,
        deliveredToDevice: true,
        delivery: 'entregado-via-bbc',
        via: canal,
        retriedViaLid: usedJid === lidJid,
      };
    }
    // BBC también falló: seguimos con el resultado de Baileys y anexamos el error.
    return {
      sent: Boolean(serverAck) || Boolean(last?.messageId),
      dryRun: false,
      jid: usedJid,
      messageId,
      delivered: deliveredToDevice,
      deliveredToDevice,
      delivery: deliveryName,
      via: canal,
      bbcError: bbcResult.error || '',
      retriedViaLid: usedJid === lidJid,
      error: deliveredToDevice
        ? undefined
        : `Baileys: ${deliveryName}. BBC: ${bbcResult.error || 'fallo desconocido'}`,
    };
  }

  return {
    sent: Boolean(serverAck) || Boolean(last?.messageId),
    dryRun: false,
    jid: usedJid,
    messageId,
    delivered: deliveredToDevice,
    deliveredToDevice,
    delivery: deliveryName,
    via,
    retriedViaLid: usedJid === lidJid,
    error: deliveredToDevice
      ? undefined
      : (deliveryName === 'enviado-al-servidor'
          ? 'Mensaje aceptado por WhatsApp pero sin confirmación de entrega al dispositivo'
          : 'Sin confirmación de entrega del dispositivo'),
  };
}

export async function logoutAndClearWhatsApp() {
  state.connected = false;
  state.connecting = false;
  state.qr = '';
  state.userPhone = '';

  if (sock) {
    try {
      await sock.logout();
    } catch (err) {
      console.warn('[whatsapp] Error al hacer logout en socket:', err?.message || err);
      try {
        sock.end(err);
      } catch {}
    }
    sock = null;
  }

  try {
    if (fs.existsSync(AUTH_DIR)) {
      fs.rmSync(AUTH_DIR, { recursive: true, force: true });
      console.log('[whatsapp] Directorio de sesión baileys-auth eliminado para reseteo completo.');
    }
  } catch (err) {
    console.error('[whatsapp] Error al eliminar carpeta de credenciales:', err);
  }

  starting = false;
  startWhatsApp();
}