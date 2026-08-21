import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const env = process.env;

const config = {
  port: Number(String(env.PORT || 3001).trim()),
  frontendUrl: String(env.FRONTEND_URL || 'https://beneficiostotal.com').trim(),
  spreadsheetId: String(env.SPREADSHEET_ID || '12L1OaLFvxlUw4ecKKxsQgHicb5x6jn5GfS4jxFhhcmk').trim(),
  sheetName: String(env.SHEET_NAME || 'SORTEO TOTAL FENAPO2026').trim(),
  eventsSheetName: String(env.EVENTS_SHEET_NAME || 'Eventos').trim(),
  googleServiceAccountJson: String(env.GOOGLE_SERVICE_ACCOUNT_JSON || '').trim(),
  appsScriptUrl: String(env.APPS_SCRIPT_URL || 'https://script.google.com/macros/s/AKfycbzClO4Osk8YeTJZi_tAIHOAUMZqK7nGVosZVVUmebYpc8roBCPwJzwGBZNrNqxUEJSqAA/exec').trim(),
  whatsappNumber: String(env.WHATSAPP_NUMBER || '').trim(),
  // Cómo enviar: 'auto' = LID con fallback a PN · 'lid' = solo LID · 'pn' = solo PN
  whatsappVia: String(env.WHATSAPP_VIA || 'auto').trim().toLowerCase(),
  // Canal de SALIDA de mensajes:
  //   'bbc'     = solo BuilderBot Cloud (canal confiable; Baileys no envía)
  //   'auto'    = Baileys primero, BBC como respaldo
  //   'baileys' = solo Baileys
  whatsappOutbound: String(env.WHATSAPP_OUTBOUND || 'bbc').trim().toLowerCase(),
  // Versión de WhatsApp a usar (ej. "2,3000,1043857760"). Vacío = usar la interna de Baileys.
  whatsappVersion: (() => {
    const raw = String(env.WHATSAPP_VERSION || '').trim();
    if (!raw) return null;
    const parts = raw.split(',').map((p) => Number(p.trim()));
    if (parts.length >= 2 && parts.every((n) => Number.isFinite(n))) return parts;
    console.warn('[config] WHATSAPP_VERSION inválida, usando la versión interna de Baileys.');
    return null;
  })(),
  dryRun: String(env.DRY_RUN || '').trim().toLowerCase() === 'true',
  premio: String(env.PREMIO || 'Se dará a conocer durante el sorteo').trim(),
  fechaSorteo: String(env.FECHA_SORTEO || 'Todos los días hasta agotar los premios').trim(),
  webhookSecret: String(env.WEBHOOK_SECRET || '').trim(),
  baileysLogLevel: env.BAILEYS_LOG_LEVEL || 'silent',
  // BuilderBot Cloud (BBC): canal alterno de envío por API REST. Si Baileys
  // no confirma entrega al dispositivo, se reintenta por BBC automáticamente.
  bbcProjectId: String(env.BBC_PROJECT_ID || '').trim(),
  bbcApiKey: String(env.BBC_API_KEY || '').trim(),
  otpTtlMs: 10 * 60 * 1000,
  otpMaxAttempts: 5,
  otpResendCooldownMs: 60 * 1000,
  demoOtpCode: '000000',
};

export function sheetsConfigured() {
  return Boolean(config.appsScriptUrl);
}

export default config;
