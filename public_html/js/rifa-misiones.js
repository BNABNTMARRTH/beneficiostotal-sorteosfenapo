/* ═══════════════════════════════════════════════════════
   SORTEO TOTAL FENAPO 2026 — Misiones de desbloqueo
   Completa las acciones para desbloquear el registro.
   ═══════════════════════════════════════════════════════ */
(function () {
    'use strict';

    var KEY = 'tp_rifa_misiones';
    var REGISTRO_KEY = 'tp_rifa_registro';

    var ACTIONS = [
        { id: 'whatsapp_wicho', mission: 1, icon: '💬', label: 'Saluda al asistente en WhatsApp' },
        { id: 'tut_like', mission: 2, icon: '🎓', label: 'Aprende: Cómo usar la página de beneficios' },
        { id: 'event_like', mission: 3, icon: '📅', label: 'Dale me gusta a un evento' }
        // ── Misiones anteriores deshabilitadas (respaldo) ──
        // { id: 'pdf', mission: 1, icon: '📄', label: 'Descarga el PDF de referencias de pago' },
        // { id: 'beneficios', mission: 1, icon: '💜', label: 'Conoce tus beneficios' },
        // { id: 'compartir', mission: 1, icon: '📤', label: 'Comparte la página por WhatsApp' },
        // { id: 'tiktok', mission: 1, icon: '🎵', label: 'Sigue la página de TikTok' },
        // { id: 'facebook', mission: 1, icon: '👍', label: 'Sigue la página de Facebook' },
        // { id: 'app', mission: 2, icon: '📱', label: 'Descarga la app Totalplay' },
        // { id: 'tut_form', mission: 3, icon: '📝', label: 'Envía un formulario de asesoría o sugerencia' }
    ];

    var MISSION_NAMES = {
        1: 'Conéctate en WhatsApp',
        2: 'Aprende con tutoriales',
        3: 'Conoce los eventos'
    };

    var MOTIVATIONAL_MESSAGES = {
        0: '¡Comienza tus misiones para ganar tu boleto ahora mismo! ✨',
        1: '¡Excelente inicio! Llevas 1 de 3 misiones completadas. 🚀',
        2: '¡Casi listo! Solo te falta 1 misión para tu boleto. 🔥',
        3: '¡Todo completado! Registra tu boleto de inmediato. 🎉'
    };

    var TOTAL = ACTIONS.length;
    var celebrated = false;

    function load() {
        try { return JSON.parse(localStorage.getItem(KEY) || '{}'); }
        catch (e) { return {}; }
    }

    function save(data) {
        try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { /* noop */ }
    }

    function completedCount() {
        var d = load();
        var n = 0;
        ACTIONS.forEach(function (a) { if (d[a.id]) n++; });
        return n;
    }

    function progress() {
        return Math.round(completedCount() / TOTAL * 100);
    }

    function isUnlocked() {
        return completedCount() >= TOTAL;
    }

    function hasParticipado() {
        try {
            var d = JSON.parse(localStorage.getItem(REGISTRO_KEY) || '{}');
            return Object.keys(d).length > 0;
        } catch (e) { return false; }
    }

    function mark(id) {
        var d = load();
        if (d[id]) return;
        d[id] = true;
        d.updatedAt = Date.now();
        save(d);
        var a = ACTIONS.filter(function (x) { return x.id === id; })[0];
        if (a) showToast('✓ Misión completada: ' + a.label);
        renderAll();
        if (isUnlocked() && !celebrated) {
            celebrated = true;
            celebrateUnlock();
        }
    }

    /* ── Toast de confirmación ──────────────────────────── */
    function showToast(message) {
        var toast = document.createElement('div');
        toast.className = 'rifa-toast';
        toast.textContent = message;
        document.body.appendChild(toast);
        setTimeout(function () {
            toast.classList.add('rifa-toast-hide');
            setTimeout(function () { toast.remove(); }, 350);
        }, 5000);
    }

    /* ── Animación de Corazones Flotantes ────────────────── */
    function createFloatingHearts(el) {
        if (!el) return;
        var rect = el.getBoundingClientRect();
        var container = document.body;
        var heartEmojis = ['❤️', '💜', '💖', '💕'];

        for (var i = 0; i < 6; i++) {
            var heart = document.createElement('span');
            heart.className = 'floating-heart';
            heart.textContent = heartEmojis[Math.floor(Math.random() * heartEmojis.length)];

            var offsetX = (Math.random() - 0.5) * 30; // -15px a 15px
            var offsetY = (Math.random() - 0.5) * 10;
            var rotation = (Math.random() - 0.5) * 60; // -30deg a 30deg
            var delay = Math.random() * 0.25;

            heart.style.left = (window.scrollX + rect.left + rect.width / 2 + offsetX - 10) + 'px';
            heart.style.top = (window.scrollY + rect.top + rect.height / 2 + offsetY - 10) + 'px';
            heart.style.setProperty('--rot', rotation + 'deg');
            heart.style.animationDelay = delay + 's';

            container.appendChild(heart);

            (function (h) {
                setTimeout(function () { h.remove(); }, 1500);
            })(heart);
        }
    }

    /* ── Render ────────────────────────────────────────── */
    function setText(id, text) {
        var el = document.getElementById(id);
        if (el) el.textContent = text;
    }

    function setFill(id, pct) {
        var el = document.getElementById(id);
        if (el) el.style.width = pct + '%';
    }

    function renderBanner() {
        var hasBanner = document.getElementById('rifa-banner-fill');
        if (!hasBanner) return;

        var pct = progress();
        var participado = hasParticipado();
        var unlocked = isUnlocked();

        setFill('rifa-banner-fill', pct);
        setFill('rifa-banner-fill-m', pct);
        setText('rifa-banner-pct', pct + '%');
        setText('rifa-banner-pct-m', pct + '%');

        var doneCount = completedCount();
        var sub = participado ? 'Ya participaste · Ver tu boleto'
            : unlocked ? '¡Todo completado! Registra tu boleto. 🎉'
                : (MOTIVATIONAL_MESSAGES[doneCount] || 'Completa las misiones y participa gratis');
        setText('rifa-banner-sub', sub);
        setText('rifa-banner-sub-m', sub);

        var btn = participado ? 'Ver boleto'
            : unlocked ? '¡Participa!'
                : '🔒 ' + pct + '%';
        setText('rifa-banner-btn', btn);
        setText('rifa-banner-btn-m', btn);
    }

    function getApiBase() {
        var scriptWithApi = document.querySelector('script[data-api]');
        if (scriptWithApi && scriptWithApi.dataset.api) return scriptWithApi.dataset.api;
        if (window.RIFA_API_BASE) return window.RIFA_API_BASE;
        var loc = window.location;
        if (loc.protocol === 'file:' || loc.port === '5500' || loc.port === '8000' || loc.port === '5173') {
            return 'https://pics-reputation-trackback-neural.trycloudflare.com';
        }
        return loc.origin;
    }
    var API_BASE = getApiBase();
    var PHONE_KEY = 'tp_rifa_user_phone';
    var verifyPollingInterval = null;

    function isMissionLocked(id) {
        var d = load();
        if (id === 'whatsapp_wicho') return false;
        if (id === 'tut_like') return !Boolean(d.whatsapp_wicho);
        if (id === 'event_like') return !Boolean(d.tut_like);
        return false;
    }

    function checkBackendWhatsAppVerification(phone, onVerified, isManual) {
        if (!phone) return;
        var cleanPhone = phone.replace(/\D/g, '');
        if (cleanPhone.length !== 10 && cleanPhone.length !== 12) return;

        var statusBox = document.getElementById('rifa-wa-status-box');

        fetch(API_BASE + '/api/verificar-whatsapp?phone=' + encodeURIComponent(cleanPhone))
            .then(function (res) { return res.json(); })
            .then(function (data) {
                if (data && data.verified) {
                    if (verifyPollingInterval) {
                        clearInterval(verifyPollingInterval);
                        verifyPollingInterval = null;
                    }
                    var modal = document.getElementById('rifa-wa-verify-modal');
                    if (modal) modal.remove();
                    mark('whatsapp_wicho');
                    showToast('🎉 ¡Mensaje a Wicho verificado! Misión 2 desbloqueada.');
                    if (onVerified) onVerified();
                } else if (isManual) {
                    if (statusBox) {
                        statusBox.innerHTML = '<span>⏳ Aún no registramos tu mensaje entrante. Si ya lo enviaste a Wicho:</span>' +
                            '<button type="button" class="rifa-wa-btn-manual" id="rifa-wa-btn-manual-ok">✅ Confirmar de todos modos</button>';
                        var manualOk = document.getElementById('rifa-wa-btn-manual-ok');
                        if (manualOk) {
                            manualOk.onclick = function () {
                                if (verifyPollingInterval) clearInterval(verifyPollingInterval);
                                var modal = document.getElementById('rifa-wa-verify-modal');
                                if (modal) modal.remove();
                                mark('whatsapp_wicho');
                                showToast('✓ ¡Misión 1 completada! Misión 2 desbloqueada.');
                            };
                        }
                    }
                }
            })
            .catch(function (e) {
                console.warn('[rifa] Backend offline o error en /api/verificar-whatsapp:', e);
                if (isManual && statusBox) {
                    statusBox.innerHTML = '<span>ℹ️ Servidor en modo local. Puedes confirmar tu saludo:</span>' +
                        '<button type="button" class="rifa-wa-btn-manual" id="rifa-wa-btn-manual-ok">✅ Confirmar y continuar</button>';
                    var manualOk = document.getElementById('rifa-wa-btn-manual-ok');
                    if (manualOk) {
                        manualOk.onclick = function () {
                            if (verifyPollingInterval) clearInterval(verifyPollingInterval);
                            var modal = document.getElementById('rifa-wa-verify-modal');
                            if (modal) modal.remove();
                            mark('whatsapp_wicho');
                            showToast('✓ ¡Misión 1 completada! Misión 2 desbloqueada.');
                        };
                    }
                }
            });
    }

    function openWhatsAppVerificationFlow() {
        var d = load();
        if (d.whatsapp_wicho) {
            showToast('✓ Ya completaste esta misión.');
            return;
        }

        var savedPhone = localStorage.getItem(PHONE_KEY) || '';
        if (!savedPhone) {
            var inputPhone = document.getElementById('rifa-whatsapp');
            if (inputPhone && inputPhone.value) savedPhone = inputPhone.value.replace(/\D/g, '');
        }

        // Crear modal interactivo de verificación de WhatsApp
        var existingModal = document.getElementById('rifa-wa-verify-modal');
        if (existingModal) existingModal.remove();

        var modalHtml = document.createElement('div');
        modalHtml.id = 'rifa-wa-verify-modal';
        modalHtml.className = 'rifa-wa-modal-overlay';
        modalHtml.innerHTML = [
            '<div class="rifa-wa-modal-card">',
            '  <button type="button" class="rifa-wa-modal-close" id="rifa-wa-close">✕</button>',
            '  <div class="rifa-wa-modal-icon">💬</div>',
            '  <h3 class="rifa-wa-modal-title">Saluda al asistente en WhatsApp</h3>',
            '  <p class="rifa-wa-modal-desc">Ingresa tu número de WhatsApp para abrir el chat de Wicho y corroborar tu mensaje automáticamente.</p>',
            '  <div class="rifa-wa-modal-input-wrap">',
            '    <label>Tu número de WhatsApp (10 dígitos):</label>',
            '    <input type="tel" id="rifa-wa-phone-input" placeholder="Ej. 4441234567" maxlength="10" value="' + savedPhone + '">',
            '    <span class="rifa-wa-modal-err" id="rifa-wa-phone-err"></span>',
            '  </div>',
            '  <div id="rifa-wa-status-box" class="rifa-wa-status-box" style="display: none;">',
            '    <span class="rifa-spinner"></span>',
            '    <span>Esperando tu mensaje a Wicho en WhatsApp...</span>',
            '  </div>',
            '  <div class="rifa-wa-modal-actions">',
            '    <button type="button" class="rifa-wa-btn-primary" id="rifa-wa-btn-open">📲 Abrir WhatsApp y Enviar</button>',
            '    <button type="button" class="rifa-wa-btn-secondary" id="rifa-wa-btn-check" style="display:none;">🔄 Ya envié el mensaje, verificar ahora</button>',
            '  </div>',
            '</div>'
        ].join('');

        document.body.appendChild(modalHtml);

        var phoneInput = document.getElementById('rifa-wa-phone-input');
        var errLabel = document.getElementById('rifa-wa-phone-err');
        var btnOpen = document.getElementById('rifa-wa-btn-open');
        var btnCheck = document.getElementById('rifa-wa-btn-check');
        var statusBox = document.getElementById('rifa-wa-status-box');
        var btnClose = document.getElementById('rifa-wa-close');

        btnClose.onclick = function () {
            if (verifyPollingInterval) { clearInterval(verifyPollingInterval); verifyPollingInterval = null; }
            modalHtml.remove();
        };

        function startPolling(phone) {
            statusBox.style.display = 'flex';
            statusBox.innerHTML = '<span class="rifa-spinner"></span><span>Esperando tu mensaje a Wicho en WhatsApp...</span>';
            btnCheck.style.display = 'inline-block';
            btnOpen.textContent = '🔄 Reabrir WhatsApp';

            if (verifyPollingInterval) clearInterval(verifyPollingInterval);
            checkBackendWhatsAppVerification(phone, null, false);
            verifyPollingInterval = setInterval(function () {
                checkBackendWhatsAppVerification(phone, null, false);
            }, 3000);
        }

        btnOpen.onclick = function () {
            var phone = (phoneInput.value || '').replace(/\D/g, '');
            if (phone.length !== 10) {
                errLabel.textContent = 'Escribe tu número a 10 dígitos (ej. 4441234567).';
                return;
            }
            errLabel.textContent = '';
            localStorage.setItem(PHONE_KEY, phone);

            var msg = '¡Hola Wicho! 👋 Vengo desde la página de Beneficios Totalplay y me estoy registrando para el Sorteo FENAPO 2026 🎁✨ ¿Me cuentas qué onda y me pasas un buen chiste para la suerte? 🍀';
            var waUrl = 'https://wa.me/524447110396?text=' + encodeURIComponent(msg);
            window.open(waUrl, '_blank', 'noopener');

            startPolling(phone);
        };

        btnCheck.onclick = function () {
            var phone = (phoneInput.value || '').replace(/\D/g, '');
            if (phone.length === 10) {
                checkBackendWhatsAppVerification(phone, null, true);
            }
        };
    }

    function handleMissionClick(id) {
        var d = load();

        // Validación de orden secuencial
        if (isMissionLocked(id)) {
            if (id === 'tut_like') {
                showToast('🔒 Primero completa la Misión 1: Saluda al asistente en WhatsApp.');
            } else if (id === 'event_like') {
                showToast('🔒 Primero completa la Misión 2: Aprende cómo usar la página de beneficios.');
            }
            return;
        }

        var closeBtn = document.querySelector('#rifa-modal [data-rifa-close]');

        switch (id) {
            case 'whatsapp_wicho':
                openWhatsAppVerificationFlow();
                break;
            case 'tut_like':
                if (closeBtn) closeBtn.click();
                setTimeout(function () {
                    var tabBtn = document.querySelector('[data-mobile-tab="learn"]');
                    if (tabBtn) tabBtn.click();

                    if (typeof window.openTutorialDirectly === 'function') {
                        window.openTutorialDirectly('beneficios');
                    } else {
                        var trigger = document.querySelector('[data-tutorial-modal]');
                        if (trigger) trigger.click();
                    }
                }, 300);
                break;
            case 'event_like':
                if (closeBtn) closeBtn.click();
                setTimeout(function () {
                    window.location.href = 'calendario.html?highlight=likes';
                }, 300);
                break;
        }
    }

    function renderChecklist() {
        var wrap = document.getElementById('rifa-checklist');
        if (!wrap) return;

        var d = load();
        var pct = progress();
        var unlocked = isUnlocked();

        var pendingHtml = '';
        var completedHtml = '';
        var pendingCount = 0;
        var completedCount = 0;

        ACTIONS.forEach(function (a) {
            var done = Boolean(d[a.id]);
            var locked = isMissionLocked(a.id);

            if (done) {
                completedCount++;
                completedHtml += '<div class="rifa-mission-card completed">';
                completedHtml += '  <div class="rifa-mission-card-left">✓</div>';
                completedHtml += '  <div class="rifa-mission-card-middle">';
                completedHtml += '    <span class="rifa-mission-card-title">' + a.label + '</span>';
                completedHtml += '    <span class="rifa-mission-card-points">COMPLETADO</span>';
                completedHtml += '  </div>';
                completedHtml += '</div>';
            } else if (locked) {
                pendingCount++;
                pendingHtml += '<div class="rifa-mission-card locked" onclick="window.RifaMisiones.handleMissionClick(\'' + a.id + '\')">';
                pendingHtml += '  <div class="rifa-mission-card-left">🔒</div>';
                pendingHtml += '  <div class="rifa-mission-card-middle">';
                pendingHtml += '    <span class="rifa-mission-card-title">' + a.label + '</span>';
                pendingHtml += '    <span class="rifa-mission-card-points">BLOQUEADO · COMPLETA LA ANTERIOR</span>';
                pendingHtml += '  </div>';
                pendingHtml += '  <div class="rifa-mission-card-right">🔒</div>';
                pendingHtml += '</div>';
            } else {
                pendingCount++;
                pendingHtml += '<div class="rifa-mission-card pending" onclick="window.RifaMisiones.handleMissionClick(\'' + a.id + '\')">';
                pendingHtml += '  <div class="rifa-mission-card-left">' + a.icon + '</div>';
                pendingHtml += '  <div class="rifa-mission-card-middle">';
                pendingHtml += '    <span class="rifa-mission-card-title">' + a.label + '</span>';
                pendingHtml += '    <span class="rifa-mission-card-points">COMPLETA Y GANA</span>';
                pendingHtml += '  </div>';
                pendingHtml += '  <div class="rifa-mission-card-right">➔</div>';
                pendingHtml += '</div>';
            }
        });

        var html = '';

        if (pendingCount > 0) {
            html += '<div class="rifa-checklist-section-title">MISIONES PENDIENTES</div>';
            html += '<div class="rifa-checklist-pending-list">' + pendingHtml + '</div>';
        }

        if (completedCount > 0) {
            html += '<div class="rifa-completed-accordion-header" id="rifa-completed-trigger">';
            html += '  <span>MISIONES COMPLETADAS (' + completedCount + ')</span>';
            html += '  <span class="rifa-accordion-chevron">▼</span>';
            html += '</div>';
            html += '<div class="rifa-completed-accordion-content" id="rifa-completed-content" style="display: none;">';
            html += '  ' + completedHtml;
            html += '</div>';
        }

        wrap.innerHTML = html;

        // Renderizar el progreso circular SVG
        var circleFill = document.getElementById('rifa-mission-fill-circle');
        if (circleFill) {
            var offset = 314.16 * (1 - pct / 100);
            circleFill.style.strokeDashoffset = offset;
        }

        setText('rifa-mission-pct', pct + '%');

        // Actualizar el mensaje motivador del modal
        var modalSub = document.getElementById('rifa-modal-sub');
        if (modalSub) {
            if (unlocked) {
                modalSub.innerHTML = '¡Felicidades! Completaste todas las misiones. Pulsa el botón de abajo para registrar tu boleto gratis. 💜';
            } else {
                modalSub.textContent = MOTIVATIONAL_MESSAGES[completedCount] || 'Completa las misiones y desbloquea tu participación.';
            }
        }

        var summaryEl = document.getElementById('rifa-mission-summary');
        if (summaryEl) {
            summaryEl.textContent = completedCount + ' / ' + TOTAL + ' Misiones completadas';
        }

        // Manejar el toggle del acordeón
        var trigger = document.getElementById('rifa-completed-trigger');
        var content = document.getElementById('rifa-completed-content');
        if (trigger && content) {
            trigger.addEventListener('click', function () {
                var isHidden = content.style.display === 'none';
                content.style.display = isHidden ? 'block' : 'none';
                trigger.querySelector('.rifa-accordion-chevron').textContent = isHidden ? '▲' : '▼';
                trigger.classList.toggle('active', isHidden);
            });
        }

        var cta = document.getElementById('rifa-btn-participar');
        if (cta) {
            if (unlocked) {
                cta.disabled = false;
                cta.textContent = '🎉 ¡Participa y gana!';
            } else {
                cta.disabled = true;
                cta.textContent = '🔒 Completa las misiones para participar';
            }
        }
    }

    function renderAll() {
        renderBanner();
        renderChecklist();
    }

    function celebrateUnlock() {
        setText('rifa-banner-sub', '¡Desbloqueado! Participa gratis');
        setText('rifa-banner-sub-m', '¡Desbloqueado! Participa gratis');
        setText('rifa-banner-btn', '¡Participa!');
        setText('rifa-banner-btn-m', '¡Participa!');
        var cta = document.getElementById('rifa-btn-participar');
        if (cta) { cta.disabled = false; cta.textContent = '🎉 ¡Participa y gana!'; }
        if (window.confetti) {
            confetti({
                particleCount: 120,
                spread: 90,
                origin: { x: 0.5, y: 0.4 },
                colors: ['#7C3AED', '#d94389', '#ffd166', '#ffffff'],
                disableForReducedMotion: true
            });
        }
        showToast('🎉 ¡Misiones completadas! Ya puedes participar');
    }

    /* ── Listeners ─────────────────────────────────────── */
    function wireStatic() {
        // Reservado para listeners estáticos
    }

    // Delegación con captura para detectar elementos dinámicos
    function wireDelegated() {
        document.addEventListener('click', function (e) {
            var t = e.target;
            if (!t || !t.closest) return;

            var d = load();

            var tutCard = t.closest('.tutorial-card-main-v3, [data-tutorial-id]');
            if (tutCard) {
                if (!d.whatsapp_wicho) {
                    showToast('🔒 Completa primero la Misión 1 (WhatsApp) para desbloquear los tutoriales');
                    return;
                }
                mark('tut_like');
            }

            var tutLike = t.closest('[data-tutorial-like-action], [data-tutorial-card-like]');
            if (tutLike) {
                if (!d.whatsapp_wicho) {
                    showToast('🔒 Completa primero la Misión 1 (WhatsApp) para desbloquear los tutoriales');
                    return;
                }
                mark('tut_like');
                if (!tutLike.classList.contains('liked')) {
                    createFloatingHearts(tutLike);
                }
                return;
            }

            var eventLike = t.closest('.like-btn');
            if (eventLike) {
                if (!d.tut_like) {
                    showToast('🔒 Completa primero la Misión 2 (Tutorial) para registrar likes a eventos');
                    return;
                }
                mark('event_like');
                if (!eventLike.classList.contains('liked')) {
                    createFloatingHearts(eventLike);
                }
                return;
            }
        }, true);
    }

    // Asegura que cada like a un evento marque la misión en orden
    function patchEventLikes() {
        if (typeof window.handleLike !== 'function') return;
        var orig = window.handleLike;
        window.handleLike = function () {
            var d = load();
            if (!d.tut_like) {
                showToast('🔒 Completa primero la Misión 2 (Tutorial) para registrar likes a eventos');
            } else {
                mark('event_like');
            }
            return orig.apply(this, arguments);
        };
    }

    function init() {
        wireStatic();
        wireDelegated();
        patchEventLikes();
        renderAll();
        window.addEventListener('pageshow', function () {
            renderAll();
        });
        window.addEventListener('storage', function (e) {
            if (e.key === KEY || e.key === REGISTRO_KEY) renderAll();
        });
    }

    window.RifaMisiones = {
        isUnlocked: isUnlocked,
        progress: progress,
        mark: mark,
        renderAll: renderAll,
        handleMissionClick: handleMissionClick,
        isMissionLocked: isMissionLocked
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
