import config from '../config.js';

// ── BuilderBot Cloud (BBC) — envío de mensajes vía API REST ──
// Se usa como canal alterno/confiable cuando Baileys no confirma
// entrega al dispositivo. Los mensajes salen por el bot de BBC.

const BBC_URL = 'https://app.builderbot.cloud/api/v2';

export function bbcConfigured() {
  return Boolean(config.bbcProjectId && config.bbcApiKey);
}

// Normaliza a E.164 sin "+": 52XXXXXXXXXX (BBC lo requiere así).
function toBbcNumber(phone) {
  let clean = String(phone || '').replace(/[^0-9]/g, '');
  if (!clean) return '';
  if (clean.length === 10) clean = `52${clean}`;
  return clean;
}

// Envía un mensaje de texto por WhatsApp usando la API de BBC Cloud.
// Devuelve: { sent, delivered, error?, raw? }
export async function sendViaBBC(phone, text) {
  if (!bbcConfigured()) {
    return { sent: false, delivered: false, error: 'BBC no configurado (falta projectId o apiKey)' };
  }
  const number = toBbcNumber(phone);
  if (!number || number.length < 12) {
    return { sent: false, delivered: false, error: `Número inválido para BBC: ${phone}` };
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30000);
    const res = await fetch(`${BBC_URL}/${config.bbcProjectId}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-builderbot': config.bbcApiKey,
      },
      body: JSON.stringify({
        messages: { content: String(text || '') },
        number,
        checkIfExists: false,
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);

    const rawText = await res.text();
    let raw = null;
    try { raw = JSON.parse(rawText); } catch { /* respuesta no JSON */ }

    if (!res.ok) {
      const msg = raw?.error || raw?.message || `HTTP ${res.status}`;
      console.error(`[bbc] Error ${res.status} al enviar a ${number}: ${msg}`);
      return { sent: false, delivered: false, error: String(msg), raw };
    }

    // La API responde { number, message, waited } cuando acepta el envío.
    const accepted = Boolean(raw && (raw.number === number || raw.waited !== undefined));
    console.log(`[bbc] Enviado a ${number} (aceptado=${accepted}, waited=${raw?.waited})`);
    return {
      sent: accepted,
      delivered: accepted, // BBC confirma el envío saliente por su propio canal
      error: accepted ? undefined : 'Respuesta inesperada de BBC',
      raw,
    };
  } catch (err) {
    const msg = err?.name === 'AbortError' ? 'Timeout de BBC (30s)' : String(err?.message || err);
    console.error('[bbc] Error al enviar:', msg);
    return { sent: false, delivered: false, error: msg };
  }
}
