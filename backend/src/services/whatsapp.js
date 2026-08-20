import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  Browsers,
  makeCacheableSignalKeyStore,
} from '@whiskeysockets/baileys';
import pino from 'pino';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import config from '../config.js';
import { canonicalizePhone } from './folio.js';

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

// Último estado de entrega por JID (para diagnóstico)
const deliveryMap = new Map();

// Caché de resolución de JID real por número (5 min)
const jidCache = new Map();

const STATUS_NAMES = {
  0: 'pendiente',
  1: 'enviado-al-server',
  2: 'entregado',
  3: 'leido',
  4: 'reproducido',
  error: 'error',
};

function touch(fn) {
  try { fn(); } catch { /* noop */ }
}

export function getWhatsAppStatus() {
  return {
    connected: state.connected,
    connecting: state.connecting,
    hasQr: Boolean(state.qr),
    dryRun: config.dryRun,
    configured: true,
    userPhone: state.userPhone || '',
  };
}

export function getRawQr() {
  return state.qr;
}

// Último estado de entrega registrado para un JID (para el endpoint de prueba)
export function getLastDelivery(jid) {
  return deliveryMap.get(jid) || null;
}

// Consulta directa a WhatsApp: ¿el número está registrado en WhatsApp?
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
  let clean = String(number || '').replace(/\D/g, '');
  // En México (+52) los números móviles canónicos para E2EE son 52 + 10 dígitos (12 dígitos en total)
  if (clean.startsWith('521') && clean.length === 13) {
    clean = '52' + clean.slice(3);
  } else if (clean.length === 10) {
    clean = '52' + clean;
  }
  return clean;
}

export async function waitForDelivery(jids, timeoutMs = 6000) {
  const list = Array.isArray(jids) ? jids : [jids];
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    for (const j of list) {
      const entry = deliveryMap.get(j);
      if (entry && (entry.status === 2 || entry.status === 3 || entry.status === 4 || entry.receipt || entry.statusName === 'error')) {
        return { ...entry, jid: j };
      }
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  return { statusName: 'pendiente', status: 0, timedOut: true, error: '' };
}

// Store de mensajes enviados para responder a los retries de cifrado E2EE
const sentMessagesStore = new Map();

export async function startWhatsApp() {
  if (starting) return;
  starting = true;
  state.connecting = true;
  state.startedAt = state.startedAt || new Date().toISOString();

  try {
    const { state: authState, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
    const logger = pino({ level: config.baileysLogLevel || 'silent' });
    let version = [2, 3000, 1017531287];
    try {
      const v = await fetchLatestBaileysVersion();
      if (v?.version) version = v.version;
    } catch (e) {
      console.warn('[whatsapp] Usando versión fallback de WhatsApp:', e?.message || e);
    }

    sock = makeWASocket({
      version,
      auth: {
        creds: authState.creds,
        keys: makeCacheableSignalKeyStore(authState.keys, logger),
      },
      logger,
      browser: Browsers.macOS('Chrome'),
      syncFullHistory: false,
      markOnlineOnConnect: true,
      generateHighQualityLinkPreview: true,
      defaultQueryTimeoutMs: 60000,
      shouldIgnoreJid: (jid) => jid?.includes('@broadcast'),
      getMessage: async (key) => {
        if (key?.id && sentMessagesStore.has(key.id)) {
          const stored = sentMessagesStore.get(key.id);
          console.log(`[whatsapp] ✓ Retrying E2EE message for key ${key.id}`);
          return stored;
        }
        return { conversation: '' };
      }
    });

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

    // Diagnóstico de entrega: estado de cada mensaje enviado.
    sock.ev.on('messages.update', (updates) => {
      for (const u of updates || []) {
        const jid = u?.key?.remoteJid || 'desconocido';
        const status = u?.status ?? u?.update?.status;
        const err = u?.error ? (u.error?.message || String(u.error)) : '';
        const statusName = STATUS_NAMES[status] || (status === undefined ? 'ack' : status);
        const entry = { status, statusName, error: err, at: new Date().toISOString(), id: u?.key?.id || '' };
        deliveryMap.set(jid, entry);
        console.log(`[whatsapp] Entrega ${jid}: ${statusName}${err ? ' · error: ' + err : ''}`);
      }
    });

    // Acuses de entrega/lectura (llegan por el LID del destinatario)
    sock.ev.on('messages.receipt.update', (updates) => {
      for (const u of updates || []) {
        const jid = u?.key?.remoteJid || 'desconocido';
        const receipt = u?.receipt || {};
        const state = (receipt.read || receipt.readTimestamp) ? 'leido'
          : (receipt.delivered || receipt.deliveredTimestamp) ? 'entregado'
          : 'recibido';
        deliveryMap.set(jid, { statusName: state, status: 99, error: '', at: new Date().toISOString(), id: u?.key?.id || '', receipt: true });
        console.log(`[whatsapp] Receipt ${jid}: ${state}`);
      }
    });

    // ── Mensajes entrantes (corrobora Misión 1 y auto-responde con chiste) ──
    sock.ev.on('messages.upsert', async (mUpdate) => {
      try {
        const msgs = mUpdate?.messages || [];
        for (const msg of msgs) {
          if (!msg.message) continue;
          if (msg.key?.fromMe) continue;
          const remoteJid = msg.key?.remoteJid || '';
          if (!remoteJid || remoteJid.includes('@g.us')) continue; // ignora grupos

          const rawPhone = remoteJid.split('@')[0].split(':')[0];
          const text = msg.message?.conversation ||
            msg.message?.extendedTextMessage?.text ||
            msg.message?.imageMessage?.caption || '';

          registerIncomingMessage(rawPhone, text);

          const lower = String(text).toLowerCase();
          const isRifaIntent = lower.includes('sorteo') ||
            lower.includes('fenapo') ||
            lower.includes('wicho') ||
            lower.includes('beneficio') ||
            lower.includes('boleto') ||
            lower.includes('hola');

          if (isRifaIntent) {
            const jokes = [
              '— ¿Qué le dice un jardinero a otro? ¡Nos vemos cuando podamos! 😂🌱',
              '— ¿Qué hace una abeja en el gimnasio? ¡Zumba! 🐝🏋️',
              '— ¿Por qué los pájaros no usan Facebook? ¡Porque ya tienen Twitter! 🐦📱',
              '— ¿Cuál es el colmo de un electricista? ¡Que no le sigan la corriente! ⚡😄',
              '— ¿Qué le dice un semáforo a otro? ¡No me mires que me estoy cambiando! 🚦🤣',
            ];
            const randomJoke = jokes[Math.floor(Math.random() * jokes.length)];
            const autoReply = [
              `✨ *¡Hola! Soy el asistente de Wicho y Totalplay San Luis* 💜`,
              ``,
              `¡Confirmado! Tu mensaje ha sido recibido exitosamente para la *Misión 1 del Gran Sorteo FENAPO 2026* 🎁🎉`,
              ``,
              `Aquí tienes tu chiste de la buena suerte:`,
              `${randomJoke}`,
              ``,
              `👉 *Regresa ahora a la página de Beneficios Totalplay* para continuar con tu Misión 2 (Aprender con el tutorial) y registrar tu boleto. 🚀`,
              ``,
              `¡Mucho éxito! 🍀`,
            ].join('\n');

            await sendMessage(rawPhone, autoReply);
          }
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

// Envía un mensaje de texto a un número en formato internacional (52XXXXXXXXXX)
// Devuelve: { sent: boolean, dryRun: boolean, error?: string }
export async function sendMessage(to, text) {
  if (!state.connected) {
    if (config.dryRun) {
      console.log(`[whatsapp][dry-run] Mensaje para ${to}:\n${text}`);
      return { sent: false, dryRun: true };
    }
    return { sent: false, dryRun: false, error: 'WhatsApp no conectado' };
  }

  const target = await resolveJid(to);
  const jid = `${target}@s.whatsapp.net`;
  console.log(`[whatsapp] 🚀 Iniciando envío a ${jid} (canonical=${to}, conectado=${state.connected})`);
  try {
    try {
      await sock.presenceSubscribe(jid);
      await sock.sendPresenceUpdate('composing', jid);
      await new Promise(r => setTimeout(r, 200));
    } catch (e) {
      console.warn('[whatsapp] Warning presencia:', e?.message || e);
    }

    const sent = await sock.sendMessage(jid, { text });
    if (sent?.key?.id && sent?.message) {
      sentMessagesStore.set(sent.key.id, sent.message);
      console.log(`[whatsapp] ✓ Mensaje enviado y cacheado en store para retries (ID: ${sent.key.id})`);
    }

    try {
      await sock.sendPresenceUpdate('paused', jid);
    } catch {}

    return { sent: true, dryRun: false, jid, messageId: sent?.key?.id };
  } catch (err) {
    console.error('[whatsapp] ❌ Error al enviar:', err?.message || err);
    return { sent: false, dryRun: false, error: String(err?.message || err), jid };
  }
}

// Cierra la sesión activa, borra la base de datos de credenciales/claves de Baileys
// y reinicia el servicio para generar un nuevo código QR limpio.
import fs from 'node:fs';
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
