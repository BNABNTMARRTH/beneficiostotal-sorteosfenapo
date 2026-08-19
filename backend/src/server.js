import express from 'express';
import cors from 'cors';
import config from './config.js';
import { fileURLToPath } from 'url';
import path from 'path';
import registroRouter from './routes/registro.js';
import adminRouter from './routes/admin.js';
import { startWhatsApp } from './services/whatsapp.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use(express.static(path.join(__dirname, '../../public_html')));

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    const allowed = [
      config.frontendUrl,
      'http://localhost:8000',
      'http://127.0.0.1:8000',
      'http://localhost:5500',
      'http://127.0.0.1:5500',
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      'http://localhost:3001',
      'http://127.0.0.1:3001',
      'https://beneficiostotal.com',
      'https://www.beneficiostotal.com'
    ];
    if (allowed.includes(origin) || origin.startsWith('http://localhost') || origin.startsWith('http://127.0.0.1')) {
      return callback(null, true);
    }
    return callback(null, true); // En desarrollo permitir orígenes
  },
}));

app.use(express.json({ limit: '100kb' }));

app.use('/api', registroRouter);
app.use('/api/admin', adminRouter);

// Error handler central
app.use((err, req, res, next) => {
  console.error('[server] Error:', err?.message || err);
  res.status(500).json({ error: 'Error interno del servidor.' });
});

app.listen(config.port, () => {
  console.log(`🚀 Backend SORTEO TOTAL FENAPO 2026 en http://localhost:${config.port}`);
  console.log(`   CORS permitido: ${config.frontendUrl}`);
  console.log(`   Sheets: ${config.appsScriptUrl ? 'configurado (Apps Script)' : 'MODO DEMO (no escribe en el sheet)'}`);
  console.log(`   WhatsApp: DRY_RUN=${config.dryRun}`);
  console.log(`   📊 Panel Admin: http://localhost:${config.port}/api/admin`);
  startWhatsApp();
});
