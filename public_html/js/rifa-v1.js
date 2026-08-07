/* ═══════════════════════════════════════════════════════
   SORTEO TOTAL FENAPO 2026 — lógica del modal de registro
   ═══════════════════════════════════════════════════════ */
(function () {
    'use strict';

    var API_BASE = (document.currentScript && document.currentScript.dataset.api) || window.location.origin;

    var REGISTRO_KEY = 'tp_rifa_registro';
    var VISTO_KEY = 'tp_rifa_visto';

    var modal, steps;
    var configData = { premio: 'A definir', fechaSorteo: '', dryRun: false };
    var pendingWhatsapp = '';
    var resendInterval = null;
    var countdownInterval = null;
    var celebrationMode = 'nuevo'; // 'nuevo' | 'yaRegistrado'

    var $ = function (id) { return document.getElementById(id); };

    /* ── Config ───────────────────────────────────────── */
    async function loadConfig() {
        try {
            var res = await fetch(API_BASE + '/api/config');
            var data = await res.json();
            if (data && data.premio) configData = data;
        } catch (e) {
            console.warn('[rifa] No se pudo leer config del backend:', e);
        }
        $('rifa-prize').textContent = configData.premio || 'A definir';
        var bannerPrize = $('rifa-banner-prize');
        if (bannerPrize) bannerPrize.textContent = configData.premio || 'Premio a definir';
    }

    /* ── Modal / pasos ────────────────────────────────── */
    function openModal() {
        if (!modal) return;
        modal.classList.add('rifa-open');
        modal.setAttribute('aria-hidden', 'false');
        document.body.classList.add('rifa-modal-open');
    }

    function closeModal() {
        if (!modal) return;
        modal.classList.remove('rifa-open');
        modal.setAttribute('aria-hidden', 'true');
        document.body.classList.remove('rifa-modal-open');
        clearInterval(resendInterval);
        clearInterval(countdownInterval);
    }

    function goStep(n) {
        steps.forEach(function (s) { s.classList.toggle('rifa-step-active', s.dataset.rifaStep === String(n)); });
    }

    function startResendTimer(seconds) {
        var btn = $('rifa-resend-btn');
        var count = $('rifa-resend-countdown');
        clearInterval(resendInterval);
        function tick() {
            btn.disabled = true;
            if (count) count.textContent = ' (' + seconds + 's)';
            if (seconds <= 0) {
                clearInterval(resendInterval);
                btn.disabled = false;
                if (count) count.textContent = '';
            }
            seconds -= 1;
        }
        tick();
        resendInterval = setInterval(tick, 1000);
    }

    /* ── Formulario ───────────────────────────────────── */
    function isCliente() {
        var checked = document.querySelector('input[name="rifa-cliente"]:checked');
        return checked ? checked.value === 'si' : false;
    }

    function toggleCuentaField() {
        var group = $('rifa-cuenta-group');
        if (!group) return;
        if (isCliente()) {
            group.classList.remove('rifa-hidden');
            $('rifa-tip-cliente').textContent = '¡Genial! Los clientes tienen preferencia en los mejores premios. 💜';
        } else {
            group.classList.add('rifa-hidden');
            $('rifa-cuenta').value = '';
            $('rifa-tip-cliente').textContent = 'Durante el sorteo se dará preferencia a los boletos de clientes para los mejores premios. 💜';
        }
    }

    function markError(input) {
        input.classList.add('rifa-input-error');
        setTimeout(function () { input.classList.remove('rifa-input-error'); }, 2200);
    }

    function setFormError(msg) {
        var el = $('rifa-form-err');
        if (el) el.textContent = msg || '';
    }

    function validateForm() {
        var nombre = $('rifa-nombre').value.trim();
        var whatsapp = $('rifa-whatsapp').value.replace(/\D/g, '');
        var email = $('rifa-email').value.trim();
        var cuenta = $('rifa-cuenta').value.trim();
        var accept = $('rifa-accept').checked;

        if (!nombre) { markError($('rifa-nombre')); setFormError('Escribe tu nombre completo.'); return null; }
        if (isCliente()) {
            if (!/^\d{6,20}$/.test(cuenta)) { markError($('rifa-cuenta')); setFormError('Escribe tu número de cuenta.'); return null; }
        }
        if (!/^\d{10}$/.test(whatsapp)) { markError($('rifa-whatsapp')); setFormError('WhatsApp debe tener 10 dígitos.'); return null; }
        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { markError($('rifa-email')); setFormError('Correo no válido (puedes dejarlo vacío).'); return null; }
        if (!accept) { setFormError('Acepta las bases y el aviso de privacidad.'); return null; }

        setFormError('');
        return { nombre: nombre, esCliente: isCliente() ? 'si' : 'no', cuenta: cuenta, whatsapp: whatsapp, email: email };
    }

    function setCtaLoading(btn, loading, text) {
        if (!btn) return;
        if (loading) {
            btn.dataset.originalHtml = btn.innerHTML;
            btn.disabled = true;
            btn.innerHTML = '<span class="rifa-spinner"></span> ' + text;
        } else {
            btn.disabled = false;
            if (btn.dataset.originalHtml) btn.innerHTML = btn.dataset.originalHtml;
        }
    }

    async function enviarCodigo() {
        var data = validateForm();
        if (!data) return;
        pendingWhatsapp = data.whatsapp;

        var btn = $('rifa-btn-codigo');
        setCtaLoading(btn, true, 'Enviando código…');
        setFormError('');

        try {
            var res = await fetch(API_BASE + '/api/enviar-codigo', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ whatsapp: data.whatsapp })
            });
            var json = await res.json();

            if (json.yaRegistrado) {
                showCelebration({
                    modo: 'yaRegistrado',
                    folio: json.folio,
                    nombre: json.nombre,
                    whatsapp: pendingWhatsapp,
                    fecha: json.fecha
                });
                return;
            }

            if (!res.ok || !json.ok) {
                throw new Error(json.error || 'No pudimos enviar el código.');
            }

            $('rifa-otp-demo-hint').style.display = (configData.dryRun || json.dryRun) ? 'block' : 'none';
            resetOtpInputs();
            goStep(3);
            startResendTimer(60);
            $('rifa-otp-err').textContent = '';
            $('rifa-otp-box').querySelector('input').focus();
        } catch (err) {
            setFormError(err.message || 'Ocurrió un error. Intenta de nuevo.');
        } finally {
            setCtaLoading(btn, false);
        }
    }

    async function confirmarRegistro() {
        var otp = Array.prototype.map.call(
            document.querySelectorAll('#rifa-otp-box input'),
            function (i) { return i.value; }
        ).join('');

        if (otp.length < 6) {
            $('rifa-otp-err').textContent = 'Escribe el código de 6 dígitos.';
            return;
        }

        var formData = validateForm();
        if (!formData) return;

        var btn = $('rifa-btn-confirmar');
        setCtaLoading(btn, true, 'Generando tu boleto…');
        $('rifa-otp-err').textContent = '';

        try {
            var res = await fetch(API_BASE + '/api/registro', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    nombre: formData.nombre,
                    esCliente: formData.esCliente,
                    cuenta: formData.cuenta,
                    whatsapp: formData.whatsapp,
                    email: formData.email,
                    otp: otp,
                    origen: 'Landing Index'
                })
            });
            var json = await res.json();

            if (json.yaRegistrado) {
                showCelebration({
                    modo: 'yaRegistrado',
                    folio: json.folio,
                    nombre: json.nombre,
                    whatsapp: pendingWhatsapp,
                    fecha: json.fecha
                });
                return;
            }

            if (!res.ok || !json.ok) {
                throw new Error(json.error || 'No pudimos completar el registro.');
            }

            saveRegistro({ folio: json.folio, nombre: json.nombre, whatsapp: formData.whatsapp, fecha: json.fecha || '' });
            showCelebration({ modo: 'nuevo', folio: json.folio, nombre: json.nombre, whatsapp: formData.whatsapp });
        } catch (err) {
            $('rifa-otp-err').textContent = err.message || 'Ocurrió un error. Intenta de nuevo.';
        } finally {
            setCtaLoading(btn, false);
        }
    }

    /* ── OTP inputs ───────────────────────────────────── */
    function resetOtpInputs() {
        document.querySelectorAll('#rifa-otp-box input').forEach(function (i) {
            i.value = '';
            i.classList.remove('rifa-otp-fill');
        });
    }

    function setupOtpBox() {
        var box = $('rifa-otp-box');
        if (!box) return;
        for (var n = 0; n < 6; n++) {
            var input = document.createElement('input');
            input.type = 'text';
            input.inputMode = 'numeric';
            input.maxLength = 1;
            input.setAttribute('aria-label', 'Dígito ' + (n + 1));
            box.appendChild(input);
        }

        box.addEventListener('input', function (e) {
            var t = e.target;
            if (t.tagName !== 'INPUT') return;
            var v = t.value.replace(/\D/g, '');
            t.value = v;
            t.classList.toggle('rifa-otp-fill', v.length === 1);
            if (v.length === 1) {
                var next = t.nextElementSibling;
                if (next) next.focus();
            }
            $('rifa-otp-err').textContent = '';
        });

        box.addEventListener('keydown', function (e) {
            var t = e.target;
            if (t.tagName !== 'INPUT') return;
            if (e.key === 'Backspace' && !t.value) {
                var prev = t.previousElementSibling;
                if (prev) prev.focus();
            }
        });

        box.addEventListener('paste', function (e) {
            e.preventDefault();
            var text = (e.clipboardData || window.clipboardData).getData('text').replace(/\D/g, '');
            var inputs = box.querySelectorAll('input');
            for (var i = 0; i < inputs.length && i < text.length; i++) {
                inputs[i].value = text[i];
                inputs[i].classList.add('rifa-otp-fill');
            }
            inputs[Math.min(text.length, inputs.length - 1)].focus();
        });
    }

    /* ── Celebración ──────────────────────────────────── */
    function saveRegistro(data) {
        var list = getRegistros();
        list[data.folio] = { folio: data.folio, nombre: data.nombre, whatsapp: data.whatsapp, fecha: data.fecha, ts: Date.now() };
        localStorage.setItem(REGISTRO_KEY, JSON.stringify(list));
        if (window.VipGreeting) window.VipGreeting.refresh();
    }

    function getRegistros() {
        try { return JSON.parse(localStorage.getItem(REGISTRO_KEY) || '{}'); }
        catch (e) { return {}; }
    }

    function getRegistroByFolio(folio) {
        var list = getRegistros();
        return list[folio] || null;
    }

    function showCelebration(opts) {
        celebrationMode = opts.modo || 'nuevo';
        pendingWhatsapp = opts.whatsapp || '';

        if (opts.folio) saveRegistro({ folio: opts.folio, nombre: opts.nombre, whatsapp: opts.whatsapp, fecha: opts.fecha });

        var elFolio = $('rifa-folio');
        if (elFolio) elFolio.textContent = opts.folio || 'TPF2026-XXXXXX';

        var elNombre = $('rifa-ticket-nombre');
        if (elNombre) elNombre.textContent = opts.nombre || 'Participante';

        var elPremio = $('rifa-ticket-premio');
        if (elPremio) elPremio.textContent = configData.premio || 'A definir';

        var elFecha = $('rifa-ticket-fecha');
        if (elFecha) elFecha.textContent = configData.fechaSorteo ? formatFecha(configData.fechaSorteo) : 'Próximamente';

        var elGreeting = $('rifa-greeting');
        if (elGreeting) {
            elGreeting.textContent = (celebrationMode === 'yaRegistrado')
                ? '¡Ya estás participando!'
                : '¡Participación confirmada!';
        }

        var nota = $('rifa-celebr-note');
        if (nota) {
            nota.textContent = (celebrationMode === 'yaRegistrado')
                ? 'Ya te habías registrado para el SORTEO TOTAL FENAPO 2026. Aquí está tu boleto. 🎫'
                : 'Revisa tu WhatsApp: te enviamos tu folio y boleto digital. 🎫';
        }

        renderQr(opts.folio || 'TPF2026-XXXXXX');
        setupCountdown(configData.fechaSorteo);

        goStep(4);
        setTimeout(fireConfetti, 350);
    }

    function formatFecha(iso) {
        var parts = String(iso).split('-');
        if (parts.length !== 3) return iso;
        var meses = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];
        var d = Number(parts[2]);
        var m = Number(parts[1]) - 1;
        return d + ' ' + (meses[m] || parts[1]) + ' ' + parts[0];
    }

    function renderQr(data) {
        var canvas = $('rifa-qr');
        if (!canvas) {
            // Si el canvas ya fue reemplazado por una imagen en un clic anterior, actualizamos su src
            var img = document.querySelector('.rifa-ticket-qr img');
            if (img) {
                img.src = 'https://api.qrserver.com/v1/create-qr-code/?size=140x140&margin=8&data=' + encodeURIComponent(data);
            }
            return;
        }
        if (window.QRCode) {
            try {
                QRCode.toCanvas(canvas, data, { width: 140, height: 140, margin: 1 });
                return;
            } catch (e) { /* fallback abajo */ }
        }
        
        // MODIFICACIÓN DE SEGURIDAD: Reemplazar solo el canvas, no borrar todo el innerHTML de su padre.
        // Esto previene que se borre el div con el ID "rifa-ticket-fecha" que está al lado.
        var fallbackImg = document.createElement('img');
        fallbackImg.src = 'https://api.qrserver.com/v1/create-qr-code/?size=140x140&margin=8&data=' + encodeURIComponent(data);
        fallbackImg.alt = 'Código QR del boleto';
        fallbackImg.style.width = '120px';
        fallbackImg.style.height = '120px';
        fallbackImg.style.borderRadius = '12px';
        canvas.replaceWith(fallbackImg);
    }

    function setupCountdown(fechaIso) {
        var wrap = $('rifa-countdown');
        if (!wrap) return;
        clearInterval(countdownInterval);
        if (!fechaIso) {
            wrap.style.display = 'none';
            return;
        }
        var target = new Date(fechaIso + 'T23:59:59');
        if (isNaN(target.getTime())) { wrap.style.display = 'none'; return; }
        wrap.style.display = 'block';
        var diasEl = $('rifa-cd-dias'), horasEl = $('rifa-cd-horas'), minsEl = $('rifa-cd-mins'), secsEl = $('rifa-cd-secs');
        function tick() {
            var diff = Math.max(0, target.getTime() - Date.now());
            var s = Math.floor(diff / 1000);
            diasEl.textContent = pad(Math.floor(s / 86400));
            horasEl.textContent = pad(Math.floor((s % 86400) / 3600));
            minsEl.textContent = pad(Math.floor((s % 3600) / 60));
            secsEl.textContent = pad(s % 60);
        }
        tick();
        countdownInterval = setInterval(tick, 1000);
    }

    function pad(n) { return String(n).padStart(2, '0'); }

    function fireConfetti() {
        if (!window.confetti) return;
        var burst = function (x, angle) {
            confetti({
                particleCount: 90,
                spread: 70,
                origin: { x: x, y: 0.3 },
                angle: angle,
                colors: ['#7C3AED', '#d94389', '#ffd166', '#ffffff'],
                disableForReducedMotion: true
            });
        };
        burst(0.5, 90);
        setTimeout(function () { burst(0.3, 60); }, 250);
        setTimeout(function () { burst(0.7, 120); }, 500);
        setTimeout(function () {
            confetti({ particleCount: 120, spread: 100, origin: { x: 0.5, y: 0.4 }, disableForReducedMotion: true });
        }, 800);
    }

    /* ── Acciones del ticket ──────────────────────────── */
    function downloadTicketImage() {
        var ticketEl = document.getElementById('rifa-ticket');
        if (!ticketEl) return;
        var btn = $('rifa-btn-download-img');
        if (btn) btn.disabled = true;

        if (window.html2canvas) {
            html2canvas(ticketEl, {
                scale: 3,
                useCORS: true,
                backgroundColor: null,
                logging: false
            }).then(function (canvas) {
                var link = document.createElement('a');
                var folio = ($('rifa-folio')?.textContent || 'boleto').trim();
                link.download = 'Boleto_Totalplay_' + folio + '.png';
                link.href = canvas.toDataURL('image/png');
                link.click();
                if (btn) btn.disabled = false;
            }).catch(function (err) {
                console.warn('Error al generar imagen:', err);
                if (btn) btn.disabled = false;
                printTicket();
            });
        } else {
            if (btn) btn.disabled = false;
            printTicket();
        }
    }

    function printTicket() {
        var folio = ($('rifa-folio')?.textContent || 'TPF2026-XXXXXX').trim();
        var nombre = ($('rifa-ticket-nombre')?.textContent || '—').trim();
        var premio = ($('rifa-ticket-premio')?.textContent || 'A definir').trim();
        var fecha = ($('rifa-ticket-fecha')?.textContent || 'Próximamente').trim();
        var qrCanvas = $('rifa-qr');
        var qrDataUrl = qrCanvas ? qrCanvas.toDataURL('image/png') : ('https://api.qrserver.com/v1/create-qr-code/?size=180x180&margin=4&data=' + encodeURIComponent(folio));
        var logoUrl = window.location.origin + window.location.pathname.replace(/\/[^\/]*$/, '/') + 'logos_total/logo total png (1)-1.png';

        var w = window.open('', '_blank', 'width=520,height=800');
        if (!w) return alert('Permite ventanas emergentes para imprimir tu boleto.');

        w.document.write(
            '<!DOCTYPE html><html><head><title>Boleto ' + folio + '</title>' +
            '<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800;900&display=swap" rel="stylesheet">' +
            '<style>' +
            '@page { size: portrait; margin: 10mm; }' +
            '* { box-sizing: border-box; margin: 0; padding: 0; }' +
            'body { font-family: "Inter", system-ui, sans-serif; background: #0f0d1b; display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 24px; color: #fff; }' +
            '.ticket-card { width: 360px; background: #ffffff; border-radius: 24px; overflow: hidden; box-shadow: 0 25px 60px rgba(0,0,0,0.5); color: #1e1b2e; position: relative; }' +
            '.ticket-top { background: linear-gradient(135deg, #7C3AED 0%, #D946EF 100%); padding: 18px 20px; display: flex; align-items: center; justify-content: space-between; color: #fff; }' +
            '.ticket-top img { height: 26px; filter: brightness(0) invert(1); }' +
            '.ticket-top-text { text-align: right; }' +
            '.ticket-top-text b { display: block; font-size: 11px; letter-spacing: 0.06em; text-transform: uppercase; font-weight: 900; }' +
            '.ticket-top-text span { font-size: 9px; opacity: 0.85; font-weight: 700; letter-spacing: 0.1em; }' +
            '.ticket-body { padding: 22px 20px 14px; text-align: center; }' +
            '.ticket-folio-label { font-size: 10px; font-weight: 900; letter-spacing: 0.2em; color: #8B5CF6; text-transform: uppercase; }' +
            '.ticket-folio-val { font-size: 26px; font-weight: 900; color: #7C3AED; margin-top: 2px; font-family: monospace; letter-spacing: 0.05em; }' +
            '.info-grid { background: rgba(124, 58, 237, 0.05); border: 1px solid rgba(124, 58, 237, 0.15); border-radius: 16px; padding: 14px 16px; margin-top: 16px; text-align: left; display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }' +
            '.info-item-full { grid-column: span 2; }' +
            '.info-item span { display: block; font-size: 9px; font-weight: 800; letter-spacing: 0.12em; color: #8a81a8; text-transform: uppercase; }' +
            '.info-item b { display: block; font-size: 13px; font-weight: 800; color: #1e1b2e; margin-top: 2px; }' +
            '.perf-wrap { position: relative; height: 20px; display: flex; align-items: center; justify-content: center; margin: 4px 0; }' +
            '.perf-line { width: 100%; border-top: 2px dashed rgba(124, 58, 237, 0.25); }' +
            '.notch-l, .notch-r { position: absolute; width: 20px; height: 20px; background: #0f0d1b; border-radius: 50%; top: 50%; transform: translateY(-50%); }' +
            '.notch-l { left: -10px; } .notch-r { right: -10px; }' +
            '.ticket-stub { background: #fafafe; padding: 16px 20px 22px; text-align: center; display: flex; flex-direction: column; align-items: center; }' +
            '.qr-box { background: #fff; padding: 10px; border-radius: 16px; border: 1px solid rgba(124, 58, 237, 0.15); box-shadow: 0 4px 12px rgba(0,0,0,0.05); }' +
            '.qr-box img { width: 150px; height: 150px; display: block; }' +
            '.stub-note { font-size: 10px; font-weight: 800; color: #8a81a8; letter-spacing: 0.15em; margin-top: 12px; text-transform: uppercase; }' +
            '@media print { body { background: #ffffff !important; padding: 0 !important; } .notch-l, .notch-r { background: #ffffff !important; } .ticket-card { box-shadow: none !important; border: 1px solid #ddd !important; margin: 0 auto; } }' +
            '</style></head><body>' +
            '<div class="ticket-card">' +
            '<div class="ticket-top">' +
            '<img src="' + logoUrl + '" alt="Totalplay">' +
            '<div class="ticket-top-text"><b>SORTEO TOTAL FENAPO 2026</b><span>BOLETO DIGITAL</span></div>' +
            '</div>' +
            '<div class="ticket-body">' +
            '<div class="ticket-folio-label">TU FOLIO</div>' +
            '<div class="ticket-folio-val">' + folio + '</div>' +
            '<div class="info-grid">' +
            '<div class="info-item info-item-full"><span>PARTICIPANTE</span><b>' + nombre + '</b></div>' +
            '<div class="info-item"><span>PREMIO</span><b>' + premio + '</b></div>' +
            '<div class="info-item"><span>DÍA DEL SORTEO</span><b>' + fecha + '</b></div>' +
            '</div>' +
            '</div>' +
            '<div class="perf-wrap"><div class="notch-l"></div><div class="perf-line"></div><div class="notch-r"></div></div>' +
            '<div class="ticket-stub">' +
            '<div class="qr-box"><img src="' + qrDataUrl + '" alt="QR"></div>' +
            '<div class="stub-note">SORTEO TOTALPLAY FENAPO 2026</div>' +
            '</div>' +
            '</div>' +
            '</body></html>'
        );
        w.document.close();
        setTimeout(function () { w.focus(); w.print(); }, 400);
    }

    function shareTicket() {
        var folio = $('rifa-folio').textContent;
        var nombre = $('rifa-ticket-nombre').textContent;
        var text = '🎫 ¡Ya participo en el SORTEO TOTAL FENAPO 2026!\n\nMi folio: ' + folio + '\n' + nombre + '\n\n¿Y tú? ¡Regístrate y participa!';
        window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank', 'noopener');
    }

    /* ── Inicialización ───────────────────────────────── */
    function init() {
        modal = $('rifa-modal');
        steps = document.querySelectorAll('#rifa-modal [data-rifa-step]');
        if (!modal || !steps.length) return;

        loadConfig();
        setupOtpBox();

        // CTA + apertura
        document.querySelectorAll('[data-rifa-modal]').forEach(function (el) {
            el.addEventListener('click', function (e) {
                e.preventDefault();
                var registro = getRegistros();
                var folios = Object.keys(registro);
                if (folios.length) {
                    showCelebration({ modo: 'yaRegistrado', folio: folios[0], nombre: registro[folios[0]].nombre, whatsapp: registro[folios[0]].whatsapp, fecha: registro[folios[0]].fecha });
                } else {
                    goStep(1);
                }
                openModal();
            });
        });

        document.querySelectorAll('[data-rifa-close]').forEach(function (el) {
            el.addEventListener('click', closeModal);
        });

        document.querySelectorAll('[data-rifa-back]').forEach(function (el) {
            el.addEventListener('click', function () { goStep(2); });
        });

        document.querySelectorAll('[data-rifa-start]').forEach(function (el) {
            el.addEventListener('click', function () {
                if (window.RifaMisiones && !window.RifaMisiones.isUnlocked()) return;
                goStep(2);
            });
        });

        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && modal.classList.contains('rifa-open')) closeModal();
        });

        // Formulario
        document.querySelectorAll('input[name="rifa-cliente"]').forEach(function (r) {
            r.addEventListener('change', toggleCuentaField);
        });
        toggleCuentaField();

        var form = $('rifa-form');
        if (form) form.addEventListener('submit', function (e) { e.preventDefault(); enviarCodigo(); });

        var confirmar = $('rifa-btn-confirmar');
        if (confirmar) confirmar.addEventListener('click', confirmarRegistro);

        var resendBtn = $('rifa-resend-btn');
        if (resendBtn) resendBtn.addEventListener('click', enviarCodigo);

        var dlImgBtn = $('rifa-btn-download-img');
        if (dlImgBtn) dlImgBtn.addEventListener('click', downloadTicketImage);

        var printBtn = $('rifa-btn-print');
        if (printBtn) printBtn.addEventListener('click', printTicket);

        var shareBtn = $('rifa-btn-share');
        if (shareBtn) shareBtn.addEventListener('click', shareTicket);

        // Apertura automática la primera vez de la sesión
        var ticketParam = new URLSearchParams(window.location.search).get('ticket');
        if (ticketParam) {
            var reg = getRegistroByFolio(ticketParam);
            showCelebration({ modo: 'yaRegistrado', folio: ticketParam, nombre: reg ? reg.nombre : '', whatsapp: reg ? reg.whatsapp : '', fecha: reg ? reg.fecha : '' });
            openModal();
        } else if (!sessionStorage.getItem(VISTO_KEY)) {
            sessionStorage.setItem(VISTO_KEY, '1');
            setTimeout(function () {
                var registro = getRegistros();
                var folios = Object.keys(registro);
                if (folios.length) {
                    showCelebration({ modo: 'yaRegistrado', folio: folios[0], nombre: registro[folios[0]].nombre, whatsapp: registro[folios[0]].whatsapp, fecha: registro[folios[0]].fecha });
                } else {
                    goStep(1);
                }
                openModal();
            }, 1200);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
