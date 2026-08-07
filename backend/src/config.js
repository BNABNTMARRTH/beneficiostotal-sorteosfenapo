import 'dotenv/config';
import fs from 'node:fs';

const env = process.env;

const config = {
  port: Number(env.PORT || 3001),
  frontendUrl: env.FRONTEND_URL || 'http://localhost:8000',
  spreadsheetId: env.SPREADSHEET_ID || '12L1OaLFvxlUw4ecKKxsQgHicb5x6jn5GfS4jxFhhcmk',
  sheetName: env.SHEET_NAME || 'SORTEO TOTAL FENAPO2026',
  eventsSheetName: env.EVENTS_SHEET_NAME || 'Eventos',
  googleServiceAccountJson: (env.GOOGLE_SERVICE_ACCOUNT_JSON || '').trim(),
  appsScriptUrl: env.APPS_SCRIPT_URL || 'https://script.google.com/macros/s/AKfycbzClO4Osk8YeTJZi_tAIHOAUMZqK7nGVosZVVUmebYpc8roBCPwJzwGBZNrNqxUEJSqAA/exec',
  whatsappNumber: env.WHATSAPP_NUMBER || '',
  dryRun: env.DRY_RUN !== 'false',
  premio: env.PREMIO || 'A definir',
  fechaSorteo: env.FECHA_SORTEO || '',
  webhookSecret: env.WEBHOOK_SECRET || '',
  baileysLogLevel: env.BAILEYS_LOG_LEVEL || 'silent',
  otpTtlMs: 10 * 60 * 1000,
  otpMaxAttempts: 5,
  otpResendCooldownMs: 60 * 1000,
  demoOtpCode: '000000',
};

export function sheetsConfigured() {
  return Boolean(config.appsScriptUrl);
}

export default config;
