import config, { sheetsConfigured } from '../config.js';

export function isConfigured() {
  return sheetsConfigured();
}

// ── 1. Registrar en el sheet (vía Apps Script) ──
export async function appendRegistro({ folio, nombre, cuenta, whatsapp, email, origen, enviado }) {
  if (!isConfigured()) {
    console.log(`[demo] Fila simulada -> ${JSON.stringify({ folio, nombre, cuenta, whatsapp, email, origen, enviado })}`);
    return false;
  }

  try {
    const res = await fetch(config.appsScriptUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'append_registro',
        folio,
        nombre,
        cuenta,
        whatsapp,
        email,
        origen,
        enviado: enviado || 'NO'
      })
    });
    const data = await res.json();
    return data.ok === true;
  } catch (err) {
    console.error('[sheets] Error al escribir en Google Sheets (Apps Script):', err?.message || err);
    return false;
  }
}

// ── 2. Buscar un registro por WhatsApp (vía Apps Script) ──
export async function findRegistroByWhatsapp(whatsapp) {
  if (!isConfigured()) return null;

  try {
    const url = `${config.appsScriptUrl}?action=find_registro&whatsapp=${encodeURIComponent(whatsapp)}`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.ok && data.data) {
      return {
        fecha: data.data.fecha || '',
        folio: data.data.folio || '',
        nombre: data.data.nombre || '',
        cuenta: data.data.cuenta || '',
        email: data.data.email || '',
      };
    }
  } catch (err) {
    console.error('[sheets] Error al buscar registro en Google Sheets (Apps Script):', err?.message || err);
  }
  return null;
}

// ── 3. Obtener todos los folios existentes (vía Apps Script) ──
export async function getExistingFolios() {
  if (!isConfigured()) return new Set();

  try {
    const url = `${config.appsScriptUrl}?action=get_existing_folios`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.ok && Array.isArray(data.data)) {
      return new Set(data.data.map(f => String(f).trim()).filter(Boolean));
    }
  } catch (err) {
    console.error('[sheets] Error al obtener folios de Google Sheets (Apps Script):', err?.message || err);
  }
  return new Set();
}

// ── 4. Marcar la fila de un folio como enviada por WhatsApp (vía Apps Script) ──
export async function markSent(folio) {
  if (!isConfigured()) return;

  try {
    await fetch(config.appsScriptUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'mark_sent',
        folio
      })
    });
  } catch (err) {
    console.error('[sheets] Error al marcar folio como enviado en Google Sheets (Apps Script):', err?.message || err);
  }
}

// ── 5. Incrementar en 1 los likes de un evento (vía Apps Script) ──
export async function incrementEventLike(eventId) {
  if (!isConfigured()) {
    console.log(`[demo] Like simulado para evento -> ${eventId}`);
    return null;
  }

  try {
    const res = await fetch(config.appsScriptUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: eventId
      })
    });
    const data = await res.json();
    if (data.ok) {
      return data.likes;
    }
  } catch (err) {
    console.error('[sheets] Error al incrementar likes del evento en Google Sheets (Apps Script):', err?.message || err);
  }
  return null;
}
