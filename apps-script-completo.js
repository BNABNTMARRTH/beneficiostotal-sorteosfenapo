// =========================================================================
//  CÓDIGO UNIFICADO PARA GOOGLE APPS SCRIPT
//  (Integra Tutoriales, Registros de Eventos y Likes de Eventos)
// =========================================================================
//
// INSTRUCCIONES DE REEMPLAZO:
// 1. En tu Google Sheet, ve a: Extensiones -> Apps Script.
// 2. Para evitar duplicaciones, crea un solo archivo (ej. Código.gs) y borra
//    los demás archivos .gs secundarios que creaste (tutoriales.gs, registros.gs).
// 3. Pega este código unificado completo en tu único archivo Código.gs.
// 4. Guarda e implementa una "Nueva versión" del script.
// 5. Usa la URL obtenida para las tres constantes en tu frontend:
//    - TUTORIALS_API_URL (en index.html)
//    - APPS_SCRIPT_URL (en calendario.html)
//    - REGISTROS_SCRIPT_URL (en calendario.html)
//
// =========================================================================

const SPREADSHEET_ID = '12L1OaLFvxlUw4ecKKxsQgHicb5x6jn5GfS4jxFhhcmk';

const SHEETS = {
  tutoriales: 'Tutoriales',
  asesorias: 'Solicitudes_Asesoria',
  sugerencias: 'Sugerencias',
  likes: 'Likes_Tutoriales',
  registros: 'Registros',
  eventos: 'Eventos',
  sorteo: 'SORTEO TOTAL FENAPO2026'
};

/**
 * Maneja peticiones GET
 */
function doGet(e) {
  const action = (e.parameter.action || '').toLowerCase();

  try {
    if (action === 'tutoriales') {
      return jsonResponse({
        ok: true,
        data: getTutoriales(),
      });
    }

    if (action === 'likes') {
      return jsonResponse({
        ok: true,
        data: getTutorialLikes(),
      });
    }

    if (action === 'get_existing_folios') {
      const sheet = getOrCreateSheet_(SHEETS.sorteo, ['Fecha', 'Folio', 'Nombre', 'Cuenta', 'WhatsApp', 'Email', 'Origen', 'Enviado']);
      const data = sheet.getDataRange().getValues();
      const folios = [];
      for (let i = 1; i < data.length; i++) {
        if (data[i][1]) {
          folios.push(String(data[i][1]));
        }
      }
      return jsonResponse({ ok: true, data: folios });
    }

    if (action === 'find_registro') {
      const whatsappParam = String(e.parameter.whatsapp || '').replace(/\D/g, '');
      if (!whatsappParam) {
        return jsonResponse({ ok: false, error: 'Falta parámetro whatsapp' });
      }
      const sheet = getOrCreateSheet_(SHEETS.sorteo, ['Fecha', 'Folio', 'Nombre', 'Cuenta', 'WhatsApp', 'Email', 'Origen', 'Enviado']);
      const data = sheet.getDataRange().getValues();
      for (let i = 1; i < data.length; i++) {
        const w = String(data[i][4] || '').replace(/\D/g, '');
        if (w === whatsappParam) {
          return jsonResponse({
            ok: true,
            data: {
              fecha: data[i][0] ? Utilities.formatDate(new Date(data[i][0]), Session.getScriptTimeZone(), 'yyyy-MM-dd') : '',
              folio: data[i][1] || '',
              nombre: data[i][2] || '',
              cuenta: data[i][3] || '',
              whatsapp: data[i][4] || '',
              email: data[i][5] || '',
              origen: data[i][6] || '',
              enviado: data[i][7] || 'NO'
            }
          });
        }
      }
      return jsonResponse({ ok: true, data: null });
    }

    if (action === 'get_all_registros') {
      const sheet = getOrCreateSheet_(SHEETS.sorteo, ['Fecha', 'Folio', 'Nombre', 'Cuenta', 'WhatsApp', 'Email', 'Origen', 'Enviado']);
      const data = sheet.getDataRange().getValues();
      const list = [];
      for (let i = 1; i < data.length; i++) {
        list.push({
          fecha: data[i][0] ? Utilities.formatDate(new Date(data[i][0]), Session.getScriptTimeZone(), 'yyyy-MM-dd') : '',
          folio: data[i][1] || '',
          nombre: data[i][2] || '',
          cuenta: data[i][3] || '',
          whatsapp: data[i][4] || '',
          email: data[i][5] || '',
          origen: data[i][6] || '',
          enviado: data[i][7] || 'NO'
        });
      }
      return jsonResponse({ ok: true, data: list });
    }

    return jsonResponse({
      ok: true,
      message: 'API Unificada de Totalplay activa ✓',
      version: '1.3.0',
      actions: ['tutoriales', 'likes', 'get_existing_folios', 'find_registro', 'get_all_registros']
    });
  } catch (err) {
    return jsonResponse({
      ok: false,
      error: err.message,
    });
  }
}

/**
 * Maneja peticiones POST unificadas
 */
function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    // Esperar hasta 30 segundos a que se libere cualquier escritura previa
    lock.waitLock(30000);

    if (!e || !e.postData || !e.postData.contents) {
      return jsonResponse({ ok: false, error: 'No se recibieron datos' });
    }

    let payload = {};
    try {
      payload = JSON.parse(e.postData.contents || '{}');
    } catch (err) {
      payload = e.parameter || {};
    }

    // 1. Detección por campo "action" (Tutoriales: Asesoría, Sugerencia, Like de tutorial)
    const action = (payload.action || '').toLowerCase();
    if (action === 'asesoria') {
      saveAsesoria(payload);
      return jsonResponse({ ok: true, message: 'Asesoría registrada' });
    }
    if (action === 'sugerencia') {
      saveSugerencia(payload);
      return jsonResponse({ ok: true, message: 'Sugerencia registrada' });
    }
    if (action === 'like') {
      const result = addTutorialLike(payload.tutorialId);
      return jsonResponse({ ok: true, data: result });
    }

    if (action === 'append_registro') {
      const sheet = getOrCreateSheet_(SHEETS.sorteo, ['Fecha', 'Folio', 'Nombre', 'Cuenta', 'WhatsApp', 'Email', 'Origen', 'Enviado']);
      const row = [
        new Date(),
        payload.folio || '',
        payload.nombre || '',
        payload.cuenta || '',
        payload.whatsapp || '',
        payload.email || '',
        payload.origen || '',
        payload.enviado || 'NO'
      ];
      sheet.appendRow(row);
      return jsonResponse({ ok: true, message: 'Registro guardado exitosamente' });
    }

    if (action === 'mark_sent') {
      const folioParam = String(payload.folio || '').trim();
      if (!folioParam) {
        return jsonResponse({ ok: false, error: 'Falta parámetro folio' });
      }
      const sheet = getOrCreateSheet_(SHEETS.sorteo, ['Fecha', 'Folio', 'Nombre', 'Cuenta', 'WhatsApp', 'Email', 'Origen', 'Enviado']);
      const data = sheet.getDataRange().getValues();
      for (let i = 1; i < data.length; i++) {
        if (String(data[i][1]).trim() === folioParam) {
          sheet.getRange(i + 1, 8).setValue('SÍ');
          return jsonResponse({ ok: true, message: 'Folio marcado como enviado ✓' });
        }
      }
      return jsonResponse({ ok: false, error: 'Folio no encontrado' });
    }

    // 2. Detección de Registro de Participación en Eventos del Calendario
    // (Tiene campos como "evento", "nombre" y "whatsapp")
    if (payload.evento && payload.nombre && payload.whatsapp) {
      const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEETS.registros);
      if (!sheet) {
        return jsonResponse({ ok: false, error: 'La hoja "Registros" no existe' });
      }
      const row = [
        new Date(),
        payload.evento || '',
        payload.nombre || '',
        payload.whatsapp || '',
        payload.email || '',
        payload.esCliente ? 'SÍ' : 'NO',
        payload.cuenta || 'N/A',
        payload.autoriza ? 'ACEPTÓ' : 'NO ACEPTÓ'
      ];
      sheet.appendRow(row);
      return jsonResponse({ ok: true, message: 'Registro guardado exitosamente' });
    }

    // 3. Detección de Like de Evento del Calendario
    // (Tiene campo "id" correspondiente al ID del evento)
    if (payload.id) {
      const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEETS.eventos);
      if (!sheet) {
        return jsonResponse({ ok: false, error: 'La hoja "Eventos" no existe' });
      }
      const data = sheet.getDataRange().getValues();
      const headers = data[0];
      
      let idCol = headers.indexOf('id');
      const likesCol = headers.indexOf('likes');

      if (idCol === -1) {
        idCol = 0; // Columna A por defecto
      }

      if (idCol === -1 || likesCol === -1) {
        return jsonResponse({ ok: false, error: 'Columnas id o likes no encontradas en la hoja Eventos' });
      }

      for (let i = 1; i < data.length; i++) {
        if (String(data[i][idCol]).trim() === String(payload.id).trim()) {
          const current = parseInt(data[i][likesCol]) || 0;
          const newCount = current + 1;

          // Escribir el nuevo valor
          sheet.getRange(i + 1, likesCol + 1).setValue(newCount);

          return jsonResponse({ ok: true, id: payload.id, likes: newCount });
        }
      }
      return jsonResponse({ ok: false, error: 'Evento "' + payload.id + '" no encontrado' });
    }

    return jsonResponse({ ok: false, error: 'Petición no reconocida o campos incompletos' });

  } catch (err) {
    return jsonResponse({ ok: false, error: err.message });
  } finally {
    // Liberar siempre el bloqueo
    lock.releaseLock();
  }
}

// ── MÉTODOS DE SOPORTE PARA TUTORIALES ─────────────────────────────────────

function getTutoriales() {
  const sheet = getOrCreateSheet_(SHEETS.tutoriales, [
    'ID',
    'Titulo',
    'Plataforma',
    'Categoria',
    'Descripcion',
    'LinkTikTok',
    'Thumbnail',
    'Duracion',
    'Orden',
    'Activo',
    'Destacado',
  ]);

  const rows = sheet.getDataRange().getValues();
  const headers = rows.shift();

  return rows
    .map(rowToObject_(headers))
    .filter(item => String(item.Activo || '').toUpperCase() === 'SI')
    .sort((a, b) => Number(a.Orden || 9999) - Number(b.Orden || 9999));
}

function getTutorialLikes() {
  const sheet = getOrCreateSheet_(SHEETS.likes, [
    'TutorialID',
    'Likes',
    'UltimaActualizacion',
  ]);

  const rows = sheet.getDataRange().getValues();
  const headers = rows.shift();

  return rows.map(rowToObject_(headers));
}

function saveAsesoria(payload) {
  const sheet = getOrCreateSheet_(SHEETS.asesorias, [
    'Fecha',
    'Nombre',
    'Telefono',
    'Tema',
    'Duda',
    'TutorialID',
    'TutorialTitulo',
    'Origen',
    'Estado',
  ]);

  sheet.appendRow([
    new Date(),
    payload.nombre || '',
    payload.telefono || '',
    payload.tema || '',
    payload.duda || '',
    payload.tutorialId || '',
    payload.tutorialTitulo || '',
    payload.origen || 'Landing Index v3',
    'Pendiente',
  ]);
}

function saveSugerencia(payload) {
  const sheet = getOrCreateSheet_(SHEETS.sugerencias, [
    'Fecha',
    'TemaSugerido',
    'Plataforma',
    'Comentario',
    'Origen',
    'Estado',
  ]);

  sheet.appendRow([
    new Date(),
    payload.temaSugerido || '',
    payload.plataforma || '',
    payload.comentario || '',
    payload.origen || 'Landing Index v3',
    'Nueva',
  ]);
}

function addTutorialLike(tutorialId) {
  if (!tutorialId) {
    throw new Error('tutorialId requerido');
  }

  const sheet = getOrCreateSheet_(SHEETS.likes, [
    'TutorialID',
    'Likes',
    'UltimaActualizacion',
  ]);

  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(tutorialId)) {
      const currentLikes = Number(data[i][1] || 0) + 1;
      sheet.getRange(i + 1, 2).setValue(currentLikes);
      sheet.getRange(i + 1, 3).setValue(new Date());

      return {
        tutorialId,
        likes: currentLikes,
      };
    }
  }

  sheet.appendRow([tutorialId, 1, new Date()]);

  return {
    tutorialId,
    likes: 1,
  };
}

function getOrCreateSheet_(name, headers) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName(name);

  if (!sheet) {
    sheet = ss.insertSheet(name);
  }

  const firstRow = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
  const hasHeaders = firstRow.some(value => value);

  if (!hasHeaders) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
  }

  return sheet;
}

function rowToObject_(headers) {
  return function(row) {
    const obj = {};

    headers.forEach((header, index) => {
      obj[header] = row[index];
    });

    return obj;
  };
}

function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
