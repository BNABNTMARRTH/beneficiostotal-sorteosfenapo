/* ═══════════════════════════════════════════════════════
   SORTEO TOTAL FENAPO 2026 — Misiones de desbloqueo
   Completa las acciones para desbloquear el registro.
   ═══════════════════════════════════════════════════════ */
(function () {
    'use strict';

    var KEY = 'tp_rifa_misiones';
    var REGISTRO_KEY = 'tp_rifa_registro';

    var ACTIONS = [
        { id: 'pdf', mission: 1, icon: '📄', label: 'Descarga el PDF de referencias de pago' },
        { id: 'beneficios', mission: 1, icon: '💜', label: 'Conoce tus beneficios' },
        // { id: 'compartir', mission: 1, icon: '📤', label: 'Comparte la página por WhatsApp' },
        { id: 'tiktok', mission: 1, icon: '🎵', label: 'Sigue la página de TikTok' },
        { id: 'facebook', mission: 1, icon: '👍', label: 'Sigue la página de Facebook' },
        { id: 'app', mission: 2, icon: '📱', label: 'Descarga la app Totalplay' },
        { id: 'tut_like', mission: 3, icon: '❤️', label: 'Dale me gusta a un tutorial' },
        // { id: 'tut_form', mission: 3, icon: '📝', label: 'Envía un formulario de asesoría o sugerencia' },
        { id: 'event_like', mission: 4, icon: '📅', label: 'Dale me gusta a un evento' }
    ];

    var MISSION_NAMES = {
        1: 'Explora tus Beneficios Totalplay',
        2: 'Descarga la app',
        3: 'Aprende con tutoriales',
        4: 'Conoce los eventos'
    };

    var MOTIVATIONAL_MESSAGES = {
        0: '¡Comienza tus misiones para ganar tu boleto ahora mismo! ✨',
        1: '¡Buen inicio! Sigue completando para ganar tu boleto. 🚀',
        2: '¡Excelente! Vas dando los primeros pasos al premio. ⚡',
        3: '¡Estás avanzando rápido! Sigue así. 🌟',
        4: '¡Vas a la mitad del camino! Ya casi lo logras. 👍',
        5: '¡Más de la mitad completado! Estás muy cerca. 🔥',
        6: '¡Solo falta una misión! Dale el último empujón. 🎯',
        7: '¡Todo completado! Registra tu boleto de inmediato. 🎉'
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

    function handleMissionClick(id) {
        var closeBtn = document.querySelector('#rifa-modal [data-rifa-close]');

        switch (id) {
            case 'pdf':
                if (closeBtn) closeBtn.click();
                setTimeout(function () {
                    var pdfBtn = document.querySelector('.pdf-open-v3');
                    if (pdfBtn) pdfBtn.click();
                }, 300);
                break;
            case 'beneficios':
                if (closeBtn) closeBtn.click();
                setTimeout(function () {
                    // Si estamos en móvil, cambiar a pestaña "learn"
                    var tabBtn = document.querySelector('[data-mobile-tab="learn"]');
                    if (tabBtn) tabBtn.click();

                    var targetCard = document.querySelector('[data-rifa-explore="beneficios"]');
                    if (targetCard) {
                        targetCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }
                    var cards = document.querySelectorAll('[data-rifa-explore="beneficios"]');
                    cards.forEach(function (card) {
                        card.classList.add('mission-glow-lilac');
                        setTimeout(function () {
                            card.classList.remove('mission-glow-lilac');
                        }, 4500);
                    });
                }, 300);
                break;
            case 'compartir':
                if (closeBtn) closeBtn.click();
                setTimeout(function () {
                    var shareBtn = document.querySelector('[data-rifa-share]');
                    if (shareBtn) shareBtn.click();
                }, 300);
                break;
            case 'tiktok':
                window.open('https://www.tiktok.com/@consultoriaslp?_r=1&_t=ZS-95u5lPvCwvB', '_blank', 'noopener');
                mark('tiktok');
                break;
            case 'facebook':
                window.open('https://www.facebook.com/share/14czbhK2GBD/', '_blank', 'noopener');
                mark('facebook');
                break;
            case 'app':
                if (closeBtn) closeBtn.click();
                setTimeout(function () {
                    var appBtn = document.querySelector('[data-app-modal]');
                    if (appBtn) appBtn.click();
                }, 300);
                break;
            case 'tut_like':
                if (closeBtn) closeBtn.click();
                setTimeout(function () {
                    var tabBtn = document.querySelector('[data-mobile-tab="learn"]');
                    if (tabBtn) tabBtn.click();

                    var trigger = document.querySelector('[data-tutorial-modal]');
                    if (trigger) {
                        trigger.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        trigger.classList.add('mission-glow-lilac');
                        setTimeout(function () { trigger.classList.remove('mission-glow-lilac'); }, 4500);

                        setTimeout(function () {
                            trigger.click();

                            setTimeout(function () {
                                var firstHeart = document.querySelector('#tutorial-modal-v3 .tutorial-card-like-v3, #tutorial-modal-v3 .tutorial-like-v3');
                                if (firstHeart) {
                                    firstHeart.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                }
                                var hearts = document.querySelectorAll('#tutorial-modal-v3 .tutorial-card-like-v3, #tutorial-modal-v3 .tutorial-like-v3');
                                hearts.forEach(function (h) {
                                    h.classList.add('mission-glow-lilac');
                                    setTimeout(function () { h.classList.remove('mission-glow-lilac'); }, 4500);
                                });
                            }, 500);
                        }, 800);
                    }
                }, 300);
                break;
            case 'tut_form':
                if (closeBtn) closeBtn.click();
                setTimeout(function () {
                    var tabBtn = document.querySelector('[data-mobile-tab="learn"]');
                    if (tabBtn) tabBtn.click();

                    var trigger = document.querySelector('[data-tutorial-modal]');
                    if (trigger) {
                        trigger.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        trigger.classList.add('mission-glow-lilac');
                        setTimeout(function () { trigger.classList.remove('mission-glow-lilac'); }, 4500);

                        setTimeout(function () {
                            trigger.click();

                            setTimeout(function () {
                                var helpContainer = document.querySelector('.tutorial-help-v3');
                                if (helpContainer) {
                                    helpContainer.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                }
                                var forms = document.querySelectorAll('#tutorial-suggestion-form, #tutorial-advice-form');
                                forms.forEach(function (f) {
                                    f.classList.add('mission-glow-lilac');
                                    setTimeout(function () { f.classList.remove('mission-glow-lilac'); }, 4500);
                                });
                            }, 500);
                        }, 800);
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
            if (done) {
                completedCount++;
                completedHtml += '<div class="rifa-mission-card completed">';
                completedHtml += '  <div class="rifa-mission-card-left">✓</div>';
                completedHtml += '  <div class="rifa-mission-card-middle">';
                completedHtml += '    <span class="rifa-mission-card-title">' + a.label + '</span>';
                completedHtml += '    <span class="rifa-mission-card-points">COMPLETADO</span>';
                completedHtml += '  </div>';
                completedHtml += '</div>';
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

    /* ── Compartir página ──────────────────────────────── */
    function sharePage(e) {
        e.preventDefault();
        mark('compartir');
        var url = window.location.href.split('?')[0];
        var text = '🎁 ¡Mira esto! Totalplay San Luis: beneficios, eventos y más. ' + url;
        window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank', 'noopener');
    }

    /* ── Listeners ─────────────────────────────────────── */
    function wireStatic() {
        var pdfOpen = document.querySelectorAll('.pdf-open-v3');
        pdfOpen.forEach(function (el) {
            el.addEventListener('click', function () { mark('pdf'); });
        });

        var explorar = document.querySelectorAll('[data-rifa-explore="beneficios"]');
        explorar.forEach(function (el) {
            el.addEventListener('click', function () { mark('beneficios'); });
        });

        var compartir = document.querySelectorAll('[data-rifa-share]');
        compartir.forEach(function (el) {
            el.addEventListener('click', sharePage);
        });

        var appOpen = document.querySelectorAll('[data-app-modal]');
        appOpen.forEach(function (el) {
            el.addEventListener('click', function () { mark('app'); });
        });

        var forms = document.querySelectorAll('#tutorial-advice-form, #tutorial-suggestion-form');
        forms.forEach(function (form) {
            form.addEventListener('submit', function () { mark('tut_form'); });
        });
    }

    // Delegación con captura para detectar elementos dinámicos
    // (likes de tutoriales y eventos se generan después de cargar).
    function wireDelegated() {
        document.addEventListener('click', function (e) {
            var t = e.target;
            if (!t || !t.closest) return;

            var tiktok = t.closest('a[href*="tiktok.com"]');
            if (tiktok) { mark('tiktok'); return; }

            var facebook = t.closest('a[href*="facebook.com/share/"]');
            if (facebook) { mark('facebook'); return; }

            var tutLike = t.closest('[data-tutorial-like-action], [data-tutorial-card-like]');
            if (tutLike) {
                mark('tut_like');
                if (!tutLike.classList.contains('liked')) {
                    createFloatingHearts(tutLike);
                }
                return;
            }

            var eventLike = t.closest('.like-btn');
            if (eventLike) {
                mark('event_like');
                if (!eventLike.classList.contains('liked')) {
                    createFloatingHearts(eventLike);
                }
                return;
            }
        }, true);
    }

    // Asegura que cada like a un evento marque la misión, aunque la
    // delegación de eventos fallara. handleLike es global en calendario.html.
    function patchEventLikes() {
        if (typeof window.handleLike !== 'function') return;
        var orig = window.handleLike;
        window.handleLike = function () {
            var r = orig.apply(this, arguments);
            mark('event_like');
            return r;
        };
    }

    function init() {
        wireStatic();
        wireDelegated();
        patchEventLikes();
        renderAll();
        // bfcache: al volver con "atrás" la página se restaura sin re-ejecutar
        // scripts, así que re-renderizamos el progreso al mostrarla de nuevo.
        window.addEventListener('pageshow', function () {
            renderAll();
        });
        // Sincronización entre pestañas: si das like en el calendario mientras
        // tienes index.html abierto, la barrita avanza en vivo.
        window.addEventListener('storage', function (e) {
            if (e.key === KEY || e.key === REGISTRO_KEY) renderAll();
        });
    }

    window.RifaMisiones = {
        isUnlocked: isUnlocked,
        progress: progress,
        mark: mark,
        renderAll: renderAll,
        handleMissionClick: handleMissionClick
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
