import config from '../config.js';
import { generateOtpCode } from './folio.js';

// Almacenamiento en memoria: clave = whatsapp canonicalizado
const store = new Map();

export function generateOtp(whatsapp) {
  const code = generateOtpCode();
  store.set(whatsapp, {
    code,
    expiresAt: Date.now() + config.otpTtlMs,
    attempts: 0,
    lastSentAt: Date.now(),
  });
  return code;
}

export function inResendCooldown(whatsapp) {
  const entry = store.get(whatsapp);
  if (!entry) return false;
  return Date.now() - entry.lastSentAt < config.otpResendCooldownMs;
}

export function secondsUntilResend(whatsapp) {
  const entry = store.get(whatsapp);
  if (!entry) return 0;
  const remaining = config.otpResendCooldownMs - (Date.now() - entry.lastSentAt);
  return remaining > 0 ? Math.ceil(remaining / 1000) : 0;
}

export function overrideOtpCode(whatsapp, code) {
  const entry = store.get(whatsapp);
  if (!entry) return;
  entry.code = code;
}

export function getStoredOtp(whatsapp) {
  const entry = store.get(whatsapp);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    store.delete(whatsapp);
    return null;
  }
  return entry;
}

// Devuelve { ok: true } o { ok: false, reason }
export function verifyOtp(whatsapp, code) {
  const entry = store.get(whatsapp);
  if (!entry) return { ok: false, reason: 'expired' };
  if (Date.now() > entry.expiresAt) {
    store.delete(whatsapp);
    return { ok: false, reason: 'expired' };
  }
  if (entry.attempts >= config.otpMaxAttempts) {
    store.delete(whatsapp);
    return { ok: false, reason: 'too_many' };
  }
  const normalized = String(code || '').trim();
  if (entry.code !== normalized) {
    entry.attempts += 1;
    return { ok: false, reason: 'invalid' };
  }
  store.delete(whatsapp);
  return { ok: true };
}

export function allowDemoOtp() {
  return config.dryRun;
}
