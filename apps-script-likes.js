const SHEET_NAME = 'Eventos'; // Nombre exacto de tu hoja

/**
 * Maneja peticiones GET (útil para probar desde el navegador)
 */
function doGet(e) {
  return ContentService
    .createTextOutput(JSON.stringify({ status: 'ok', message: 'Totalplay Likes API activa ✓' }))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Maneja peticiones POST — recibe { id: 'evento-001' }
 * y suma +1 al contador de likes del evento correspondiente.
 */
function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const eventoId = body.id;

    if (!eventoId) {
      return jsonResponse({ ok: false, error: 'Falta el campo id' });
    }

    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
    const data = sheet.getDataRange().getValues();
    const headers = data[0];

    let idCol = headers.indexOf('id');
    const likesCol = headers.indexOf('likes');

    // CORRECCIÓN: Si la primera columna no se llama "id" (está vacía o tiene espacios),
    // tomamos la columna A (índice 0) por defecto, que es donde están los IDs de eventos.
    if (idCol === -1) {
      idCol = 0;
    }

    if (idCol === -1 || likesCol === -1) {
      return jsonResponse({ ok: false, error: 'Columnas id o likes no encontradas en el sheet' });
    }

    // Buscar la fila del evento
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][idCol]).trim() === String(eventoId).trim()) {
        const current = parseInt(data[i][likesCol]) || 0;
        const newCount = current + 1;

        // Escribir el nuevo valor
        sheet.getRange(i + 1, likesCol + 1).setValue(newCount);

        return jsonResponse({ ok: true, id: eventoId, likes: newCount });
      }
    }

    return jsonResponse({ ok: false, error: `Evento "${eventoId}" no encontrado` });

  } catch (err) {
    return jsonResponse({ ok: false, error: err.message });
  }
}

/** Helper para responder JSON con CORS */
function jsonResponse(data) {
  const output = ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
  return output;
}
