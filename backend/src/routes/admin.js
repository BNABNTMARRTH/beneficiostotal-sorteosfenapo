import { Router } from 'express';
import config, { sheetsConfigured } from '../config.js';
import * as sheets from '../services/sheets.js';
import * as whatsapp from '../services/whatsapp.js';

const router = Router();

// ── API endpoints for the admin panel ─────────────────────

router.get('/registros', async (req, res) => {
  try {
    const url = `${config.appsScriptUrl}?action=get_all_registros`;
    const response = await fetch(url);
    const data = await response.json();
    if (data.ok) return res.json({ ok: true, data: data.data || [] });
    return res.json({ ok: false, data: [], error: data.error });
  } catch (err) {
    return res.json({ ok: false, data: [], error: err?.message });
  }
});

router.get('/stats', async (req, res) => {
  try {
    const url = `${config.appsScriptUrl}?action=get_all_registros`;
    const response = await fetch(url);
    const data = await response.json();
    const registros = data.ok ? (data.data || []) : [];
    const total = registros.length;
    const confirmados = registros.filter(r => (r.enviado || '').toUpperCase() === 'SÍ').length;
    const pendientes = total - confirmados;
    const clientes = registros.filter(r => r.cuenta && r.cuenta !== 'No es cliente').length;
    const noClientes = total - clientes;
    const porDia = {};
    registros.forEach(r => { const d = r.fecha || 'Sin fecha'; porDia[d] = (porDia[d] || 0) + 1; });
    const porOrigen = {};
    registros.forEach(r => { const o = r.origen || 'Desconocido'; porOrigen[o] = (porOrigen[o] || 0) + 1; });
    return res.json({ ok: true, stats: { total, confirmados, pendientes, clientes, noClientes, porDia, porOrigen } });
  } catch (err) {
    return res.json({ ok: false, error: err?.message });
  }
});

router.get('/config', (req, res) => {
  res.json({
    ok: true, config: {
      premio: config.premio, fechaSorteo: config.fechaSorteo, dryRun: config.dryRun,
      frontendUrl: config.frontendUrl, sheetName: config.sheetName,
      appsScriptUrl: config.appsScriptUrl ? 'Configurada' : 'No configurada',
      whatsappNumber: whatsapp.getWhatsAppStatus().userPhone || 'No asignado',
    }
  });
});

router.get('/whatsapp', (req, res) => {
  res.json({ ok: true, ...whatsapp.getWhatsAppStatus() });
});

router.post('/whatsapp/logout', async (req, res) => {
  try {
    await whatsapp.logoutAndClearWhatsApp();
    res.json({ ok: true, message: 'Sesion cerrada y credenciales eliminadas. Reiniciando WhatsApp...' });
  } catch (err) {
    res.status(500).json({ ok: false, error: err?.message || String(err) });
  }
});

router.post('/sorteo/notificar', async (req, res) => {
  const { whatsapp: to, nombre, esCliente, folio } = req.body;
  if (!to) return res.status(400).json({ ok: false, error: 'Numero de WhatsApp requerido' });

  const clientType = String(esCliente || '').trim().toLowerCase();
  const isClient = clientType !== 'no' && clientType !== 'no es cliente' && clientType !== '' && clientType !== 'no cliente' && clientType !== '--';

  let msg = '';
  if (isClient) {
    msg = `🎉 ¡Felicidades, *${nombre}*! 🎁 Eres el gran GANADOR del sorteo de Totalplay en la FENAPO 2026. Tu folio ganador es el *${folio}*. 🌟 Como valioso cliente de Totalplay, queremos agradecer tu lealtad; ¡eres muy importante para nosotros! Te contactaremos muy pronto para coordinar la entrega de tu premio. ¡Gracias por confiar en Totalplay! 🚀`;
  } else {
    msg = `🎉 ¡Felicidades, *${nombre}*! 🎁 Eres el gran GANADOR del sorteo de Totalplay en la FENAPO 2026. Tu folio ganador es el *${folio}*. 🌟 Para Totalplay, tu eres igual de importante. Esperamos con gusto tenerte muy pronto como futuro cliente para poder consentirte y ofrecerte el mejor servicio. Te contactaremos muy pronto para la entrega de tu premio. ¡Felicidades! 🚀`;
  }

  try {
    const result = await whatsapp.sendMessage(to, msg);
    if (result.sent) {
      res.json({ ok: true, message: 'Ganador notificado por WhatsApp con exito.' });
    } else {
      res.status(500).json({ ok: false, error: result.error || 'No se pudo enviar el mensaje' });
    }
  } catch (err) {
    res.status(500).json({ ok: false, error: err?.message || String(err) });
  }
});

router.get('/', (req, res) => { res.send(ADMIN_HTML); });

// ── HTML ──────────────────────────────────────────────────
const ADMIN_HTML = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Admin — Sorteo Total FENAPO 2026</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet">
<style>
/* ═══════════════════════════════════════════════════════════
   DESIGN SYSTEM — Liquid Glass · Sala de control del sorteo
   Acento único: violeta Totalplay · colores solo semánticos
   ═══════════════════════════════════════════════════════════ */
:root {
  --bg-base: #06060b;
  --bg-1: rgba(14,14,22,0.72);
  --bg-2: rgba(22,22,34,0.72);
  --glass: rgba(255,255,255,0.04);
  --glass-border: rgba(255,255,255,0.07);
  --glass-strong: rgba(255,255,255,0.12);
  --glow: rgba(139,92,246,0.1);

  --accent-1: #8B5CF6;
  --accent-2: #A78BFA;
  --accent-3: #C4B5FD;

  --green: #34D399;
  --amber: #FBBF24;
  --rose: #FB7185;

  --text-1: #F8FAFC;
  --text-2: #CBD5E1;
  --text-3: #94A3B8;
  --text-4: #64748B;

  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 16px;
  --radius-xl: 20px;
  --font: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;

  --ease: cubic-bezier(.22,.61,.36,1);
  --shadow-1: 0 1px 0 rgba(255,255,255,.04) inset, 0 8px 24px -12px rgba(0,0,0,.6);
  --shadow-2: 0 1px 0 rgba(255,255,255,.05) inset, 0 12px 40px -14px rgba(139,92,246,.3);
}

* { margin:0; padding:0; box-sizing:border-box; }

body {
  font-family: var(--font);
  background: var(--bg-base);
  color: var(--text-1);
  min-height:100vh;
  -webkit-font-smoothing:antialiased;
}

/* ── Ambient background ── */
body::before, body::after {
  content:''; position:fixed; pointer-events:none; z-index:0; border-radius:50%;
  filter:blur(120px);
}
body::before { width:640px; height:640px; top:-220px; left:-140px; background:radial-gradient(circle, rgba(139,92,246,.14), transparent 70%); }
body::after  { width:560px; height:560px; bottom:-180px; right:-140px; background:radial-gradient(circle, rgba(76,29,149,.12), transparent 70%); }

:focus-visible { outline:2px solid var(--accent-2); outline-offset:2px; border-radius:6px; }

/* ── Topbar ── */
.topbar {
  position:sticky; top:0; z-index:100;
  display:flex; align-items:center; justify-content:space-between;
  padding:0 28px; height:60px;
  background:rgba(6,6,11,.78);
  backdrop-filter:blur(24px) saturate(1.5);
  border-bottom:1px solid var(--glass-border);
}
.topbar-left { display:flex; align-items:center; gap:12px; }
.topbar-mark {
  width:32px; height:32px; border-radius:10px;
  background:linear-gradient(135deg, var(--accent-1), #4C1D95);
  display:grid; place-items:center;
  box-shadow:0 4px 14px -4px rgba(139,92,246,.5);
}
.topbar-mark svg { width:17px; height:17px; fill:none; stroke:#fff; stroke-width:2; stroke-linecap:round; stroke-linejoin:round; }
.topbar h1 { font-size:14px; font-weight:600; letter-spacing:-.01em; color:var(--text-3); }
.topbar h1 b { color:var(--text-1); font-weight:700; }
.topbar-right { display:flex; align-items:center; gap:8px; }
.pill {
  display:inline-flex; align-items:center; gap:7px;
  padding:5px 12px; border-radius:999px; font-size:11px; font-weight:500;
  border:1px solid var(--glass-border); color:var(--text-3); background:var(--glass);
}
.dot { width:6px; height:6px; border-radius:50%; flex-shrink:0; }
.dot-g { background:var(--green); box-shadow:0 0 8px var(--green); }
.dot-y { background:var(--amber); box-shadow:0 0 8px var(--amber); }
.dot-r { background:var(--rose); box-shadow:0 0 8px var(--rose); }
@keyframes blink { 0%,100%{opacity:1} 50%{opacity:.35} }
.dot-y, .dot-r { animation:blink 2s ease-in-out infinite; }

/* ── Layout ── */
.shell { position:relative; z-index:1; max-width:1360px; margin:0 auto; padding:22px 24px 64px; }

/* ── Tabs ── */
.nav {
  display:flex; gap:4px; padding:4px;
  background:var(--bg-1);
  border:1px solid var(--glass-border);
  border-radius:var(--radius-lg);
  margin-bottom:22px;
  overflow-x:auto;
}
.nav button {
  flex:1; min-width:104px; min-height:42px; padding:9px 14px;
  border:none; border-radius:var(--radius-md); cursor:pointer;
  font-family:var(--font); font-size:12.5px; font-weight:500;
  color:var(--text-3); background:transparent;
  transition:color .2s, background .25s, box-shadow .25s, transform .15s;
  display:inline-flex; align-items:center; justify-content:center; gap:8px;
  white-space:nowrap;
}
.nav button svg { width:15px; height:15px; stroke:currentColor; fill:none; stroke-width:1.8; stroke-linecap:round; stroke-linejoin:round; }
.nav button:hover { color:var(--text-2); background:var(--glass); }
.nav button.on { color:#fff; background:linear-gradient(135deg, var(--accent-1), #6D28D9); box-shadow:0 4px 18px -6px rgba(139,92,246,.6); }
.pane { display:none; }
.pane.on { display:block; animation:rise .28s var(--ease); }
@keyframes rise { from{opacity:0; transform:translateY(8px)} to{opacity:1; transform:translateY(0)} }

/* ── Hero ── */
.hero {
  position:relative; overflow:hidden;
  display:flex; align-items:center; gap:24px; flex-wrap:wrap;
  padding:26px 28px; margin-bottom:18px;
  background:linear-gradient(150deg, rgba(139,92,246,.1), rgba(6,6,11,0) 55%), var(--bg-1);
  border:1px solid var(--glass-border);
  border-radius:var(--radius-xl);
  box-shadow:var(--shadow-1);
}
.hero::before {
  content:''; position:absolute; inset:0;
  background:radial-gradient(600px 180px at 18% -40%, rgba(139,92,246,.22), transparent 70%);
  pointer-events:none;
}
.hero-info { flex:1; min-width:280px; position:relative; }
.hero-eyebrow {
  font-size:10.5px; font-weight:700; letter-spacing:.14em; text-transform:uppercase;
  color:var(--accent-2); margin-bottom:8px;
}
.hero-title { font-size:26px; font-weight:800; letter-spacing:-.02em; margin-bottom:16px; }
.hero-title b { color:var(--accent-2); font-variant-numeric:tabular-nums; }
.hero-bar {
  height:10px; border-radius:999px; background:var(--bg-2);
  border:1px solid var(--glass-border); overflow:hidden;
  max-width:560px;
}
.hero-fill {
  height:100%; border-radius:999px;
  background:linear-gradient(90deg, var(--accent-1), var(--accent-3));
  box-shadow:0 0 16px rgba(139,92,246,.5);
  width:0%; transition:width .8s var(--ease);
}
.hero-meta { display:flex; gap:18px; flex-wrap:wrap; margin-top:12px; font-size:12px; color:var(--text-3); }
.hero-meta b { color:var(--text-1); font-variant-numeric:tabular-nums; }
.hero-cta { display:flex; flex-direction:column; gap:10px; position:relative; }

/* ── KPI ── */
.kpi-row { display:grid; grid-template-columns:repeat(auto-fit, minmax(190px,1fr)); gap:14px; margin-bottom:18px; }
.kpi {
  position:relative; padding:18px 20px;
  background:var(--bg-1);
  border:1px solid var(--glass-border);
  border-radius:var(--radius-lg);
  overflow:hidden;
  box-shadow:var(--shadow-1);
  transition:border-color .25s, transform .2s var(--ease), box-shadow .25s;
}
.kpi:hover { border-color:rgba(139,92,246,.28); transform:translateY(-2px); box-shadow:var(--shadow-2); }
.kpi::before {
  content:''; position:absolute; inset:0;
  background:linear-gradient(135deg, var(--glow), transparent 60%);
  opacity:0; transition:opacity .3s;
}
.kpi:hover::before { opacity:1; }
.kpi-icon {
  width:34px; height:34px; border-radius:10px; margin-bottom:12px;
  display:grid; place-items:center;
  background:var(--bg-2); border:1px solid var(--glass-border);
}
.kpi-icon svg { width:17px; height:17px; stroke-width:1.8; fill:none; stroke-linecap:round; stroke-linejoin:round; }
.kpi-label { font-size:11px; font-weight:600; color:var(--text-3); text-transform:uppercase; letter-spacing:.06em; margin-bottom:6px; position:relative; }
.kpi-val { font-size:30px; font-weight:800; letter-spacing:-.03em; position:relative; font-variant-numeric:tabular-nums; line-height:1; }
.kpi-sub { font-size:11px; color:var(--text-4); margin-top:8px; position:relative; }

/* ── Card ── */
.card {
  background:var(--bg-1);
  border:1px solid var(--glass-border);
  border-radius:var(--radius-lg);
  padding:22px; margin-bottom:18px;
  box-shadow:var(--shadow-1);
}
.card-title { font-size:13px; font-weight:600; color:var(--text-2); margin-bottom:16px; display:flex; align-items:center; gap:9px; text-wrap:balance; }
.card-title svg { width:16px; height:16px; stroke:var(--accent-2); fill:none; stroke-width:1.8; stroke-linecap:round; stroke-linejoin:round; flex-shrink:0; }

/* ── Charts ── */
.charts { display:grid; grid-template-columns:repeat(auto-fit, minmax(360px,1fr)); gap:14px; margin-bottom:18px; }
.bar-chart { display:flex; flex-direction:column; gap:8px; }
.bar-row { display:flex; align-items:center; gap:10px; }
.bar-label { font-size:11px; color:var(--text-3); min-width:88px; text-align:right; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.bar-track { flex:1; height:22px; background:var(--bg-2); border:1px solid var(--glass-border); border-radius:8px; overflow:hidden; }
.bar-fill {
  height:100%; min-width:4px; border-radius:8px;
  display:flex; align-items:center; justify-content:flex-end; padding-right:9px;
  background:linear-gradient(90deg, #6D28D9, var(--accent-1));
  transition:width .6s var(--ease);
}
.bar-fill span { font-size:10.5px; font-weight:700; color:rgba(255,255,255,.92); font-variant-numeric:tabular-nums; }
.bar-fill.top { background:linear-gradient(90deg, var(--accent-1), var(--accent-3)); box-shadow:0 0 14px rgba(139,92,246,.45); }

/* ── Table ── */
.tbl-wrap { overflow-x:auto; border-radius:var(--radius-sm); max-height:520px; overflow-y:auto; }
table { width:100%; border-collapse:collapse; font-size:12.5px; }
thead th {
  text-align:left; padding:10px 12px; font-weight:600; font-size:10.5px;
  text-transform:uppercase; letter-spacing:.06em; color:var(--text-4);
  background:rgba(255,255,255,.02); border-bottom:1px solid var(--glass-border);
  position:sticky; top:0; z-index:2;
}
tbody td { padding:10px 12px; border-bottom:1px solid rgba(255,255,255,.025); vertical-align:middle; }
tbody tr { transition:background .12s; }
tbody tr:hover { background:rgba(139,92,246,.05); }
.tnum { font-variant-numeric:tabular-nums; }
.tag { display:inline-flex; align-items:center; gap:6px; padding:3px 10px; border-radius:999px; font-size:10.5px; font-weight:600; white-space:nowrap; }
.tag .dot { width:5px; height:5px; box-shadow:none; }
.tag-ok { background:rgba(52,211,153,.12); color:var(--green); }
.tag-ok .dot { background:var(--green); }
.tag-wait { background:rgba(251,191,36,.12); color:var(--amber); }
.tag-wait .dot { background:var(--amber); }
.tag-client { background:rgba(139,92,246,.14); color:var(--accent-2); }
.tag-noc { background:rgba(100,116,139,.12); color:var(--text-3); }
.row-acts { display:inline-flex; gap:4px; opacity:0; transition:opacity .15s; }
tr:hover .row-acts { opacity:1; }
.act-btn {
  width:30px; height:30px; border-radius:8px; display:grid; place-items:center;
  background:var(--bg-2); border:1px solid var(--glass-border); cursor:pointer;
  color:var(--text-3); transition:color .15s, border-color .15s, transform .1s;
}
.act-btn:hover { color:var(--accent-2); border-color:rgba(139,92,246,.4); transform:translateY(-1px); }
.act-btn svg { width:14px; height:14px; stroke:currentColor; fill:none; stroke-width:1.8; stroke-linecap:round; stroke-linejoin:round; }

/* ── Toolbar / Input / Buttons ── */
.toolbar { display:flex; gap:8px; margin-bottom:14px; flex-wrap:wrap; align-items:center; }
.toolbar .cnt { margin-left:auto; font-size:11.5px; color:var(--text-4); font-variant-numeric:tabular-nums; white-space:nowrap; }
.input {
  flex:1; min-width:200px; min-height:40px; padding:8px 12px;
  background:var(--bg-base); border:1px solid var(--glass-border);
  border-radius:var(--radius-sm); color:var(--text-1);
  font-family:var(--font); font-size:12.5px; outline:none;
  transition:border-color .2s, box-shadow .2s;
}
.input:focus { border-color:var(--accent-1); box-shadow:0 0 0 3px rgba(139,92,246,.15); }
.input::placeholder { color:var(--text-4); }
.btn {
  display:inline-flex; align-items:center; justify-content:center; gap:7px;
  min-height:40px; padding:0 16px; border:none; border-radius:var(--radius-sm);
  font-family:var(--font); font-size:12.5px; font-weight:600;
  cursor:pointer; transition:all .2s var(--ease); white-space:nowrap;
}
.btn svg { width:15px; height:15px; stroke:currentColor; fill:none; stroke-width:1.8; stroke-linecap:round; stroke-linejoin:round; }
.btn-p { background:linear-gradient(135deg, var(--accent-1), #6D28D9); color:#fff; box-shadow:0 4px 16px -6px rgba(139,92,246,.6); }
.btn-p:hover { box-shadow:0 8px 24px -6px rgba(139,92,246,.7); transform:translateY(-1px); }
.btn-p:disabled { opacity:.5; cursor:not-allowed; transform:none; box-shadow:none; }
.btn-g { background:var(--bg-2); color:var(--text-2); border:1px solid var(--glass-border); }
.btn-g:hover { border-color:rgba(139,92,246,.4); color:var(--accent-2); }
.btn-lg { min-height:48px; padding:0 22px; font-size:14px; border-radius:var(--radius-md); }
.btn-sm { min-height:34px; padding:0 12px; font-size:11.5px; }

/* ── Date Dropdown Multiselect ── */
.date-dd-wrap { position:relative; display:inline-block; }
.date-dd-btn {
  display:inline-flex; align-items:center; gap:8px; min-height:40px; padding:0 14px;
  background:var(--bg-2); border:1px solid var(--glass-border); border-radius:var(--radius-sm);
  color:var(--text-1); font-family:var(--font); font-size:12.5px; font-weight:600;
  cursor:pointer; transition:all .2s var(--ease); user-select:none;
}
.date-dd-btn:hover { border-color:rgba(139,92,246,.4); color:var(--accent-2); }
.date-dd-btn svg { width:14px; height:14px; stroke:currentColor; fill:none; stroke-width:2; transition:transform .2s; }
.date-dd-btn.open svg { transform:rotate(180deg); }
.date-dd-menu {
  position:absolute; top:calc(100% + 6px); left:0; z-index:100;
  min-width:230px; padding:10px; border-radius:var(--radius-md);
  background:var(--bg-base); border:1px solid var(--glass-strong);
  box-shadow:0 12px 32px rgba(0,0,0,.8);
  display:none; flex-direction:column; gap:6px;
  animation:rise .2s var(--ease);
}
.date-dd-menu.open { display:flex; }
.date-pill {
  display:flex; align-items:center; gap:8px;
  padding:7px 10px; border-radius:var(--radius-sm); font-size:12px; font-weight:500;
  background:var(--bg-2); border:1px solid var(--glass-border); color:var(--text-3);
  cursor:pointer; transition:all .15s var(--ease); user-select:none;
}
.date-pill:hover { border-color:rgba(139,92,246,.35); color:var(--text-1); }
.date-pill.on {
  background:rgba(139,92,246,.18); border-color:var(--accent-1); color:#fff;
}
.date-pill input { accent-color:var(--accent-1); width:14px; height:14px; cursor:pointer; }

/* ── Checkbox (pool) ── */
.check {
  display:inline-flex; align-items:center; gap:8px;
  padding:6px 12px; border-radius:999px; cursor:pointer;
  background:var(--bg-2); border:1px solid var(--glass-border);
  font-size:12px; color:var(--text-3); font-weight:500;
  transition:border-color .15s, color .15s;
  user-select:none;
}
.check:hover { border-color:rgba(139,92,246,.35); }
.check input { accent-color:var(--accent-1); width:15px; height:15px; cursor:pointer; }

/* ── Config ── */
.cfg-grid { display:grid; grid-template-columns:repeat(auto-fit, minmax(280px,1fr)); gap:12px; }
.cfg-item {
  display:flex; align-items:flex-start; justify-content:space-between; gap:10px;
  padding:14px 16px;
  background:var(--bg-2); border-radius:var(--radius-md);
  border:1px solid var(--glass-border);
}
.cfg-txt { display:flex; flex-direction:column; gap:4px; min-width:0; }
.cfg-label { font-size:10px; font-weight:600; text-transform:uppercase; letter-spacing:.07em; color:var(--text-4); }
.cfg-val { font-size:13px; font-weight:500; color:var(--text-2); word-break:break-all; }
.cfg-code { font-family:'SFMono-Regular', ui-monospace, Menlo, monospace; font-size:11.5px; color:var(--accent-3); }
.copy-btn {
  flex-shrink:0; width:30px; height:30px; border-radius:8px; display:grid; place-items:center;
  background:transparent; border:1px solid var(--glass-border); cursor:pointer;
  color:var(--text-4); transition:color .15s, border-color .15s, transform .1s;
}
.copy-btn:hover { color:var(--accent-2); border-color:rgba(139,92,246,.4); transform:translateY(-1px); }
.copy-btn svg { width:14px; height:14px; stroke:currentColor; fill:none; stroke-width:1.8; stroke-linecap:round; stroke-linejoin:round; }

/* ── WhatsApp ── */
.wa-hero {
  display:flex; align-items:center; gap:16px; flex-wrap:wrap;
  padding:16px 18px; margin-bottom:14px;
  background:var(--bg-2); border:1px solid var(--glass-border); border-radius:var(--radius-md);
}
.wa-hero .dot { width:12px; height:12px; }
.wa-hero-t { font-size:15px; font-weight:700; }
.wa-hero-s { font-size:12px; color:var(--text-3); margin-top:2px; }
.wa-grid { display:grid; grid-template-columns:repeat(auto-fit, minmax(180px,1fr)); gap:12px; }
.wa-card {
  padding:20px; border-radius:var(--radius-md);
  border:1px solid var(--glass-border);
  background:var(--bg-2); text-align:center;
}
.wa-card svg { width:28px; height:28px; stroke-width:1.5; fill:none; stroke-linecap:round; stroke-linejoin:round; margin-bottom:10px; }
.wa-label { font-size:11px; font-weight:500; color:var(--text-4); margin-bottom:4px; }
.wa-val { font-size:16px; font-weight:700; font-variant-numeric:tabular-nums; }
.wa-test { margin-top:14px; padding:16px 18px; background:var(--bg-2); border:1px solid var(--glass-border); border-radius:var(--radius-md); }
.wa-test-row { display:flex; gap:8px; flex-wrap:wrap; }
.wa-result { margin-top:12px; font-size:12.5px; color:var(--text-3); display:none; }
.wa-result.show { display:block; animation:rise .25s var(--ease); }
.wa-result .r-line { display:flex; align-items:center; gap:8px; padding:6px 0; border-bottom:1px dashed rgba(255,255,255,.05); }
.wa-result .r-line:last-child { border-bottom:none; }
.wa-result b { color:var(--text-1); font-variant-numeric:tabular-nums; }
.qr-box { margin:20px auto; padding:14px; background:#fff; border-radius:14px; display:inline-block; box-shadow:0 12px 40px -10px rgba(139,92,246,.35); }
.qr-box img { border-radius:8px; display:block; }

/* ── Sorteo Redesign ── */
.sorteo-wrap {
  text-align: center;
  padding: 32px 24px;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.sorteo-header-box {
  max-width: 580px;
  margin-bottom: 8px;
}

.sorteo-head {
  color: var(--text-3);
  font-size: 13px;
  line-height: 1.6;
}

.wheel-stage {
  width: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  margin: 16px 0 14px;
}

.canvas-ring {
  position: relative;
  display: inline-block;
  padding: 8px;
  border-radius: 50%;
  background: linear-gradient(135deg, #8B5CF6, #4C1D95, #D946EF);
  box-shadow: 0 0 45px rgba(139, 92, 246, 0.4), 0 12px 36px rgba(0, 0, 0, 0.5);
  transition: transform 0.3s var(--ease), box-shadow 0.3s var(--ease);
}

.canvas-ring::before {
  content: '';
  position: absolute;
  inset: 3px;
  border-radius: 50%;
  background: var(--bg-base);
}

#sorteoCanvas {
  position: relative;
  border-radius: 50%;
  display: block;
}

/* Status Bar */
.sorteo-status-bar {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  margin-bottom: 20px;
  flex-wrap: wrap;
}

.pool-pill {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 16px;
  border-radius: 999px;
  background: rgba(139, 92, 246, 0.08);
  border: 1px solid rgba(139, 92, 246, 0.25);
  color: var(--text-2);
  font-size: 13px;
  font-weight: 600;
}

.pool-pill b {
  color: var(--accent-2);
  font-variant-numeric: tabular-nums;
  font-size: 15px;
}

.pool-pill .icon-sm {
  width: 15px;
  height: 15px;
  stroke: var(--accent-2);
  fill: none;
  stroke-width: 2;
}

.status-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
  border: 1px solid transparent;
  transition: all 0.25s var(--ease);
}

.status-badge.ready {
  background: rgba(34, 197, 94, 0.1);
  border-color: rgba(34, 197, 94, 0.3);
  color: var(--green);
}

.status-badge.locked {
  background: rgba(239, 68, 68, 0.1);
  border-color: rgba(239, 68, 68, 0.3);
  color: #EF4444;
}

.status-badge.spinning {
  background: rgba(245, 158, 11, 0.1);
  border-color: rgba(245, 158, 11, 0.3);
  color: var(--amber);
}

.status-badge .status-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: currentColor;
}

.status-badge.ready .status-dot {
  box-shadow: 0 0 8px var(--green);
}

.status-badge.spinning .status-dot {
  animation: statusPulse 0.8s infinite alternate;
}

@keyframes statusPulse {
  from { opacity: 0.4; transform: scale(0.8); }
  to { opacity: 1; transform: scale(1.2); }
}

/* Sorteo Panel */
.sorteo-panel {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 18px;
  padding: 12px 24px;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 20px;
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.25);
  flex-wrap: wrap;
  max-width: 720px;
  width: 100%;
}

.sorteo-check-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  user-select: none;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-2);
  padding: 8px 14px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid var(--glass-border);
  transition: all 0.2s var(--ease);
}

.sorteo-check-toggle:hover {
  background: rgba(255, 255, 255, 0.08);
  color: var(--text-1);
}

.sorteo-check-toggle input[type="checkbox"] {
  accent-color: var(--accent-1);
  width: 16px;
  height: 16px;
  cursor: pointer;
}

.btn-spin-hero {
  padding: 12px 28px !important;
  font-size: 15px !important;
  font-weight: 700 !important;
  border-radius: 14px !important;
  background: linear-gradient(135deg, #8B5CF6, #6D28D9) !important;
  box-shadow: 0 8px 25px rgba(139, 92, 246, 0.45) !important;
  transition: all 0.25s var(--ease) !important;
  display: inline-flex !important;
  align-items: center !important;
  gap: 10px !important;
}

.btn-spin-hero:hover:not(:disabled) {
  transform: translateY(-2deg) scale(1.03) !important;
  box-shadow: 0 12px 35px rgba(139, 92, 246, 0.6) !important;
}

.sorteo-sec-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.btn-icon-text {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 9px 14px;
  font-size: 12.5px;
}

@media (max-width: 640px) {
  .sorteo-panel {
    flex-direction: column;
    gap: 12px;
    padding: 16px;
  }
  .btn-spin-hero {
    width: 100%;
    justify-content: center;
  }
  .sorteo-sec-actions {
    width: 100%;
    justify-content: space-between;
  }
  .sorteo-sec-actions button {
    flex: 1;
  }
}
/* ── Winner Ticket UI ── */
.result-box {
  margin-top: 25px;
  padding: 0;
  background: transparent;
  border: none;
  display: none;
  perspective: 1000px;
}
.result-box.show {
  display: block;
}
.ticket-winner-v3 {
  display: flex;
  background: linear-gradient(135deg, rgba(30, 16, 62, 0.95), rgba(13, 8, 28, 0.98));
  border: 2px solid rgba(167, 139, 250, 0.4);
  border-radius: 20px;
  position: relative;
  overflow: visible;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.6), 0 0 40px rgba(139, 92, 246, 0.25);
  animation: ticketReveal 0.65s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
  max-width: 580px;
  margin: 0 auto;
}
@keyframes ticketReveal {
  0% {
    opacity: 0;
    transform: scale(0.85) rotateX(-20deg) translateY(30px);
  }
  100% {
    opacity: 1;
    transform: scale(1) rotateX(0deg) translateY(0);
  }
}
.ticket-perf {
  width: 26px;
  height: 26px;
  background: var(--bg-base);
  border-radius: 50%;
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  z-index: 10;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.05), 0 1px 0 rgba(255, 255, 255, 0.05);
}
.ticket-perf-left {
  left: -13px;
  border-right: 2px solid rgba(167, 139, 250, 0.4);
}
.ticket-perf-right {
  right: -13px;
  border-left: 2px solid rgba(167, 139, 250, 0.4);
}
.ticket-main-v3 {
  flex: 1;
  padding: 24px 28px;
  border-right: 1px dashed rgba(167, 139, 250, 0.3);
  min-width: 0;
}
.ticket-header-v3 {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 18px;
}
.ticket-badge-v3 {
  font-size: 10px;
  font-weight: 800;
  color: #fff;
  background: linear-gradient(135deg, #d946ef, #8b5cf6);
  padding: 4px 10px;
  border-radius: 999px;
  letter-spacing: 0.1em;
  box-shadow: 0 2px 10px rgba(139, 92, 246, 0.35);
}
.ticket-logo-v3 {
  display: flex;
  align-items: center;
}
.ticket-logo-v3 img {
  height: 18px;
  display: block;
}
.ticket-body-v3 .w-pre {
  font-size: 10px;
  color: var(--accent-3);
  font-weight: 700;
  letter-spacing: 0.15em;
  margin-bottom: 6px;
}
.ticket-body-v3 .w-name {
  font-size: 28px;
  font-weight: 900;
  color: #fff;
  letter-spacing: -0.02em;
  line-height: 1.2;
  margin-bottom: 18px;
  word-wrap: break-word;
  text-shadow: 0 2px 12px rgba(167, 139, 250, 0.25);
}
.ticket-details-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}
.detail-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.detail-lbl {
  font-size: 9px;
  font-weight: 700;
  color: var(--text-4);
  letter-spacing: 0.08em;
}
.detail-val {
  font-size: 13px;
  font-weight: 800;
  color: #fff;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.ticket-stub-v3 {
  width: 100px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  align-items: center;
  padding: 24px 10px;
  background: rgba(255, 255, 255, 0.015);
  border-top-right-radius: 20px;
  border-bottom-right-radius: 20px;
  flex-shrink: 0;
}
.stub-lbl {
  font-size: 8px;
  font-weight: 800;
  color: var(--text-4);
  writing-mode: vertical-lr;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}
.stub-icon-v3 {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: rgba(139, 92, 246, 0.15);
  display: grid;
  place-items: center;
  color: var(--accent-2);
}
.stub-icon-v3 svg {
  width: 16px;
  height: 16px;
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
}
.stub-date-v3 {
  font-size: 8.5px;
  font-weight: 800;
  color: var(--accent-3);
  letter-spacing: 0.05em;
}
@media (max-width: 480px) {
  .ticket-winner-v3 {
    flex-direction: column;
  }
  .ticket-main-v3 {
    border-right: none;
    border-bottom: 1px dashed rgba(167, 139, 250, 0.3);
  }
  .ticket-stub-v3 {
    width: 100%;
    height: 70px;
    flex-direction: row;
    padding: 12px 24px;
    border-top-right-radius: 0;
    border-bottom-left-radius: 20px;
  }
  .stub-lbl {
    writing-mode: horizontal-tb;
  }
  .ticket-perf {
    display: none;
  }
}
/* ── Winner Modal Overlay ── */
.winner-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(6, 6, 11, 0.88);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  z-index: 10000;
  display: none;
  align-items: center;
  justify-content: center;
  padding: 20px;
  animation: fadeInOverlay 0.3s ease forwards;
}
@keyframes fadeInOverlay {
  from { opacity: 0; }
  to { opacity: 1; }
}
.winner-modal-content {
  position: relative;
  width: 100%;
  max-width: 620px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}
.winner-modal-close {
  position: absolute;
  top: -48px;
  right: 0;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.15);
  color: #fff;
  font-size: 22px;
  cursor: pointer;
  display: grid;
  place-items: center;
  transition: all 0.2s;
}
.winner-modal-close:hover {
  background: rgba(255, 255, 255, 0.15);
  transform: scale(1.05);
}

/* Masking & Reveal */
.phone-reveal-container {
  display: flex;
  align-items: center;
  gap: 8px;
  position: relative;
}
.phone-reveal-container .masked {
  filter: blur(4px);
  user-select: none;
}
.reveal-btn {
  background: rgba(139, 92, 246, 0.18);
  border: 1px solid rgba(139, 92, 246, 0.35);
  color: var(--accent-3);
  padding: 3px 8px;
  border-radius: 6px;
  font-size: 10px;
  font-weight: 700;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  transition: all 0.2s;
}
.reveal-btn:hover {
  background: rgba(139, 92, 246, 0.3);
  border-color: rgba(167, 139, 250, 0.5);
}
.reveal-btn svg {
  width: 10px;
  height: 10px;
  stroke: currentColor;
  fill: none;
  stroke-width: 2.2;
}

/* Actions Row */
.winner-actions-row {
  display: flex;
  justify-content: center;
  margin-top: 10px;
}
.winner-actions-row button {
  min-width: 240px;
  box-shadow: 0 8px 30px rgba(139, 92, 246, 0.4);
}

/* Winners History List */
.winner-row {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--glass-border);
}
.winner-row:last-child { border-bottom: none; }
.winner-place {
  width: 38px;
  height: 38px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  font-weight: 900;
  font-size: 14px;
  color: #fff;
  flex-shrink: 0;
}
.winner-place.p1 { background: linear-gradient(135deg, #FFD700, #FFA500); }
.winner-place.p2 { background: linear-gradient(135deg, #C0C0C0, #A0A0A0); }
.winner-place.p3 { background: linear-gradient(135deg, #CD7F32, #A0522D); }
.winner-place.pn { background: var(--glass-strong); }
.winner-info { flex: 1; min-width: 0; }
.winner-info-name { font-weight: 700; color: var(--text-1); font-size: 14px; }
.winner-info-details { font-size: 11px; color: var(--text-4); margin-top: 2px; }
.winner-notify-status {
  font-size: 10px;
  font-weight: 700;
  padding: 3px 8px;
  border-radius: 6px;
}
.winner-notify-status.sent { background: rgba(34,197,94,.15); color: var(--green); }
.winner-notify-status.pending { background: rgba(245,158,11,.15); color: var(--amber); }

/* ── Toast / Confetti / Loader / Empty ── */
#toast {
  position:fixed; bottom:26px; left:50%; z-index:1000;
  transform:translateX(-50%) translateY(16px);
  padding:10px 18px; border-radius:12px;
  background:var(--bg-2); border:1px solid var(--glass-strong); color:var(--text-1);
  font-size:12.5px; font-weight:600; box-shadow:0 16px 40px -12px rgba(0,0,0,.7);
  opacity:0; pointer-events:none; transition:opacity .25s var(--ease), transform .25s var(--ease);
  max-width:80vw;
}
#toast.show { opacity:1; transform:translateX(-50%) translateY(0); }
#confetti { position:fixed; inset:0; pointer-events:none; z-index:10001; }
.ld { display:flex; align-items:center; justify-content:center; padding:50px; color:var(--text-4); font-size:13px; gap:9px; }
.spin { width:16px; height:16px; border:2px solid var(--glass-border); border-top-color:var(--accent-1); border-radius:50%; animation:sp .6s linear infinite; }
@keyframes sp { to { transform:rotate(360deg); } }
.empty { text-align:center; padding:44px 20px; color:var(--text-4); font-size:13px; }
.empty svg { width:34px; height:34px; stroke:var(--text-4); fill:none; stroke-width:1.3; stroke-linecap:round; stroke-linejoin:round; margin-bottom:10px; opacity:.6; }

/* ── Reduced motion ── */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration:.001s !important; animation-iteration-count:1 !important; transition-duration:.001s !important; }
}

/* ── Responsive ── */
@media (max-width:768px) {
  .topbar { padding:0 16px; }
  .shell { padding:14px 14px 44px; }
  .kpi-row { grid-template-columns:repeat(2,1fr); }
  .kpi-val { font-size:24px; }
  .charts { grid-template-columns:1fr; }
  .canvas-ring { transform:scale(.84); }
  .hero-title { font-size:22px; }
}
</style>
</head>
<body>

<canvas id="confetti"></canvas>
<div id="toast" role="status"></div>

<!-- Winner Modal Overlay (body-level for proper fixed positioning) -->
<div class="winner-modal-overlay" id="winnerModal">
  <div class="winner-modal-content">
    <button class="winner-modal-close" onclick="closeWinnerModal()">&times;</button>
    
    <div class="ticket-winner-v3">
      <div class="ticket-perf ticket-perf-left"></div>
      <div class="ticket-perf ticket-perf-right"></div>
      
      <div class="ticket-main-v3">
        <div class="ticket-header-v3">
          <span class="ticket-badge-v3" id="rBadge">★ TICKET GANADOR ★</span>
          <div class="ticket-logo-v3"><img src="/logos_total/logo total png blanco (1)-1.png" alt="Totalplay"></div>
        </div>
        
        <div class="ticket-body-v3">
          <div class="w-pre" id="rPre">GANADOR SELECCIONADO</div>
          <div class="w-name" id="rName"></div>
          
          <div class="ticket-details-grid">
            <div class="detail-item">
              <span class="detail-lbl">FOLIO</span>
              <span class="detail-val" id="rFolio"></span>
            </div>
            <div class="detail-item">
              <span class="detail-lbl">WHATSAPP</span>
              <div class="phone-reveal-container">
                <span class="detail-val masked" id="rWhatsAppMasked"></span>
                <span class="detail-val" id="rWhatsAppFull" style="display:none"></span>
                <button class="reveal-btn" id="rRevealBtn" onclick="revealPhoneNumber()">
                  <svg viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg> Revelar
                </button>
              </div>
            </div>
            <div class="detail-item">
              <span class="detail-lbl">CUENTA</span>
              <span class="detail-val" id="rCuenta"></span>
            </div>
          </div>
        </div>
      </div>
      
      <div class="ticket-stub-v3">
        <div class="stub-lbl">SORTEO EN VIVO</div>
        <div class="stub-icon-v3">
          <svg viewBox="0 0 24 24"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
        </div>
        <div class="stub-date-v3">FENAPO 2026</div>
      </div>
    </div>
    
    <div class="winner-actions-row">
      <button class="btn btn-p btn-lg" id="notifyBtn" onclick="notifyWinner()">
        <svg viewBox="0 0 24 24"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
        Notificar por WhatsApp
      </button>
    </div>
  </div>
</div>

<!-- ── Topbar ── -->
<header class="topbar">
  <div class="topbar-left">
    <div class="topbar-mark">
      <svg viewBox="0 0 24 24"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
    </div>
    <h1><b>Sorteo Total</b> &middot; FENAPO 2026</h1>
  </div>
  <div class="topbar-right">
    <span class="pill"><span class="dot" id="sDot"></span><span id="sLbl">Sheets</span></span>
    <span class="pill"><span class="dot" id="wDot"></span><span id="wLbl">WhatsApp</span></span>
  </div>
</header>

<div class="shell">

  <!-- ── Nav ── -->
  <nav class="nav">
    <button class="on" data-p="dashboard">
      <svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
      Dashboard
    </button>
    <button data-p="registros">
      <svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
      Registros
    </button>
    <button data-p="sorteo">
      <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M16.2 7.8l-2 6.3-6.4 2.1 2-6.3z"/></svg>
      Sorteo
    </button>
    <button data-p="whatsapp">
      <svg viewBox="0 0 24 24"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
      WhatsApp
    </button>
    <button data-p="config">
      <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
      Config
    </button>
  </nav>

  <!-- ═══════ DASHBOARD ═══════ -->
  <section class="pane on" id="p-dashboard">
    <div class="hero">
      <div class="hero-info">
        <div class="hero-eyebrow">Progreso del sorteo</div>
        <div class="hero-title"><b id="hOk">0</b> de <b id="hTotal">0</b> boletos confirmados</div>
        <div class="hero-bar"><div class="hero-fill" id="hFill"></div></div>
        <div class="hero-meta">
          <span>Faltan <b id="hWait">0</b> por confirmar</span>
          <span><b id="hCli">0</b> clientes Totalplay</span>
          <span><b id="hPct">0</b>% de confirmación</span>
        </div>
      </div>
      <div class="hero-cta">
        <button class="btn btn-p btn-lg" onclick="goPane('sorteo')"><svg viewBox="0 0 24 24"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg> Iniciar sorteo</button>
        <button class="btn btn-g" onclick="dlCSV()"><svg viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> Exportar CSV</button>
      </div>
    </div>
    <div class="kpi-row" id="kpis">
      <div class="kpi">
        <div class="kpi-icon"><svg viewBox="0 0 24 24" stroke="var(--accent-2)"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg></div>
        <div class="kpi-label">Total registros</div>
        <div class="kpi-val" style="color:var(--text-1)" id="k-total">&mdash;</div>
        <div class="kpi-sub">participantes en la hoja</div>
      </div>
      <div class="kpi">
        <div class="kpi-icon"><svg viewBox="0 0 24 24" stroke="var(--green)"><polyline points="20 6 9 17 4 12"/></svg></div>
        <div class="kpi-label">Confirmados</div>
        <div class="kpi-val" style="color:var(--green)" id="k-ok">&mdash;</div>
        <div class="kpi-sub">listos para el sorteo</div>
      </div>
      <div class="kpi">
        <div class="kpi-icon"><svg viewBox="0 0 24 24" stroke="var(--amber)"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></div>
        <div class="kpi-label">Pendientes</div>
        <div class="kpi-val" style="color:var(--amber)" id="k-wait">&mdash;</div>
        <div class="kpi-sub">faltan por confirmar</div>
      </div>
      <div class="kpi">
        <div class="kpi-icon"><svg viewBox="0 0 24 24" stroke="var(--accent-2)"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg></div>
        <div class="kpi-label">Clientes Totalplay</div>
        <div class="kpi-val" style="color:var(--text-1)" id="k-cli">&mdash;</div>
        <div class="kpi-sub">de Totalplay</div>
      </div>
    </div>
    <div class="charts">
      <div class="card">
        <div class="card-title"><svg viewBox="0 0 24 24"><rect x="18" y="3" width="4" height="18"/><rect x="10" y="8" width="4" height="13"/><rect x="2" y="13" width="4" height="8"/></svg> Registros por dia</div>
        <div class="bar-chart" id="cDia"><div class="ld"><div class="spin"></div>Cargando</div></div>
      </div>
      <div class="card">
        <div class="card-title"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg> Registros por origen</div>
        <div class="bar-chart" id="cOrigen"><div class="ld"><div class="spin"></div>Cargando</div></div>
      </div>
    </div>
  </section>

  <!-- ═══════ REGISTROS ═══════ -->
  <section class="pane" id="p-registros">
    <div class="card">
      <div class="card-title">
        <svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
        Lista de participantes
      </div>
      <div class="toolbar">
        <input class="input" id="q" type="text" placeholder="Buscar por nombre, folio, WhatsApp...">
        <div class="date-dd-wrap" id="ddWrapRegistros">
          <button class="date-dd-btn" id="ddBtnRegistros" onclick="toggleDateDropdown('Registros', event)">
            <svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            <span id="ddLabelRegistros">Fechas</span>
            <svg viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"/></svg>
          </button>
          <div class="date-dd-menu" id="ddMenuRegistros" onclick="event.stopPropagation()"></div>
        </div>
        <button class="btn btn-g" onclick="loadReg()"><svg viewBox="0 0 24 24"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg> Actualizar</button>
        <button class="btn btn-p" onclick="dlCSV()"><svg viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> Exportar CSV</button>
        <span class="cnt" id="tCount"></span>
      </div>
      <div class="tbl-wrap">
        <table>
          <thead><tr><th>#</th><th>Fecha</th><th>Folio</th><th>Nombre</th><th>Tipo</th><th>WhatsApp</th><th>Email</th><th>Origen</th><th>Estado</th><th></th></tr></thead>
          <tbody id="tBody"><tr><td colspan="10"><div class="ld"><div class="spin"></div>Cargando registros</div></td></tr></tbody>
        </table>
      </div>
    </div>
  </section>

  <!-- ═══════ SORTEO ═══════ -->
  <section class="pane" id="p-sorteo">
    <div class="card sorteo-wrap">
      <div class="sorteo-header-box">
        <div class="card-title" style="justify-content:center; margin-bottom: 6px;">
          <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M16.2 7.8l-2 6.3-6.4 2.1 2-6.3z"/></svg>
          Sorteo en vivo
        </div>
        <p class="sorteo-head">Selecciona un ganador al azar entre los participantes del pool. Usa el filtro para sortear solo a los confirmados y por fecha.</p>
      </div>

      <div style="margin-top:10px; margin-bottom:16px;">
        <div class="date-dd-wrap" id="ddWrapSorteo">
          <button class="date-dd-btn" id="ddBtnSorteo" onclick="toggleDateDropdown('Sorteo', event)">
            <svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            <span id="ddLabelSorteo">Fechas a sortear</span>
            <svg viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"/></svg>
          </button>
          <div class="date-dd-menu" id="ddMenuSorteo" onclick="event.stopPropagation()"></div>
        </div>
      </div>

      <!-- Wheel Stage -->
      <div class="wheel-stage">
        <div class="canvas-ring"><canvas id="sorteoCanvas" width="380" height="380"></canvas></div>
      </div>

      <!-- Status Bar -->
      <div class="sorteo-status-bar">
        <div class="pool-pill">
          <svg viewBox="0 0 24 24" class="icon-sm"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          Pool <b id="poolCount">0</b> participantes
        </div>
        <div class="status-badge ready" id="wheelStatusBadge">
          <span class="status-dot"></span> Lista para girar
        </div>
      </div>

      <!-- Control Panel -->
      <div class="sorteo-panel">
        <label class="sorteo-check-toggle">
          <input type="checkbox" id="onlyOk" checked>
          <span>Solo confirmados</span>
        </label>

        <button class="btn btn-p btn-lg btn-spin-hero" id="bSort" onclick="spin()">
          <svg viewBox="0 0 24 24"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
          <span>Iniciar sorteo</span>
        </button>

        <div class="sorteo-sec-actions">
          <button class="btn btn-g btn-icon-text" onclick="resetWheel()" title="Reiniciar sorteo">
            <svg viewBox="0 0 24 24"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
            <span>Reiniciar</span>
          </button>
          <button class="btn btn-g btn-icon-text" id="lockBtn" onclick="toggleLock()" title="Inhabilitar ruleta">
            <svg viewBox="0 0 24 24" style="width:14px;height:14px;stroke:currentColor;fill:none;stroke-width:2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            <span>Inhabilitar</span>
          </button>
        </div>
      </div>
    </div>
    <!-- Winners History -->
    <div class="card" id="winnersCard" style="display:none;margin-top:16px">
      <div class="card-title">
        <svg viewBox="0 0 24 24"><path d="M8 21h8M12 17v4M17 5H7a2 2 0 0 0-2 2v4c0 3.31 2.69 6 5 7h4c2.31-1 5-3.69 5-7V7a2 2 0 0 0-2-2z"/></svg>
        Ganadores del sorteo
      </div>
      <div id="winnersList"></div>
    </div>
  </section>

  <!-- ═══════ WHATSAPP ═══════ -->
  <section class="pane" id="p-whatsapp">
    <div class="card">
      <div class="card-title">
        <svg viewBox="0 0 24 24"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
        Estado de WhatsApp
      </div>
      <div class="wa-hero" id="waHero">
        <span class="dot dot-y"></span>
        <div>
          <div class="wa-hero-t">Cargando...</div>
          <div class="wa-hero-s">consultando estado</div>
        </div>
      </div>
      <div style="display: flex; gap: 8px; margin-bottom: 14px;">
        <button class="btn btn-g" id="waLogoutBtn" onclick="logoutWA()" style="flex: 1;"><svg viewBox="0 0 24 24" style="width:15px;height:15px;stroke:currentColor;fill:none;stroke-width:1.8;"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg> Cerrar sesión de WhatsApp (Resetear)</button>
      </div>
      <div class="wa-grid" id="waGrid"><div class="ld"><div class="spin"></div>Cargando</div></div>
      <div class="wa-test">
        <div class="wa-test-row">
          <input class="input" id="tNum" type="tel" placeholder="Numero, ej. 4443862158" style="flex:1;min-width:160px">
          <button class="btn btn-p" id="tBtn" onclick="testWA()"><svg viewBox="0 0 24 24"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg> Probar envio</button>
        </div>
        <div class="wa-result" id="waRes"></div>
      </div>
      <div id="waQr" style="text-align:center;margin-top:18px"></div>
    </div>
  </section>

  <!-- ═══════ CONFIG ═══════ -->
  <section class="pane" id="p-config">
    <div class="card">
      <div class="card-title">
        <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
        Configuracion del sistema
      </div>
      <div class="cfg-grid" id="cfgGrid"><div class="ld"><div class="spin"></div>Cargando</div></div>
    </div>
    <div class="card">
      <div class="card-title">
        <svg viewBox="0 0 24 24"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
        Endpoints de la API
      </div>
      <div class="cfg-grid">
        <div class="cfg-item"><div class="cfg-txt"><div class="cfg-label">Enviar codigo OTP</div><div class="cfg-val cfg-code">POST /api/enviar-codigo</div></div></div>
        <div class="cfg-item"><div class="cfg-txt"><div class="cfg-label">Registrar participante</div><div class="cfg-val cfg-code">POST /api/registro</div></div></div>
        <div class="cfg-item"><div class="cfg-txt"><div class="cfg-label">Estado del sistema</div><div class="cfg-val cfg-code">GET /api/health</div></div></div>
        <div class="cfg-item"><div class="cfg-txt"><div class="cfg-label">QR WhatsApp</div><div class="cfg-val cfg-code">GET /api/whatsapp/qr</div></div></div>
        <div class="cfg-item"><div class="cfg-txt"><div class="cfg-label">Probar envio WhatsApp</div><div class="cfg-val cfg-code">POST /api/whatsapp/test</div></div></div>
        <div class="cfg-item"><div class="cfg-txt"><div class="cfg-label">Panel admin</div><div class="cfg-val cfg-code">GET /api/admin</div></div></div>
        <div class="cfg-item"><div class="cfg-txt"><div class="cfg-label">Webhook externo</div><div class="cfg-val cfg-code">POST /api/webhook/sheets</div></div></div>
      </div>
    </div>
  </section>

</div>

<script>
/* ── State ── */
let REG = [], CUR = [], CFG_ITEMS = [], CFG_FRONT = '', spinning = false;

/* ── Helpers ── */
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function(c) {
    return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c];
  });
}
function emptyState(msg) {
  return '<div class="empty"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg><div>' + (msg || 'Sin datos') + '</div></div>';
}
function ticketUrl(folio) {
  if (!folio) return '';
  const base = (CFG_FRONT || '').replace(/\\/+$/, '');
  if (!base) return '';
  return base + '/index.html?ticket=' + encodeURIComponent(folio);
}
let toastTimer;
function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function() { t.classList.remove('show'); }, 2400);
}

/* ── Tabs ── */
let waPollTimer = null;
function startWAPolling() {
  stopWAPolling();
  loadWA();
  waPollTimer = setInterval(loadWA, 3000);
}
function stopWAPolling() {
  if (waPollTimer) {
    clearInterval(waPollTimer);
    waPollTimer = null;
  }
}

function goPane(name) {
  document.querySelectorAll('.nav button').forEach(function(x) {
    x.classList.toggle('on', x.dataset.p === name);
  });
  document.querySelectorAll('.pane').forEach(function(x) {
    x.classList.toggle('on', x.id === 'p-' + name);
  });
  
  stopWAPolling();

  if (name === 'registros') { REG.length ? applyFilter() : loadReg(); }
  if (name === 'sorteo') ensureReg().then(updatePool);
  if (name === 'whatsapp') startWAPolling();
  if (name === 'config') loadCfg();
}
document.querySelectorAll('.nav button').forEach(function(b) {
  b.onclick = function() { goPane(b.dataset.p); };
});

/* ── Dashboard ── */
async function loadDash() {
  try {
    const r = await fetch('/api/admin/stats');
    const { ok, stats } = await r.json();
    if (!ok) return;
    const total = stats.total || 0, okn = stats.confirmados || 0;
    const set = function(id, v) { document.getElementById(id).textContent = v; };
    set('k-total', total); set('k-ok', okn); set('k-wait', stats.pendientes || 0); set('k-cli', stats.clientes || 0);
    set('hTotal', total); set('hOk', okn); set('hWait', stats.pendientes || 0); set('hCli', stats.clientes || 0);
    const pct = total ? Math.round((okn / total) * 100) : 0;
    set('hPct', pct);
    document.getElementById('hFill').style.width = pct + '%';

    const dE = document.getElementById('cDia');
    const dias = Object.entries(stats.porDia || {}).sort(function(a, b) { return a[0].localeCompare(b[0]); });
    if (!dias.length) { dE.innerHTML = emptyState('Aun no hay registros'); }
    else {
      const vals = dias.map(function(d) { return d[1]; });
      const mD = Math.max.apply(null, vals.concat([1]));
      dE.innerHTML = dias.map(function(d) {
        const l = d[0], v = d[1];
        return '<div class="bar-row"><div class="bar-label">' + esc(l) + '</div><div class="bar-track">' +
          '<div class="bar-fill' + (v === mD ? ' top' : '') + '" style="width:' + Math.round((v / mD) * 100) + '%" title="' + esc(l) + ': ' + v + '"><span>' + v + '</span></div>' +
          '</div></div>';
      }).join('');
    }

    const oE = document.getElementById('cOrigen');
    const orgs = Object.entries(stats.porOrigen || {}).sort(function(a, b) { return b[1] - a[1]; });
    if (!orgs.length) { oE.innerHTML = emptyState('Aun no hay registros'); }
    else {
      const ovals = orgs.map(function(o) { return o[1]; });
      const mO = Math.max.apply(null, ovals.concat([1]));
      oE.innerHTML = orgs.map(function(o) {
        const l = o[0], v = o[1];
        return '<div class="bar-row"><div class="bar-label">' + esc(l) + '</div><div class="bar-track">' +
          '<div class="bar-fill" style="width:' + Math.round((v / mO) * 100) + '%"><span>' + v + '</span></div>' +
          '</div></div>';
      }).join('');
    }
  } catch (e) { console.error(e); }
}

/* ── Registros y Filtro de Fechas ── */
let selectedDates = [];
let datesInitialized = false;

function toggleDateDropdown(name, e) {
  if (e) e.stopPropagation();
  const btn = document.getElementById('ddBtn' + name);
  const menu = document.getElementById('ddMenu' + name);
  if (!btn || !menu) return;
  const isOpen = menu.classList.contains('open');
  // cerrar todos
  document.querySelectorAll('.date-dd-menu').forEach(function(m){ m.classList.remove('open'); });
  document.querySelectorAll('.date-dd-btn').forEach(function(b){ b.classList.remove('open'); });
  if (!isOpen) {
    menu.classList.add('open');
    btn.classList.add('open');
  }
}
document.addEventListener('click', function() {
  document.querySelectorAll('.date-dd-menu').forEach(function(m){ m.classList.remove('open'); });
  document.querySelectorAll('.date-dd-btn').forEach(function(b){ b.classList.remove('open'); });
});

function renderDateFilters() {
  const datesSet = new Set();
  REG.forEach(function(r) { if (r.fecha) datesSet.add(r.fecha); });
  const dates = Array.from(datesSet).sort(function(a,b){ return a.localeCompare(b); });
  
  if (!datesInitialized && dates.length) {
    selectedDates = dates.slice();
    datesInitialized = true;
  }

  const sections = ['Registros', 'Sorteo'];
  sections.forEach(function(sec) {
    const menu = document.getElementById('ddMenu' + sec);
    const lbl = document.getElementById('ddLabel' + sec);
    if (!menu || !lbl) return;

    if (!dates.length) {
      menu.innerHTML = '<span style="font-size:11px;color:var(--text-4)">Sin fechas registradas</span>';
      lbl.textContent = 'Fechas';
      return;
    }

    const allChecked = selectedDates.length === dates.length;
    if (allChecked) {
      lbl.textContent = 'Todas las fechas (' + dates.length + ')';
    } else if (selectedDates.length === 0) {
      lbl.textContent = 'Sin fechas seleccionadas';
    } else {
      lbl.textContent = selectedDates.length + ' de ' + dates.length + ' fechas';
    }

    let html = '<label class="date-pill' + (allChecked ? ' on' : '') + '">' +
      '<input type="checkbox" ' + (allChecked ? 'checked' : '') + ' onchange="toggleAllDateFilters()">' +
      '<span>Todas las fechas</span></label>';

    dates.forEach(function(d) {
      const isChecked = selectedDates.includes(d);
      const safeD = esc(d);
      html += '<label class="date-pill' + (isChecked ? ' on' : '') + '">' +
        '<input type="checkbox" ' + (isChecked ? 'checked' : '') + ' data-date="' + safeD + '" onchange="toggleDateFilter(this.dataset.date, this.checked)">' +
        '<span>' + safeD + '</span></label>';
    });

    menu.innerHTML = html;
  });
}

function toggleAllDateFilters() {
  const datesSet = new Set();
  REG.forEach(function(r) { if (r.fecha) datesSet.add(r.fecha); });
  const dates = Array.from(datesSet);
  // Si actualmente están todas seleccionadas, deshabilitar todas. De lo contrario, seleccionar todas.
  if (selectedDates.length === dates.length) {
    selectedDates = [];
  } else {
    selectedDates = dates.slice();
  }
  renderDateFilters();
  applyFilter();
  updatePool();
}

function toggleDateFilter(dateStr, checked) {
  if (checked) {
    if (!selectedDates.includes(dateStr)) selectedDates.push(dateStr);
  } else {
    selectedDates = selectedDates.filter(function(d) { return d !== dateStr; });
  }
  renderDateFilters();
  applyFilter();
  updatePool();
}

async function ensureReg() {
  if (REG.length) return REG;
  try {
    const r = await fetch('/api/admin/registros');
    const d = await r.json();
    REG = d.data || [];
    renderDateFilters();
  } catch (e) {}
  return REG;
}
async function loadReg() {
  const b = document.getElementById('tBody');
  b.innerHTML = '<tr><td colspan="10"><div class="ld"><div class="spin"></div>Cargando</div></td></tr>';
  try {
    const r = await fetch('/api/admin/registros');
    const { data } = await r.json();
    REG = data || [];
    renderDateFilters();
    applyFilter();
  } catch {
    b.innerHTML = '<tr><td colspan="10" style="color:var(--rose);padding:24px;text-align:center">Error al cargar registros</td></tr>';
  }
}
function drawTable(list) {
  CUR = list;
  const b = document.getElementById('tBody');
  const cnt = document.getElementById('tCount');
  if (!list.length) {
    const q = document.getElementById('q').value.trim();
    b.innerHTML = '<tr><td colspan="10"><div class="empty">' +
      (q ? 'Sin coincidencias para &ldquo;' + esc(q) + '&rdquo;' : 'Aun no hay registros para las fechas seleccionadas') +
      '</div></td></tr>';
    cnt.textContent = '';
    return;
  }
  b.innerHTML = list.map(function(r, i) {
    const env = (r.enviado || '').toUpperCase();
    const st = (env === 'SI' || env === 'SÍ')
      ? '<span class="tag tag-ok"><span class="dot"></span>Enviado</span>'
      : '<span class="tag tag-wait"><span class="dot"></span>Pendiente</span>';
    const cl = r.cuenta && r.cuenta !== 'No es cliente'
      ? '<span class="tag tag-client">Cliente</span>'
      : '<span class="tag tag-noc">No cliente</span>';
    const folio = r.folio || '--';
    const u = ticketUrl(r.folio);
    const acts =
      '<span class="row-acts">' +
      '<button class="act-btn" title="Copiar folio" onclick="copyFolio(' + i + ')"><svg viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></button>' +
      (u ? '<a class="act-btn" title="Ver boleto" href="' + u + '" target="_blank" rel="noopener"><svg viewBox="0 0 24 24"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg></a>' : '') +
      '</span>';
    return '<tr><td class="tnum">' + (i + 1) + '</td><td>' + esc(r.fecha || '--') + '</td>' +
      '<td style="font-weight:700;color:var(--accent-2);font-variant-numeric:tabular-nums">' + esc(folio) + '</td>' +
      '<td>' + esc(r.nombre || '--') + '</td><td>' + cl + '</td>' +
      '<td class="tnum">' + esc(r.whatsapp || '--') + '</td>' +
      '<td style="font-size:11px">' + esc(r.email || '--') + '</td>' +
      '<td style="font-size:11px">' + esc(r.origen || '--') + '</td><td>' + st + '</td>' +
      '<td>' + acts + '</td></tr>';
  }).join('');
  const q = document.getElementById('q').value.trim();
  cnt.textContent = q ? (list.length + ' de ' + REG.length + ' resultados') : (list.length + ' de ' + REG.length + ' registros');
}
function copyFolio(i) {
  const r = CUR[i];
  if (!r || !r.folio) return;
  navigator.clipboard.writeText(r.folio)
    .then(function() { toast('Folio copiado: ' + r.folio); })
    .catch(function() { toast('No se pudo copiar'); });
}
function applyFilter() {
  const s = document.getElementById('q').value.trim().toLowerCase();
  drawTable(REG.filter(function(r) {
    const matchDate = selectedDates.length ? selectedDates.includes(r.fecha) : true;
    if (!matchDate) return false;
    if (!s) return true;
    return String(r.nombre || '').toLowerCase().includes(s)
      || String(r.folio || '').toLowerCase().includes(s)
      || String(r.whatsapp || '').includes(s)
      || String(r.email || '').toLowerCase().includes(s)
      || String(r.origen || '').toLowerCase().includes(s);
  }));
}
document.getElementById('q').addEventListener('input', applyFilter);
function dlCSV() {
  if (!REG.length) return toast('No hay registros para exportar');
  const h = ['Fecha', 'Folio', 'Nombre', 'Cuenta', 'WhatsApp', 'Email', 'Origen', 'Enviado'];
  const rows = REG.map(function(r) { return [r.fecha, r.folio, r.nombre, r.cuenta, r.whatsapp, r.email, r.origen, r.enviado]; });
  const csv = [h.join(','), rows.map(function(r) { return r.map(function(v) { return '"' + (v || '').replace(/"/g, '""') + '"'; }).join(','); }).join('\\n')].join('\\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  a.download = 'sorteo_' + new Date().toISOString().slice(0, 10) + '.csv';
  a.click();
}

/* ── WhatsApp ── */
async function loadWA() {
  try {
    const r = await fetch('/api/admin/whatsapp');
    const d = await r.json();
    const col = d.connected ? 'var(--green)' : (d.connecting ? 'var(--amber)' : 'var(--rose)');
    const txt = d.connected ? 'Conectado' : (d.connecting ? 'Conectando...' : 'Desconectado');
    const dotCls = d.connected ? 'dot-g' : (d.connecting ? 'dot-y' : 'dot-r');
    document.getElementById('waHero').innerHTML =
      '<span class="dot ' + dotCls + '"></span>' +
      '<div><div class="wa-hero-t">' + txt + '</div>' +
      '<div class="wa-hero-s">' + (d.connected
        ? 'Remitente: +' + (d.userPhone || 'sin numero')
        : (d.hasQr ? 'Escanea el QR para vincular' : 'Sin QR disponible')) + '</div></div>';
    document.getElementById('waGrid').innerHTML =
      '<div class="wa-card"><svg viewBox="0 0 24 24" stroke="' + col + '"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg><div class="wa-label">Estado</div><div class="wa-val" style="color:' + col + '">' + txt + '</div></div>' +
      '<div class="wa-card"><svg viewBox="0 0 24 24" stroke="var(--accent-2)"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg><div class="wa-label">Modo</div><div class="wa-val">' + (d.dryRun ? 'Demo' : 'Produccion') + '</div></div>' +
      '<div class="wa-card"><svg viewBox="0 0 24 24" stroke="var(--text-3)"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg><div class="wa-label">Remitente</div><div class="wa-val">' + (d.userPhone ? '+' + d.userPhone : 'No asignado') + '</div></div>' +
      '<div class="wa-card"><svg viewBox="0 0 24 24" stroke="var(--text-3)"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><rect x="7" y="7" width="3" height="3"/><rect x="14" y="7" width="3" height="3"/><rect x="7" y="14" width="3" height="3"/><rect x="14" y="14" width="3" height="3"/></svg><div class="wa-label">QR</div><div class="wa-val">' + (d.hasQr ? 'Disponible' : 'No') + '</div></div>';
    const qc = document.getElementById('waQr');
    if (!d.connected && d.hasQr) {
      qc.innerHTML =
        '<p style="color:var(--text-3);font-size:12px;margin-bottom:10px">Escanea con WhatsApp &rarr; Dispositivos vinculados &rarr; Vincular</p>' +
        '<div class="qr-box"><img id="qrImg" src="/api/whatsapp/qr?format=img" width="220" alt="QR de WhatsApp"></div>' +
        '<div style="margin-top:10px"><a href="/api/whatsapp/qr" target="_blank" class="btn btn-g btn-sm">Abrir pagina del QR</a></div>';
      document.getElementById('qrImg').onerror = function() {
        document.getElementById('waQr').innerHTML =
          '<p style="color:var(--text-3);font-size:12px;margin-top:10px">QR aun en generacion. <a href="/api/whatsapp/qr" target="_blank" style="color:var(--accent-2)">Abrir pagina</a></p>';
      };
    } else if (d.connected) {
      qc.innerHTML = '<p style="color:var(--green);font-size:13px;font-weight:600;margin-top:14px">WhatsApp conectado y operativo</p>';
    } else {
      qc.innerHTML = '<p style="color:var(--text-3);font-size:12px;margin-top:14px">Esperando generacion de QR...</p>';
    }
  } catch { document.getElementById('waGrid').innerHTML = '<div style="color:var(--rose)">Error al obtener estado</div>'; }
}
function rLine(k, v) {
  return '<div class="r-line"><span style="color:var(--text-4);width:96px;flex-shrink:0">' + k + '</span><span>' + v + '</span></div>';
}
async function testWA() {
  const num = document.getElementById('tNum').value.trim();
  if (!num) return toast('Escribe un numero');
  const btn = document.getElementById('tBtn');
  const res = document.getElementById('waRes');
  btn.disabled = true; btn.textContent = 'Enviando...';
  res.classList.remove('show'); res.innerHTML = '';
  try {
    const r = await fetch('/api/whatsapp/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ whatsapp: num })
    });
    const d = await r.json();
    let html = '';
    if (d.dryRun) {
      html = rLine('Modo', '<b style="color:var(--amber)">DEMO</b> no se envia') + rLine('Nota', d.error || '');
    } else {
      const stName = d.delivery || d.statusName || 'sin-estado';
      const map = { entregado:['var(--green)'], leido:['var(--green)'], recibido:['var(--green)'], pendiente:['var(--amber)'], error:['var(--rose)'] };
      const c = (map[stName] || ['var(--text-3)'])[0];
      if (d.onWhatsApp && typeof d.onWhatsApp.exists !== 'undefined') {
        html += rLine('En WhatsApp', d.onWhatsApp.exists ? '<b style="color:var(--green)">SI</b>' : '<b style="color:var(--rose)">NO</b>');
      }
      if (d.onWhatsApp && d.onWhatsApp.jid) html += rLine('JID', '<span style="font-size:11px">' + esc(d.onWhatsApp.jid) + '</span>');
      html += rLine('Enviado', d.sent ? '<b style="color:var(--green)">SI</b>' : '<b style="color:var(--rose)">NO</b>');
      html += rLine('Entrega', '<b style="color:' + c + '">' + esc(String(stName).toUpperCase()) + '</b>');
      if (d.timedOut) html += rLine('TimedOut', '<b style="color:var(--amber)">SI</b>');
      if (d.error) html += rLine('Error', esc(d.error));
    }
    res.innerHTML = html;
    res.classList.add('show');
  } catch (e) {
    res.innerHTML = rLine('Error', esc(e && e.message ? e.message : String(e)));
    res.classList.add('show');
  }
  btn.disabled = false;
  btn.textContent = 'Probar envio';
}

async function logoutWA() {
  if (!confirm('¿Seguro que deseas cerrar la sesion de WhatsApp y eliminar todas las credenciales/claves activas? Esto forzara la generacion de un nuevo codigo QR para volver a vincular.')) return;
  const btn = document.getElementById('waLogoutBtn');
  const oldText = btn.innerHTML;
  btn.disabled = true; btn.textContent = 'Cerrando sesion...';
  try {
    const r = await fetch('/api/admin/whatsapp/logout', { method: 'POST' });
    const d = await r.json();
    if (d.ok) {
      toast('Sesion de WhatsApp cerrada y limpiada con exito.');
      setTimeout(loadWA, 1500);
    } else {
      toast('Error: ' + d.error);
    }
  } catch (e) {
    toast('Error de conexion: ' + e.message);
  }
  btn.disabled = false;
  btn.innerHTML = oldText;
}

/* ── Config ── */
function isUrl(s) { return /^https?:\\/\\//.test(s || ''); }
async function loadCfg() {
  try {
    const r = await fetch('/api/admin/config');
    const { config: c } = await r.json();
    CFG_FRONT = c.frontendUrl || '';
    CFG_ITEMS = [
      { l: 'Premio', v: c.premio },
      { l: 'Fecha del sorteo', v: c.fechaSorteo || 'No definida' },
      { l: 'Modo', v: c.dryRun ? 'Demo (DRY RUN)' : 'Produccion' },
      { l: 'Frontend URL', v: c.frontendUrl },
      { l: 'Hoja del sheet', v: c.sheetName },
      { l: 'Apps Script', v: c.appsScriptUrl },
      { l: 'Numero WhatsApp', v: c.whatsappNumber }
    ];
    document.getElementById('cfgGrid').innerHTML = CFG_ITEMS.map(function(it, i) {
      return '<div class="cfg-item"><div class="cfg-txt"><div class="cfg-label">' + esc(it.l) + '</div>' +
        '<div class="cfg-val' + (isUrl(it.v) ? ' cfg-code' : '') + '">' + esc(it.v) + '</div></div>' +
        '<button class="copy-btn" title="Copiar" onclick="copyVal(' + i + ')"><svg viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></button></div>';
    }).join('');
  } catch { document.getElementById('cfgGrid').innerHTML = '<div style="color:var(--rose)">Error</div>'; }
}
function copyVal(i) {
  const v = CFG_ITEMS[i] && CFG_ITEMS[i].v;
  if (!v) return;
  navigator.clipboard.writeText(v)
    .then(function() { toast('Copiado: ' + v); })
    .catch(function() { toast('No se pudo copiar'); });
}

/* ── Sorteo Canvas ── */
const cv = document.getElementById('sorteoCanvas');
const cx = cv.getContext('2d');
let angle = 0, names = [], pool = [];
const COLS = ['#7C3AED', '#4F46E5', '#6D28D9', '#4338CA', '#8B5CF6', '#3730A3', '#5B21B6', '#3B0764'];

function drawWheel() {
  const w = cv.width, h = cv.height, mx = w / 2, my = h / 2, R = mx - 10;
  cx.clearRect(0, 0, w, h);
  if (!names.length) {
    cx.fillStyle = 'rgba(255,255,255,0.04)';
    cx.beginPath(); cx.arc(mx, my, R, 0, Math.PI * 2); cx.fill();
    cx.fillStyle = '#64748B'; cx.font = '14px Inter'; cx.textAlign = 'center';
    cx.fillText('Carga participantes', mx, my - 5);
    cx.fillText('para iniciar', mx, my + 16);
    return;
  }
  const sl = (Math.PI * 2) / names.length;
  names.forEach(function(n, i) {
    const s = angle + i * sl, e = s + sl;
    cx.beginPath(); cx.moveTo(mx, my); cx.arc(mx, my, R, s, e); cx.closePath();
    cx.fillStyle = COLS[i % COLS.length]; cx.fill();
    cx.strokeStyle = 'rgba(0,0,0,0.28)'; cx.lineWidth = 1.5; cx.stroke();
    cx.save(); cx.translate(mx, my); cx.rotate(s + sl / 2);
    cx.textAlign = 'right'; cx.fillStyle = '#fff';
    cx.font = 'bold ' + Math.min(12, 150 / names.length) + 'px Inter';
    cx.fillText(n.length > 13 ? n.slice(0, 11) + '...' : n, R - 12, 4);
    cx.restore();
  });
  cx.beginPath(); cx.arc(mx, my, 22, 0, Math.PI * 2);
  cx.fillStyle = '#06060b'; cx.fill();
  cx.strokeStyle = '#8B5CF6'; cx.lineWidth = 2.5; cx.stroke();
  cx.fillStyle = '#fff'; cx.font = 'bold 12px Inter'; cx.textAlign = 'center';
  cx.fillText('GO', mx, my + 4);
  cx.beginPath(); cx.moveTo(mx - 11, 3); cx.lineTo(mx + 11, 3); cx.lineTo(mx, 20);
  cx.closePath(); cx.fillStyle = '#FB7185'; cx.fill();
}

function updatePool() {
  const onlyOk = document.getElementById('onlyOk').checked;
  pool = REG.filter(function(r) {
    if (!r.folio) return false;
    if (selectedDates.length && !selectedDates.includes(r.fecha)) return false;
    if (!onlyOk) return true;
    const env = (r.enviado || '').toUpperCase();
    return env === 'SÍ' || env === 'SI';
  });
  names = pool.map(function(r) { return r.nombre || r.folio; });
  document.getElementById('poolCount').textContent = pool.length;
  drawWheel();
}

var currentWinner = null;
var winnersHistory = [];
var wheelLocked = false;
var WA_ICON = '<svg viewBox="0 0 24 24"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>';

function getOrdinal(n) {
  if (n === 1) return '1er';
  if (n === 2) return '2do';
  if (n === 3) return '3er';
  return n + 'to';
}

function getPlaceClass(n) {
  if (n === 1) return 'p1';
  if (n === 2) return 'p2';
  if (n === 3) return 'p3';
  return 'pn';
}

function toggleLock() {
  wheelLocked = !wheelLocked;
  var btn = document.getElementById('lockBtn');
  var sortBtn = document.getElementById('bSort');
  var badge = document.getElementById('wheelStatusBadge');
  if (wheelLocked) {
    sortBtn.disabled = true;
    btn.innerHTML = '<svg viewBox="0 0 24 24" style="width:14px;height:14px;stroke:currentColor;fill:none;stroke-width:2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 5-5v0a5 5 0 0 1 5 5v4"/></svg> <span>Habilitar</span>';
    if (badge) {
      badge.className = 'status-badge locked';
      badge.innerHTML = '<span class="status-dot"></span> Inhabilitada';
    }
    toast('Ruleta inhabilitada');
  } else {
    sortBtn.disabled = false;
    btn.innerHTML = '<svg viewBox="0 0 24 24" style="width:14px;height:14px;stroke:currentColor;fill:none;stroke-width:2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg> <span>Inhabilitar</span>';
    if (badge) {
      badge.className = 'status-badge ready';
      badge.innerHTML = '<span class="status-dot"></span> Lista para girar';
    }
    toast('Ruleta habilitada');
  }
}

function renderWinnersList() {
  var card = document.getElementById('winnersCard');
  var list = document.getElementById('winnersList');
  if (!winnersHistory.length) {
    card.style.display = 'none';
    return;
  }
  card.style.display = '';
  var html = '';
  for (var i = 0; i < winnersHistory.length; i++) {
    var w = winnersHistory[i];
    var place = i + 1;
    var cls = getPlaceClass(place);
    var ord = getOrdinal(place);
    var phone = w.whatsapp || '';
    var masked = phone.length >= 7 ? phone.slice(0, 3) + '****' + phone.slice(-2) : '*****';
    var notifyHtml = w.notified
      ? '<span class="winner-notify-status sent">Notificado</span>'
      : '<span class="winner-notify-status pending">Pendiente</span>';
    html += '<div class="winner-row">' +
      '<div class="winner-place ' + cls + '">' + ord + '</div>' +
      '<div class="winner-info">' +
        '<div class="winner-info-name">' + esc(w.nombre || 'Sin nombre') + '</div>' +
        '<div class="winner-info-details">Folio: ' + esc(w.folio || '--') + ' &middot; Tel: ' + esc(masked) + ' &middot; Cuenta: ' + esc(w.cuenta || '--') + '</div>' +
      '</div>' +
      notifyHtml +
    '</div>';
  }
  list.innerHTML = html;
}

function revealPhoneNumber() {
  document.getElementById('rWhatsAppMasked').style.display = 'none';
  document.getElementById('rWhatsAppFull').style.display = 'inline';
  document.getElementById('rRevealBtn').style.display = 'none';
}

function closeWinnerModal() {
  document.getElementById('winnerModal').style.display = 'none';
}

async function notifyWinner() {
  if (!currentWinner) return;
  var btn = document.getElementById('notifyBtn');
  btn.disabled = true;
  btn.textContent = 'Enviando...';
  
  try {
    var r = await fetch('/api/admin/sorteo/notificar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        whatsapp: currentWinner.whatsapp,
        nombre: currentWinner.nombre,
        esCliente: currentWinner.cuenta,
        folio: currentWinner.folio
      })
    });
    var d = await r.json();
    if (d.ok) {
      toast('🚀 ¡Ganador notificado con éxito!');
      btn.innerHTML = '✓ ¡Notificado con éxito!';
      currentWinner.notified = true;
      renderWinnersList();
    } else {
      toast('❌ Error: ' + d.error);
      btn.disabled = false;
      btn.innerHTML = WA_ICON + ' Reintentar notificar';
    }
  } catch (e) {
    toast('❌ Error de conexión: ' + e.message);
    btn.disabled = false;
    btn.innerHTML = WA_ICON + ' Reintentar notificar';
  }
}

async function spin() {
  if (spinning || wheelLocked) return;
  var btn = document.getElementById('bSort');
  btn.disabled = true;
  if (!REG.length) {
    try {
      var r = await fetch('/api/admin/registros');
      var d = await r.json();
      REG = d.data || [];
    } catch (e) {
      btn.disabled = false;
      return toast('Error al cargar participantes');
    }
  }
  var onlyOk = document.getElementById('onlyOk').checked;
  pool = REG.filter(function(r) {
    if (!r.folio) return false;
    if (selectedDates.length && !selectedDates.includes(r.fecha)) return false;
    if (!onlyOk) return true;
    var env = (r.enviado || '').toUpperCase();
    return env === 'SÍ' || env === 'SI';
  });
  if (!pool.length) {
    btn.disabled = false;
    return toast('No hay participantes en el pool');
  }
  names = pool.map(function(r) { return r.nombre || r.folio; });
  spinning = true;
  var badge = document.getElementById('wheelStatusBadge');
  if (badge) {
    badge.className = 'status-badge spinning';
    badge.innerHTML = '<span class="status-dot"></span> Girando ruleta...';
  }
  document.getElementById('winnerModal').style.display = 'none';
  var t0 = Date.now(), dur = 5000, a0 = angle;
  var total = Math.PI * 2 * (8 + Math.random() * 6);
  (function frame() {
    var p = Math.min((Date.now() - t0) / dur, 1);
    angle = a0 + total * (1 - Math.pow(1 - p, 3));
    drawWheel();
    if (p < 1) return requestAnimationFrame(frame);
    var sl = (Math.PI * 2) / names.length;
    var norm = (1.5 * Math.PI - (angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    var wi = Math.floor(norm / sl) % names.length;
    var w = pool[wi];
    
    w.notified = false;
    currentWinner = w;
    winnersHistory.push(w);
    
    var placeNum = winnersHistory.length;
    document.getElementById('rBadge').textContent = '★ ' + getOrdinal(placeNum).toUpperCase() + ' LUGAR ★';
    document.getElementById('rPre').textContent = getOrdinal(placeNum).toUpperCase() + ' LUGAR — GANADOR';
    document.getElementById('rName').textContent = w.nombre || 'Sin nombre';
    document.getElementById('rFolio').textContent = w.folio || '--';
    
    var phone = w.whatsapp || '';
    var masked = '';
    if (phone.length >= 7) {
      masked = phone.slice(0, 5) + '****' + phone.slice(-3);
    } else {
      masked = '*****';
    }
    document.getElementById('rWhatsAppMasked').textContent = masked;
    document.getElementById('rWhatsAppMasked').className = 'detail-val masked';
    document.getElementById('rWhatsAppMasked').style.display = 'inline';
    document.getElementById('rWhatsAppFull').textContent = phone;
    document.getElementById('rWhatsAppFull').style.display = 'none';
    document.getElementById('rRevealBtn').style.display = 'inline-flex';
    
    document.getElementById('rCuenta').textContent = w.cuenta || 'No cliente';
    
    var notifyBtn = document.getElementById('notifyBtn');
    notifyBtn.disabled = false;
    notifyBtn.innerHTML = WA_ICON + ' Notificar por WhatsApp';
    
    if (badge) {
      badge.className = 'status-badge ready';
      badge.innerHTML = '<span class="status-dot"></span> Lista para girar';
    }

    document.getElementById('winnerModal').style.display = 'flex';
    burstConfetti();
    renderWinnersList();
    btn.disabled = false;
    spinning = false;
  })();
}

function resetWheel() {
  if (winnersHistory.length && !confirm('¿Seguro? Se borrará el historial de ganadores.')) return;
  spinning = false; angle = 0; names = []; pool = [];
  document.getElementById('winnerModal').style.display = 'none';
  document.getElementById('bSort').disabled = wheelLocked;
  currentWinner = null;
  winnersHistory = [];
  renderWinnersList();
  drawWheel();
  updatePool();
}
document.getElementById('onlyOk').addEventListener('change', updatePool);

/* ── Confetti ── */
let confCv = null, confCx = null;
function burstConfetti() {
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  confCv = confCv || document.getElementById('confetti');
  confCx = confCx || confCv.getContext('2d');
  
  confCv.width = window.innerWidth;
  confCv.height = window.innerHeight;
  
  const colors = ['#8B5CF6', '#A78BFA', '#C4B5FD', '#F8FAFC', '#4C1D95', '#7C3AED', '#FF007F', '#00F0FF', '#FFD700'];
  const parts = [];
  
  // 1. Cañón Izquierdo (Dispara hacia arriba y derecha)
  for (let k = 0; k < 120; k++) {
    parts.push({
      x: 0,
      y: window.innerHeight,
      vx: Math.random() * 18 + 5,
      vy: -(Math.random() * 22 + 10),
      s: 5 + Math.random() * 7,
      c: colors[Math.floor(Math.random() * colors.length)],
      r: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.4,
      life: 0,
      maxLife: 150 + Math.random() * 100
    });
  }
  
  // 2. Cañón Derecho (Dispara hacia arriba e izquierda)
  for (let k = 0; k < 120; k++) {
    parts.push({
      x: window.innerWidth,
      y: window.innerHeight,
      vx: -(Math.random() * 18 + 5),
      vy: -(Math.random() * 22 + 10),
      s: 5 + Math.random() * 7,
      c: colors[Math.floor(Math.random() * colors.length)],
      r: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.4,
      life: 0,
      maxLife: 150 + Math.random() * 100
    });
  }

  // 3. Explosión Central (En el medio)
  for (let k = 0; k < 100; k++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = Math.random() * 14 + 2;
    parts.push({
      x: window.innerWidth / 2,
      y: window.innerHeight * 0.4,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 4,
      s: 4 + Math.random() * 5,
      c: colors[Math.floor(Math.random() * colors.length)],
      r: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.3,
      life: 0,
      maxLife: 120 + Math.random() * 80
    });
  }
  
  (function step() {
    confCx.clearRect(0, 0, confCv.width, confCv.height);
    let alive = false;
    
    parts.forEach(function(p) {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.22; // Gravedad
      p.vx *= 0.975; // Resistencia
      p.r += p.vr;
      p.life++;
      
      if (p.y < confCv.height + 20 && p.life < p.maxLife) {
        alive = true;
        confCx.save();
        confCx.translate(p.x, p.y);
        confCx.rotate(p.r);
        confCx.fillStyle = p.c;
        confCx.fillRect(-p.s / 2, -p.s / 2, p.s, p.s * 0.65);
        confCx.restore();
      }
    });
    
    if (alive) {
      requestAnimationFrame(step);
    } else {
      confCx.clearRect(0, 0, confCv.width, confCv.height);
    }
  })();
}

/* ── Status pills ── */
async function pollStatus() {
  try {
    const r = await fetch('/api/health');
    const d = await r.json();
    const wd = document.getElementById('wDot'), wl = document.getElementById('wLbl');
    const sd = document.getElementById('sDot'), sl = document.getElementById('sLbl');
    if (d.whatsapp && d.whatsapp.connected) { wd.className = 'dot dot-g'; wl.textContent = 'WhatsApp'; }
    else if (d.whatsapp && d.whatsapp.connecting) { wd.className = 'dot dot-y'; wl.textContent = 'Conectando'; }
    else { wd.className = 'dot dot-r'; wl.textContent = 'Desconectado'; }
    sd.className = d.sheets ? 'dot dot-g' : 'dot dot-r';
    sl.textContent = d.sheets ? 'Sheets' : 'Sheets off';
  } catch (e) {}
}

/* ── Init ── */
loadDash();
pollStatus();
drawWheel();
ensureReg().then(updatePool);
fetch('/api/admin/config')
  .then(function(r) { return r.json(); })
  .then(function(d) { if (d && d.config) CFG_FRONT = d.config.frontendUrl || ''; })
  .catch(function() {});
setInterval(pollStatus, 10000);
</script>
</body>
</html>`;

export default router;
