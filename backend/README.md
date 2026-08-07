# Backend — SORTEO TOTAL FENAPO 2026

Backend separado para la rifa de Totalplay San Luis. Recibe el registro del formulario,
valida el número por **OTP por WhatsApp**, genera un **FOLIO único**, guarda la fila en
Google Sheets (pestaña `SORTEO TOTAL FENAPO2026`) y envía por WhatsApp la confirmación
con el folio y el boleto digital.

## Requisitos
- Node.js ≥ 20
- npm

## Instalación y arranque

```bash
cd backend
npm install
cp .env.example .env   # edita el .env (ver abajo)
npm run dev            # o npm start
```

El backend queda en `http://localhost:3001`. El frontend estático se sirve aparte
(por ejemplo `python3 -m http.server 8000` en `public_html/`).

## Configuración (`backend/.env`)

| Variable | Qué es |
|---|---|
| `PORT` | Puerto del backend (3001) |
| `FRONTEND_URL` | URL del frontend (CORS + links del boleto), ej. `http://localhost:8000` |
| `SPREADSHEET_ID` | ID del spreadsheet (ya viene el de eventos) |
| `SHEET_NAME` | Nombre exacto de la pestaña, ej. `SORTEO TOTAL FENAPO2026` |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Ruta al JSON de la cuenta de servicio. **Vacío = MODO DEMO** (no escribe en el sheet) |
| `WHATSAPP_NUMBER` | (informativo) número que usa Baileys |
| `DRY_RUN` | `true` = simula WhatsApp (imprime en consola) y acepta OTP `000000`. `false` = requiere sesión real |
| `PREMIO` / `FECHA_SORTEO` | Premio y fecha del sorteo para el boleto / countdown |
| `WEBHOOK_SECRET` | (opcional) secreto del webhook para Apps Script |

## Google Sheets (cuenta de servicio)

1. Ve a https://console.cloud.google.com/ → crea un proyecto (o usa uno existente).
2. Activa **Google Sheets API**.
3. **IAM y administración → Cuentas de servicio** → crear cuenta de servicio → crea una clave JSON y descárgala.
4. En el spreadsheet de eventos: **Compartir** → agrega el correo de la cuenta de servicio
   (termina en `gserviceaccount.com`) con permiso de **Editor**.
5. Pon la ruta al JSON en `GOOGLE_SERVICE_ACCOUNT_JSON`.

> Importante: la pestaña `SORTEO TOTAL FENAPO2026` debe existir con encabezados:
> `Fecha | Folio | Nombre | Cuenta | WhatsApp | Email | Origen | EnviadoWhatsApp`

## WhatsApp (Baileys)

- La primera vez, el backend imprime un **QR** en la terminal (también en `GET /api/whatsapp/status`).
  Escanéalo con el WhatsApp del celular que enviará los mensajes.
- La sesión se guarda en `backend/data/baileys-auth/` (no la subas a git).
- Se reconecta automáticamente. Si el celular se apaga, deja de enviar.
- ⚠️ Baileys es una librería **no oficial** de WhatsApp. Usa un número dedicado
  y ten presente el riesgo de bloqueo.

## Endpoints

| Método | Ruta | Función |
|---|---|---|
| POST | `/api/enviar-codigo` | `{ whatsapp }` → anti-duplicado + envía OTP |
| POST | `/api/registro` | `{ nombre, esCliente, cuenta?, whatsapp, email?, otp, origen? }` → valida OTP, folio, sheet, WhatsApp |
| GET | `/api/config` | Premio, fecha, formato de folio, videos |
| GET | `/api/health` | Estado del server, WhatsApp y Sheets |
| GET | `/api/whatsapp/status` | Conexión + QR |
| POST | `/api/webhook/sheets` | (opcional) avisa por WhatsApp cuando un registro manual llega al sheet. Header `x-webhook-secret` |

## Prueba rápida (modo demo)

```bash
curl -X POST http://localhost:3001/api/enviar-codigo \
  -H 'Content-Type: application/json' \
  -d '{"whatsapp":"4441234567"}'
# → { ok: true, dryRun: true, seconds: 60 }

curl -X POST http://localhost:3001/api/registro \
  -H 'Content-Type: application/json' \
  -d '{"nombre":"Juan Pérez","esCliente":"si","cuenta":"123456789","whatsapp":"4441234567","otp":"000000"}'
# → { ok: true, folio: "TPF2026-XXXXXX", ... }
```

Con el mismo WhatsApp otra vez, `enviar-codigo` devuelve `{ yaRegistrado: true, folio, nombre }`.
