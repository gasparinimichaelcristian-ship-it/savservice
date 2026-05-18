/* ============================================================
   SAV Service — Parrot Easter Egg
   Pappagallo blu animato che vola periodicamente nella pagina.
   Appare ogni 20-35 secondi, vola con percorso ondulato,
   a volte si appoggia su un elemento e poi riparte.
   ============================================================ */

(function () {
    'use strict';

    // Rispetta prefers-reduced-motion
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    /* ── SVG del pappagallo ────────────────────────────────── */
    const SVG = `
    <svg viewBox="0 0 70 100" xmlns="http://www.w3.org/2000/svg" width="80" height="114">
      <!-- Coda -->
      <path d="M28 74 Q18 92 12 108" stroke="#1565C0" stroke-width="4.5" fill="none" stroke-linecap="round"/>
      <path d="M33 76 Q28 96 25 112" stroke="#1976D2" stroke-width="4" fill="none" stroke-linecap="round"/>
      <path d="M39 75 Q42 93 46 108" stroke="#1565C0" stroke-width="4.5" fill="none" stroke-linecap="round"/>
      <!-- Corpo -->
      <ellipse cx="33" cy="57" rx="20" ry="24" fill="#1E88E5"/>
      <!-- Ala (animata via JS) -->
      <ellipse id="paw-wing" cx="20" cy="53" rx="15" ry="20" fill="#42A5F5" transform="rotate(-8 20 40)"/>
      <!-- Ventre più chiaro -->
      <ellipse cx="38" cy="60" rx="10" ry="14" fill="#90CAF9" opacity="0.5"/>
      <!-- Testa -->
      <circle cx="38" cy="28" r="18" fill="#1E88E5"/>
      <!-- Cresta (tre pennini) -->
      <path d="M30 12 Q26 1 29 -5" stroke="#0D47A1" stroke-width="3.5" fill="none" stroke-linecap="round"/>
      <path d="M37 10 Q36 -2 39 -7" stroke="#1565C0" stroke-width="3.5" fill="none" stroke-linecap="round"/>
      <path d="M44 13 Q47 2 49 -3" stroke="#0D47A1" stroke-width="3.5" fill="none" stroke-linecap="round"/>
      <!-- Becco -->
      <path d="M54 26 Q65 30 54 37 Q48 31 54 26" fill="#FF8F00"/>
      <!-- Occhio (cerchio bianco) -->
      <circle cx="48" cy="23" r="8" fill="white"/>
      <!-- Iride -->
      <circle cx="49" cy="23" r="5.5" fill="#0D47A1"/>
      <!-- Pupilla -->
      <circle cx="50" cy="22" r="2" fill="white"/>
      <!-- Zampe (visibili solo quando appollaiato) -->
      <g id="paw-feet" opacity="0">
        <line x1="25" y1="79" x2="17" y2="91" stroke="#FF8F00" stroke-width="2.5" stroke-linecap="round"/>
        <line x1="25" y1="79" x2="25" y2="92" stroke="#FF8F00" stroke-width="2.5" stroke-linecap="round"/>
        <line x1="25" y1="79" x2="32" y2="91" stroke="#FF8F00" stroke-width="2.5" stroke-linecap="round"/>
        <line x1="40" y1="79" x2="32" y2="91" stroke="#FF8F00" stroke-width="2.5" stroke-linecap="round"/>
        <line x1="40" y1="79" x2="40" y2="92" stroke="#FF8F00" stroke-width="2.5" stroke-linecap="round"/>
        <line x1="40" y1="79" x2="48" y2="91" stroke="#FF8F00" stroke-width="2.5" stroke-linecap="round"/>
      </g>
    </svg>`;

    /* ── Crea il contenitore ────────────────────────────────── */
    const wrap = document.createElement('div');
    wrap.id = 'sav-parrot';
    wrap.setAttribute('aria-hidden', 'true');
    wrap.style.cssText = [
        'position:fixed',
        'z-index:99999',
        'pointer-events:none',
        'display:none',
        'width:80px',
        'will-change:transform',
        'filter:drop-shadow(0 4px 8px rgba(0,0,0,.18))',
    ].join(';');
    wrap.innerHTML = SVG;
    document.body.appendChild(wrap);

    const wing  = document.getElementById('paw-wing');
    const feet  = document.getElementById('paw-feet');
    const svg   = wrap.querySelector('svg');

    /* ── Stato ──────────────────────────────────────────────── */
    let rafId   = null;
    let busy    = false;
    let phase   = 'idle'; // idle | flying | landing | perched | leaving
    let x, y, vx, vy;
    let oscT    = 0;
    let perchCountdown = 0;
    let targetX, targetY;
    let willPerch = false;
    let fromRight = true;

    // Angolo ala per sbattimento
    let wingAngle = -8;
    let wingDir   = 1;

    /* ── Utilities ──────────────────────────────────────────── */
    function rnd(min, max) { return min + Math.random() * (max - min); }

    function setDir(goingLeft) {
        // goingLeft = pappagallo guarda a sinistra (verso la destinazione)
        svg.style.transform = goingLeft ? 'scaleX(1)' : 'scaleX(-1)';
    }

    function moveTo(px, py) {
        wrap.style.left = px + 'px';
        wrap.style.top  = py + 'px';
    }

    function show() { wrap.style.display = 'block'; }
    function hide() {
        wrap.style.display = 'none';
        cancelAnimationFrame(rafId);
        busy  = false;
        phase = 'idle';
        scheduleNext();
    }

    /* ── Sbattimento ali ────────────────────────────────────── */
    function flapWing(fast) {
        const speed = fast ? 14 : 5;
        wingAngle += wingDir * speed;
        if (wingAngle > 22)  wingDir = -1;
        if (wingAngle < -22) wingDir =  1;
        wing.setAttribute('transform', `rotate(${wingAngle} 20 40)`);
    }

    function foldWing() {
        wing.setAttribute('transform', 'rotate(-8 20 40)');
    }

    /* ── Sequenza principale ────────────────────────────────── */
    function startFlight() {
        if (busy) return;
        busy      = true;
        willPerch = Math.random() > 0.35;      // 65% chance di appollaiarsi
        fromRight = Math.random() > 0.25;      // di solito arriva da destra
        oscT      = 0;

        const winW = window.innerWidth;
        const winH = window.innerHeight;

        y = rnd(80, winH * 0.55);

        if (fromRight) {
            x  = winW + 90;
            vx = -rnd(3.5, 5.5);
            setDir(true);
        } else {
            x  = -90;
            vx =  rnd(3.5, 5.5);
            setDir(false);
        }
        vy = 0;

        if (willPerch) {
            targetX = rnd(winW * 0.15, winW * 0.80);
            targetY = rnd(70, winH * 0.45);
        } else {
            targetX = fromRight ? -200 : winW + 200;
            targetY = y;
        }

        feet.setAttribute('opacity', '0');
        phase = 'flying';
        show();
        moveTo(x, y);
        loop();
    }

    function loop() {
        rafId = requestAnimationFrame(function () {

            if (phase === 'flying') {
                oscT += 0.09;
                y += Math.sin(oscT) * 2.2;
                x += vx;
                flapWing(true);
                moveTo(x, y);

                // Arrivato vicino al target?
                const reachedX = fromRight ? x <= targetX : x >= targetX;

                if (willPerch && reachedX) {
                    phase = 'landing';
                } else if (!willPerch) {
                    const gone = fromRight ? x < -150 : x > window.innerWidth + 150;
                    if (gone) { hide(); return; }
                }
                loop();

            } else if (phase === 'landing') {
                const dy = targetY - y;
                y  += dy * 0.10;
                x  += vx * 0.6;
                vx *= 0.82;
                flapWing(false);
                moveTo(x, y);

                if (Math.abs(dy) < 1.5 && Math.abs(vx) < 0.4) {
                    // Appollaiato!
                    phase = 'perched';
                    feet.setAttribute('opacity', '1');
                    foldWing();
                    perchCountdown = Math.floor(rnd(110, 220)); // ~2-4s a 60fps
                }
                loop();

            } else if (phase === 'perched') {
                perchCountdown--;
                // Piccolo dondolio della testa
                const bob = Math.sin(perchCountdown * 0.12) * 1.2;
                moveTo(x, y + bob);

                if (perchCountdown <= 0) {
                    // Via!
                    phase = 'leaving';
                    feet.setAttribute('opacity', '0');
                    // Riparte verso il lato opposto
                    if (fromRight) {
                        vx = -rnd(3, 5);
                        setDir(true);
                    } else {
                        vx =  rnd(3, 5);
                        setDir(false);
                    }
                    vy = -2.5;
                }
                loop();

            } else if (phase === 'leaving') {
                oscT += 0.1;
                y  += vy + Math.sin(oscT) * 1.8;
                x  += vx;
                vy *= 0.97;
                flapWing(true);
                moveTo(x, y);

                const gone = x < -150 || x > window.innerWidth + 150 || y < -120;
                if (gone) { hide(); return; }
                loop();
            }
        });
    }

    /* ── Scheduler ──────────────────────────────────────────── */
    function scheduleNext() {
        const delay = rnd(20000, 38000); // 20-38 secondi
        setTimeout(startFlight, delay);
    }

    // Prima comparsa dopo 7 secondi (dà tempo alla pagina di caricarsi)
    setTimeout(startFlight, 7000);

})();
