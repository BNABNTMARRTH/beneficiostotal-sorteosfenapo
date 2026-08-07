import crypto from 'node:crypto';

// Sin caracteres confusos (sin 0/O, 1/I)
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function randomCode(length = 6) {
  const bytes = crypto.randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i++) {
    out += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return out;
}

export function generateFolio() {
  return `TPF2026-${randomCode(6)}`;
}

export function generateOtpCode() {
  return String(crypto.randomInt(0, 1000000)).padStart(6, '0');
}

// Normaliza un número de teléfono MX a 12 dígitos con lada 52.
// Acepta 10 dígitos (1234567890) o 12 (521234567890).
export function canonicalizePhone(raw) {
  const digits = String(raw || '').replace(/\D/g, '');
  if (digits.length === 10) return `52${digits}`;
  if (digits.length === 12 && digits.startsWith('52')) return digits;
  return '';
}
