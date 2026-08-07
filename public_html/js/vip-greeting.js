/* ═══════════════════════════════════════════════════════
   SALUDO VIP Y ROTACIÓN DE EVENTOS — Totalplay te Invita
   - Rota cada 10 segundos.
   - Detecta y adapta género (Bienvenido / Bienvenida).
   - Pausa y congela el saludo al hacer HOVER sobre la tarjeta.
   ═══════════════════════════════════════════════════════ */
(function () {
    'use strict';

    var API_BASE = (document.currentScript && document.currentScript.dataset.api) || window.location.origin;

    var REGISTRO_KEY = 'tp_rifa_registro';
    var GREETING_IDX_KEY = 'tp_rifa_greeting_idx';
    var SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/12L1OaLFvxlUw4ecKKxsQgHicb5x6jn5GfS4jxFhhcmk/gviz/tq?tqx=out:csv&sheet=Eventos';

    var FRASES = [
        '¡Hola de nuevo! Qué bueno tenerte aquí.',
        'Gracias por tu lealtad de siempre.',
        '¡Bienvenido a casa otra vez!',
        'Tienes acceso exclusivo garantizado.',
        'Listo para disfrutar de tus beneficios.',
        'Tu confianza nos hace grandes.',
        'Accesos para ti listos en los eventos que te interesen.',
        'Tu regreso nos inspira a seguir mejorando.',
        'Tu preferencia escribe nuestra historia día con día.',
        'El portal no está completo sin ti. ¡Bienvenido de nuevo!',
        'Reservamos eventos exclusivamente para ti.',
        'Es momento de llevar tus beneficios al siguiente nivel.',
        'Tu lealtad es nuestro mayor reconocimiento.',
        'Lo mejor está por venir y tú estás en la lista de honor.'
    ];

    var MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

    var allEvents = [];
    var intervalId = null;
    var currentSlideIndex = 0;
    var defaultText = 'Experiencias exclusivas para ti en San Luis.';
    var currentSlides = [];
    var hoverActive = false;

    function readRegistros() {
        try { return JSON.parse(localStorage.getItem(REGISTRO_KEY) || '{}'); }
        catch (e) { return {}; }
    }

    function primerNombre(nombre) {
        var n = String(nombre || '').trim();
        if (!n) return '';
        var first = n.split(/\s+/)[0] || '';
        first = first.toLowerCase();
        return first.charAt(0).toUpperCase() + first.slice(1);
    }

    function detectFemale(nombre) {
        var n = String(nombre || '').trim().toLowerCase();
        if (!n) return false;
        var first = n.split(/\s+/)[0] || '';
        if (!first) return false;

        var excepcionesFem = ['carmen', 'isabel', 'beatriz', 'raquel', 'irene', 'abril', 'ruth', 'ester', 'esther', 'pilar', 'rosario', 'dolores', 'luz', 'consuelo', 'mercedes', 'belen', 'belén', 'inés', 'ines', 'rocio', 'rocío', 'concepcion', 'concepción'];
        if (excepcionesFem.indexOf(first) !== -1) return true;

        var masculinosEnA = ['luca', 'mika', 'andrea', 'borja', 'bautista'];
        if (masculinosEnA.indexOf(first) !== -1) return false;

        return first.slice(-1) === 'a';
    }

    function updateEyebrow(nombre) {
        var eyebrow = document.querySelector('.hero-title-eyebrow-v3');
        if (!eyebrow) return;
        if (nombre && detectFemale(nombre)) {
            eyebrow.textContent = 'Bienvenida a';
        } else {
            eyebrow.textContent = 'Bienvenido a';
        }
    }

    function saludoPorHora() {
        var h = new Date().getHours();
        if (h >= 5 && h < 12) return '¡Buenos días';
        if (h >= 12 && h < 19) return '¡Buenas tardes';
        return '¡Buenas noches';
    }

    function fraseVip() {
        var idx = parseInt(localStorage.getItem(GREETING_IDX_KEY) || '0', 10);
        if (isNaN(idx) || idx < 0 || idx >= FRASES.length) idx = 0;
        var frase = FRASES[idx];
        localStorage.setItem(GREETING_IDX_KEY, String((idx + 1) % FRASES.length));
        return frase;
    }

    function parseCSV(text) {
        var lines = text.split('\n');
        var headers = [];
        var result = [];
        if (lines.length === 0) return result;

        var firstLine = lines[0].split(',');
        headers = firstLine.map(function (h) {
            return h.replace(/^"|"$/g, '').trim().toLowerCase();
        });

        for (var i = 1; i < lines.length; i++) {
            var line = lines[i].trim();
            if (!line) continue;

            var arr = [];
            var inQuotes = false;
            var current = '';
            for (var j = 0; j < line.length; j++) {
                var c = line[j];
                if (c === '"') {
                    inQuotes = !inQuotes;
                } else if (c === ',' && !inQuotes) {
                    arr.push(current.trim());
                    current = '';
                } else {
                    current += c;
                }
            }
            arr.push(current.trim());

            var obj = {};
            headers.forEach(function (header, idx) {
                var val = arr[idx] ? arr[idx].replace(/^"|"$/g, '').trim() : '';
                obj[header] = val;
            });
            result.push(obj);
        }
        return result;
    }

    function normalizeDate(str) {
        if (!str) return '';
        str = str.trim().replace(/^"|"$/g, '');
        var parts = str.split('/');
        if (parts.length === 3) {
            var d = parts[0].padStart(2, '0');
            var m = parts[1].padStart(2, '0');
            var y = parts[2];
            return y + '-' + m + '-' + d;
        }
        return str;
    }

    function getTodayString() {
        var d = new Date();
        var y = d.getFullYear();
        var m = String(d.getMonth() + 1).padStart(2, '0');
        var day = String(d.getDate()).padStart(2, '0');
        return y + '-' + m + '-' + day;
    }

    function formatEventDate(dateStr) {
        var parts = dateStr.split('-');
        if (parts.length !== 3) return dateStr;
        var day = parseInt(parts[2], 10);
        var monthIdx = parseInt(parts[1], 10) - 1;
        var monthName = MESES[monthIdx] || '';
        return day + ' ' + monthName;
    }

    function renderText(targets, text) {
        targets.forEach(function (el) {
            el.style.opacity = '0';
        });
        setTimeout(function () {
            targets.forEach(function (el) {
                el.textContent = text;
                el.style.opacity = '1';
            });
        }, 400);
    }

    function startRotation(targets, nombre, saludo, frase) {
        var slides = [];

        var userFrase = frase;
        if (nombre && detectFemale(nombre)) {
            userFrase = userFrase.replace('¡Bienvenido', '¡Bienvenida').replace('Bienvenido', 'Bienvenida');
        }

        // 1. Inicia inmediatamente con el mensaje del usuario (si tiene sesión)
        if (nombre) {
            var n = primerNombre(nombre) || 'invitado';
            slides.push(saludo + ', ' + n + '! ' + userFrase);
        }

        // 2. Subtítulo genérico
        slides.push(defaultText);

        // 3. Eventos de hoy ("¡Hoy!")
        var todayStr = getTodayString();
        var todayEvents = allEvents.filter(function (e) { return e.fecha === todayStr; });
        todayEvents.forEach(function (e) {
            var info = '¡Hoy! ' + e.nombre;
            if (e.hora) info += ' - ' + e.hora;
            if (e.lugar) info += ' en ' + e.lugar;
            slides.push(info);
        });

        // 4. Próximos eventos (máximo 3)
        var futureEvents = allEvents.filter(function (e) { return e.fecha > todayStr; });
        futureEvents.sort(function (a, b) { return a.fecha.localeCompare(b.fecha); });
        var nextFuture = futureEvents.slice(0, 3);
        nextFuture.forEach(function (e) {
            var formattedDate = formatEventDate(e.fecha);
            var info = formattedDate + ': ' + e.nombre;
            if (e.lugar) info += ' en ' + e.lugar;
            slides.push(info);
        });

        // Evitar reiniciar si la lista de diapositivas es idéntica
        if (JSON.stringify(currentSlides) === JSON.stringify(slides)) return;
        currentSlides = slides;

        if (intervalId) clearInterval(intervalId);

        // Si el hover está activo, no iniciamos el intervalo pero mostramos el slide 0
        if (hoverActive) {
            targets.forEach(function (el) {
                el.textContent = slides[0];
                el.style.opacity = '1';
            });
            return;
        }

        currentSlideIndex = 0;

        // Mostrar de inmediato la primera diapositiva (el mensaje del usuario)
        targets.forEach(function (el) {
            el.textContent = slides[0];
            el.style.opacity = '1';
        });

        // Configurar intervalo para rotar cada 10 segundos
        intervalId = setInterval(function () {
            if (hoverActive) return;
            currentSlideIndex = (currentSlideIndex + 1) % slides.length;
            renderText(targets, slides[currentSlideIndex]);
        }, 10000);
    }

    async function loadEvents() {
        try {
            var res = await fetch(SHEET_CSV_URL);
            var text = await res.text();
            var rawData = parseCSV(text);
            allEvents = rawData.map(function (ev) {
                return {
                    nombre: ev.Nombre || ev.nombre || '',
                    fecha: normalizeDate(ev.Fecha || ev.fecha || ''),
                    hora: ev.Hora || ev.hora || '',
                    lugar: ev.Lugar || ev.lugar || '',
                    activo: ev.Activo || ev.activo || 'SI'
                };
            }).filter(function (e) {
                return (e.activo === 'SI' || e.activo === 'Sí') && e.nombre && e.fecha && /^\d{4}-\d{2}-\d{2}$/.test(e.fecha);
            });
        } catch (e) {
            console.warn('[vip-greeting] Error al precargar eventos:', e);
        }
    }

    async function refresh() {
        var targets = document.querySelectorAll('.invite-subtitle');
        if (!targets.length) return;

        // Asegurar que los eventos estén cargados
        if (!allEvents.length) {
            await loadEvents();
        }

        var list = readRegistros();
        var folios = Object.keys(list);

        var saludo = saludoPorHora();
        var frase = fraseVip();

        // Configurar Listeners de Hover
        var cards = document.querySelectorAll('.event-card-v3, .mobile-events-card');
        cards.forEach(function (card) {
            if (card.dataset.hoverBound) return;
            card.dataset.hoverBound = 'true';

            card.addEventListener('mouseenter', function () {
                var activeList = readRegistros();
                var activeFolios = Object.keys(activeList);
                if (!activeFolios.length) return; // Sin sesión no congelamos

                hoverActive = true;
                if (intervalId) clearInterval(intervalId);

                var activeBest = null, activeBestTs = -1;
                activeFolios.forEach(function (f) {
                    var r = activeList[f];
                    var t = r && r.ts ? r.ts : 0;
                    if (t >= activeBestTs) { activeBest = r; activeBestTs = t; }
                });

                var name = activeBest ? (activeBest.nombre || '') : '';
                var first = primerNombre(name) || 'invitado';

                var userFrase = frase;
                if (detectFemale(name)) {
                    userFrase = userFrase.replace('¡Bienvenido', '¡Bienvenida').replace('Bienvenido', 'Bienvenida');
                }

                var text = saludo + ', ' + first + '! ' + userFrase;
                renderText(targets, text);
            });

            card.addEventListener('mouseleave', function () {
                hoverActive = false;
                refresh();
            });
        });

        if (!folios.length) {
            updateEyebrow('');
            startRotation(targets, '', saludo, frase);
            return;
        }

        var best = null, bestTs = -1;
        folios.forEach(function (f) {
            var r = list[f];
            var t = r && r.ts ? r.ts : 0;
            if (t >= bestTs) { best = r; bestTs = t; }
        });

        if (!best || !best.whatsapp) {
            updateEyebrow('');
            startRotation(targets, '', saludo, frase);
            return;
        }

        var nombreLocal = best.nombre || '';
        updateEyebrow(nombreLocal);
        startRotation(targets, nombreLocal, saludo, frase);

        var consultUrl = API_BASE + '/api/registro/consulta?whatsapp=' + encodeURIComponent(best.whatsapp);
        fetch(consultUrl)
            .then(function (r) { return r.json(); })
            .then(function (d) {
                if (d && d.ok && d.exists && d.nombre) {
                    updateEyebrow(d.nombre);
                    startRotation(targets, d.nombre, saludo, frase);
                }
            })
            .catch(function () { /* fallback */ });
    }

    window.VipGreeting = { refresh: refresh };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', refresh);
    } else {
        refresh();
    }
})();
