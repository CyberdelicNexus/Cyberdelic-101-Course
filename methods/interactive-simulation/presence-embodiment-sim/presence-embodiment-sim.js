/**
 * Presence & Embodiment - Simulation Engine (3D "Threshold Room")
 * Registers itself to window.SimulationEngines['PresenceEmbodimentSim'].
 *
 * A client stands in a world that builds around them. Every slider drives its own part of the scene:
 *   s1 Body-Environment Synchrony   -> when the head turns, the world drags behind it (a faint ghost shows where it should be)
 *   s2 Environmental Responsiveness -> the floor ripples out from the client, crystals light up, motes gather where they look
 *   s3 Avatar Type                  -> no body (viewpoint + headset) -> floating hands -> still body -> synchronized body
 *   s4 Multi-Sensory Coherence      -> sight / sound / motion / touch rings drift apart or lock into one pulse
 *   s5 Pre-Session Preparation      -> the threshold they walked through, the lit path, the grounding ring under their feet
 * Presence (P) materialises the world and fades the headset. Embodiment (E) gathers and warms the body.
 * Full Immersion (P and E both high): a brand-gradient stream joins body and world.
 *
 * The State Map plots P x E on a 3 x 3 grid: the lesson's six states plus three new ones
 * (The Window, Rehearsal, The Threshold) for the cells the six left open. New ones are marked `added`
 * and drawn with a dashed outline. Clicking a state slides the controls to an example.
 *
 * - Slider names, weights, descriptions, the P/E formula and the six quotes are unchanged from the
 *   previous version (presence-embodiment-sim-2d.js).
 * - The engine draws its own controls, so `config` is empty.
 * - A standalone simulation: no completion gate. "x / 9 states found" is only a guide.
 * - three.js add-ons (OrbitControls, bloom) are loaded on demand.
 */
(function () {
    'use strict';

    window.SimulationEngines = window.SimulationEngines || {};

    // ------------------------------------------------------------------
    // Data
    // ------------------------------------------------------------------
    const SLIDERS = [
        { id: 's1', axis: 'p', w: .45, def: 75, lo: 'Sluggish', hi: 'Instantaneous', name: 'Body-Environment Synchrony',
          text: "How accurately and immediately the virtual environment responds to the client's physical movements. High synchrony means when they turn their head, the world turns with them instantly. Low synchrony creates a lag — the nervous system detects the mismatch and resists accepting the environment as real.",
          look: 'When the client turns their head, the world drags behind. The faint outline shows where it should be.' },
        { id: 's2', axis: 'p', w: .40, def: 20, lo: 'Static', hi: 'Participatory', name: 'Environmental Responsiveness',
          text: "Whether the virtual environment reacts to the client's presence and actions, or simply plays on around them. A static environment is experienced passively, like watching a film. A participatory environment responds — objects react, the space acknowledges the client is there.",
          look: 'The floor ripples out from the client, the crystals light up as it reaches them, and the motes gather where they look.' },
        { id: 's3', axis: 'e', w: .50, def: 15, lo: 'No Body', hi: 'Synchronized', name: 'Avatar Type',
          text: "The kind of body representation the client has inside the experience. At one end: no visible body, purely a floating viewpoint. At the other: a full synchronized avatar that mirrors the client's actual movements. The avatar is the primary driver of Body Ownership Illusion — the felt sense that the virtual body is one's own.",
          look: 'A floating viewpoint, then hands, then a still body, then a body that moves with the client.' },
        { id: 's4', axis: 'e', w: .38, def: 15, lo: 'Fragmented', hi: 'Unified', name: 'Multi-Sensory Coherence',
          text: "How well the different sensory channels — visual, spatial audio, movement, haptic — reinforce the same reality rather than conflicting. When sensory channels conflict, the nervous system detects inconsistency and reduces its acceptance of both the body and the environment as real.",
          look: 'The sight, sound, motion and touch rings drift apart and pulse out of step, or lock into one.' },
        { id: 's5', axis: 'b', w: .22, def: 15, lo: 'None', hi: 'Thorough', name: 'Pre-Session Preparation',
          text: "The quality of practitioner-client work before the headset goes on. Thorough preparation improves both presence and embodiment — not by changing the technology, but by reducing the cognitive and emotional resistance that prevents the nervous system from accepting the session as real.",
          look: 'The threshold the client walked through, the lit path in, and the grounding ring under their feet.' }
    ];
    const PROFILES = [
        { id: 0, name: 'Adrift', pLo: 0, pHi: 35, eLo: 0, eHi: 35, c: '#9890BB', quote: '"I felt like I was watching a screen. Nothing landed. I kept noticing the headset."' },
        { id: 1, name: 'The Open Field', pLo: 65, pHi: 100, eLo: 0, eHi: 35, c: '#4CDCEF', quote: '"I was completely transported — but there was no me there. Just the space. I floated through it."' },
        { id: 2, name: 'Stage Set', pLo: 0, pHi: 35, eLo: 65, eHi: 100, c: '#E562A4', quote: '"The body felt real but the world kept reminding me it wasn\'t. Like being a character on a set."' },
        { id: 3, name: 'Full Immersion', pLo: 65, pHi: 100, eLo: 65, eHi: 100, c: '#C9B6FF', quote: '"I was completely there. That was my body. The space responded to me. I stopped thinking about the headset."' },
        { id: 4, name: 'Floating Through', pLo: 65, pHi: 100, eLo: 36, eHi: 64, c: '#86C4F6', quote: '"I was in the space but only loosely in my body. Like drifting through it — present but weightless."' },
        { id: 5, name: 'Inhabited Stage', pLo: 36, pHi: 64, eLo: 65, eHi: 100, c: '#D58AD8', quote: '"The body felt very real — but the environment kept flickering. Present in my body, but not quite in a place."' },
        // Added: the three cells the original six left open, so every part of the map has a name
        { id: 6, name: 'The Window', pLo: 36, pHi: 64, eLo: 0, eHi: 35, c: '#6FB7C9', added: true, quote: '"I could almost believe the place was real — but I was looking at it, not standing in it. Just eyes at a window."' },
        { id: 7, name: 'Rehearsal', pLo: 0, pHi: 35, eLo: 36, eHi: 64, c: '#B97FB0', added: true, quote: '"Parts of me showed up — my hands, a bit of weight — but the world was a backdrop. Like a rehearsal before the set was built."' },
        { id: 8, name: 'The Threshold', pLo: 36, pHi: 64, eLo: 36, eHi: 64, c: '#B49BF8', added: true, quote: '"Halfway in. Some moments I was there, some moments I was back in the chair. Like standing in a doorway."' }
    ];
    const AXIS = { p: { label: 'Presence', sub: 'The space', c: '#4CDCEF' }, e: { label: 'Embodiment', sub: 'The body', c: '#E562A4' }, b: { label: 'Affects both', sub: '', c: '#B49BF8' } };
    const IDLE = { name: 'Between states', quote: 'Adjust parameters to discover session states...' };

    // Weighted average: presence from s1, s2, s5; embodiment from s3, s4, s5
    function targets(vals) {
        let pS = 0, pW = 0, eS = 0, eW = 0;
        SLIDERS.forEach(s => {
            const v = vals[s.id];
            if (s.axis !== 'e') { pS += v * s.w; pW += s.w; }
            if (s.axis !== 'p') { eS += v * s.w; eW += s.w; }
        });
        return { p: Math.min(100, Math.round(pS / pW)), e: Math.min(100, Math.round(eS / eW)) };
    }
    const profileAt = (p, e) => PROFILES.find(pr => p >= pr.pLo && p <= pr.pHi && e >= pr.eLo && e <= pr.eHi) || null;
    // Slider values that land in the middle of a state (preparation held at 50)
    function presetFor(pr) {
        const pT = (pr.pLo + pr.pHi) / 2, eT = (pr.eLo + pr.eHi) / 2, prep = 50;
        const x = Math.round(Math.max(0, Math.min(100, (pT * 1.07 - prep * .22) / .85)));
        const y = Math.round(Math.max(0, Math.min(100, (eT * 1.10 - prep * .22) / .88)));
        return { s1: x, s2: x, s3: y, s4: y, s5: prep };
    }
    const AVATAR_STAGE = v => v < 18 ? 'no body' : v < 42 ? 'hands only' : v < 68 ? 'still body' : 'synchronized';
    const defaults = () => { const v = {}; SLIDERS.forEach(s => { v[s.id] = s.def; }); return v; };

    // ------------------------------------------------------------------
    // Dependency loader (shared by every 3D engine on the page)
    // ------------------------------------------------------------------
    const THREE_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
    const EXAMPLES = 'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/';
    const DEPS = [
        ['OrbitControls', 'controls/OrbitControls.js'],
        ['CopyShader', 'shaders/CopyShader.js'],
        ['LuminosityHighPassShader', 'shaders/LuminosityHighPassShader.js'],
        ['EffectComposer', 'postprocessing/EffectComposer.js'],
        ['RenderPass', 'postprocessing/RenderPass.js'],
        ['ShaderPass', 'postprocessing/ShaderPass.js'],
        ['UnrealBloomPass', 'postprocessing/UnrealBloomPass.js']
    ];

    function loadScript(src) {
        return new Promise((resolve, reject) => {
            const existing = document.querySelector(`script[src="${src}"]`);
            if (existing && existing.dataset.loaded === 'true') return resolve();
            const s = existing || document.createElement('script');
            s.addEventListener('load', () => { s.dataset.loaded = 'true'; resolve(); }, { once: true });
            s.addEventListener('error', () => reject(new Error('Failed to load ' + src)), { once: true });
            if (!existing) { s.src = src; s.async = false; document.head.appendChild(s); }
        });
    }

    function loadDeps() {
        if (window.__cnPeDeps) return window.__cnPeDeps;
        window.__cnPeDeps = (async () => {
            if (!window.THREE) await loadScript(THREE_CDN);
            for (const [name, path] of DEPS) {
                if (!window.THREE[name]) await loadScript(EXAMPLES + path);
            }
        })();
        window.__cnPeDeps.catch(() => { window.__cnPeDeps = null; });   // allow a retry on the next init
        return window.__cnPeDeps;
    }

    const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text !== undefined) n.textContent = text; return n; };
    let uid = 0;

    // ------------------------------------------------------------------
    // The Threshold Room: UI, State Map and 3D scene, built inside `root`
    // ------------------------------------------------------------------
    function createRoom(root, opts) {
        const THREE = window.THREE;
        const INSTANT = window.matchMedia('(prefers-reduced-motion: reduce)').matches;   // presets jump instead of sliding
        const cleanups = [];
        const on = (target, type, fn, o) => { target.addEventListener(type, fn, o); cleanups.push(() => target.removeEventListener(type, fn, o)); };
        const prefix = 'pe3d-' + (++uid) + '-';

        // ================= UI =================
        const ui = document.createElement('div');
        ui.innerHTML = `
          <div class="labels"></div>
          <header class="head"><span class="eb">Presence &amp; Embodiment</span><h1>The Threshold Room</h1><span class="bar"></span></header>
          <aside class="params glass" aria-label="Session parameters"><span class="lbl">Session parameters</span></aside>
          <aside class="state glass" aria-label="Client state">
            <div class="meters">
              <div class="meter" style="--c:var(--p)"><span>Presence</span><small>the space</small><b data-r="pn">0<em>%</em></b><div class="tr"><i data-r="pm"></i></div></div>
              <div class="meter" style="--c:var(--e)"><span>Embodiment</span><small>the body</small><b data-r="en">0<em>%</em></b><div class="tr"><i data-r="em"></i></div></div>
            </div>
            <div class="map"><span class="lbl">State map</span><svg data-r="map" viewBox="0 0 276 262" role="group" aria-label="Presence by embodiment map of the nine session states"></svg></div>
            <div class="card idle" data-r="card" aria-live="polite"><span class="eb">Client state</span><h3 data-r="sname"></h3><p data-r="squote"></p></div>
            <div class="found"><div class="dots" data-r="fdots"></div><span data-r="ftxt"></span></div>
            <div class="hint">Click a state on the map to set the sliders to an example.</div>
          </aside>
          <div class="mini glass" aria-hidden="true"><span class="mp">P <b data-r="mpn">0</b></span><span class="me">E <b data-r="men">0</b></span><span class="ms" data-r="ms"></span></div>
          <div class="tabs glass" role="tablist"><button type="button" role="tab" data-tab="params" aria-selected="true">Controls</button><button type="button" role="tab" data-tab="state" aria-selected="false">State map</button></div>`;
        const uiNodes = [...ui.children];
        uiNodes.forEach(n => root.appendChild(n));
        const R = name => root.querySelector(`[data-r="${name}"]`);
        const refs = {};
        ['pn', 'pm', 'en', 'em', 'map', 'card', 'sname', 'squote', 'fdots', 'ftxt', 'mpn', 'men', 'ms'].forEach(k => { refs[k] = R(k); });

        const vals = defaults();
        const params = root.querySelector('.params'), sliderEls = {};
        let active = null, tween = null;
        ['p', 'e', 'b'].forEach(ax => {
            const g = el('div', 'grp'); g.style.setProperty('--c', AXIS[ax].c);
            const gh = el('div', 'gh'); gh.append(el('i'), document.createTextNode(AXIS[ax].label + (AXIS[ax].sub ? ' · ' + AXIS[ax].sub : '')));
            g.appendChild(gh);
            SLIDERS.filter(s => s.axis === ax).forEach(s => {
                const box = el('div', 'sl'); box.style.setProperty('--c', AXIS[ax].c);
                const top = el('div', 'top'), val = el('b');
                const lab = el('label', null, s.name); lab.htmlFor = prefix + s.id;
                top.append(lab, val);
                const input = el('input'); input.type = 'range'; input.min = 0; input.max = 100; input.id = prefix + s.id; input.value = vals[s.id];
                const ends = el('div', 'ends'); ends.append(el('span', null, s.lo), el('span', null, s.hi));
                const more = el('div', 'more'), look = el('div', 'look');
                look.append(el('b', null, 'In the room'), document.createTextNode(s.look));
                const feeds = el('div', 'feeds', 'feeds ' + (s.axis === 'b' ? 'presence + embodiment' : s.axis === 'p' ? 'presence' : 'embodiment') + ' · weight ' + s.w.toFixed(2));
                more.append(el('p', null, s.text), look, feeds);
                box.append(top, input, ends, more);
                on(input, 'input', () => { vals[s.id] = +input.value; tween = null; setActive(s.id); syncInputs(); });
                on(input, 'focus', () => setActive(s.id));
                on(box, 'pointerdown', () => setActive(s.id));
                g.appendChild(box);
                sliderEls[s.id] = { box, input, val };
            });
            params.appendChild(g);
        });
        function setActive(id) {
            if (active === id) return;
            active = id;
            Object.entries(sliderEls).forEach(([k, o]) => o.box.classList.toggle('on', k === id));
        }
        function syncInputs() {
            SLIDERS.forEach(s => {
                const o = sliderEls[s.id], v = Math.round(vals[s.id]);
                if (+o.input.value !== v) o.input.value = v;
                o.input.style.setProperty('--v', v + '%');
                o.val.textContent = s.id === 's3' ? v + ' · ' + AVATAR_STAGE(v) : String(v);
                o.input.setAttribute('aria-valuetext', o.val.textContent);
            });
        }
        syncInputs();

        // ---- state map ----
        const svg = refs.map, NS = 'http://www.w3.org/2000/svg';
        const X0 = 30, Y0 = 6, PW = 236, PH = 222;
        const mx = p => X0 + p / 100 * PW, my = e => Y0 + (1 - e / 100) * PH;
        const sv = (tag, attrs, parent = svg) => { const n = document.createElementNS(NS, tag); Object.entries(attrs).forEach(([k, v]) => n.setAttribute(k, v)); parent.appendChild(n); return n; };
        sv('rect', { x: X0, y: Y0, width: PW, height: PH, rx: 8, fill: 'rgba(255,255,255,.02)', stroke: 'rgba(255,255,255,.08)' });
        [35, 65].forEach(t => {
            sv('line', { x1: mx(t), x2: mx(t), y1: Y0, y2: Y0 + PH, stroke: 'rgba(255,255,255,.07)', 'stroke-dasharray': '2 4' });
            sv('line', { x1: X0, x2: X0 + PW, y1: my(t), y2: my(t), stroke: 'rgba(255,255,255,.07)', 'stroke-dasharray': '2 4' });
        });
        const regions = PROFILES.map(pr => {
            const g = sv('g', { class: 'rg', tabindex: 0, role: 'button', 'aria-label': 'Set the sliders to an example of ' + pr.name });
            const x1 = mx(pr.pLo), x2 = mx(Math.min(100, pr.pHi + (pr.pHi < 100 ? 1 : 0))), y1 = my(Math.min(100, pr.eHi + (pr.eHi < 100 ? 1 : 0))), y2 = my(pr.eLo);
            const r = sv('rect', { x: x1 + 1.5, y: y1 + 1.5, width: x2 - x1 - 3, height: y2 - y1 - 3, rx: 6, fill: pr.c, 'fill-opacity': .07, stroke: pr.c, 'stroke-opacity': .3, 'stroke-dasharray': pr.added ? '3 3' : 'none' }, g);
            const words = pr.name.split(' '), lines = words.length > 2 ? [words.slice(0, 2).join(' '), words.slice(2).join(' ')] : words.length === 2 && pr.name.length > 10 ? words : [pr.name];
            const t = sv('text', { x: (x1 + x2) / 2, y: y1 + 16, 'text-anchor': 'middle', fill: pr.c }, g);   // top of the cell, clear of the dot
            lines.forEach((ln, i) => { const ts = sv('tspan', { x: (x1 + x2) / 2, dy: i ? 11 : 0 }, t); ts.textContent = ln; });
            const go = () => applyPreset(pr);
            on(g, 'click', go);
            on(g, 'keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
            return { pr, r, t, last: lines[lines.length - 1] };
        });
        const ax1 = sv('text', { x: X0 + PW, y: Y0 + PH + 16, 'text-anchor': 'end', class: 'ax' }); ax1.textContent = 'PRESENCE →';
        const ax2 = sv('text', { x: -(Y0), y: 12, 'text-anchor': 'end', class: 'ax', transform: 'rotate(-90)' }); ax2.textContent = 'EMBODIMENT →';
        ax1.style.fill = '#4CDCEF'; ax2.style.fill = '#E562A4';
        const z1 = sv('text', { x: X0, y: Y0 + PH + 16, class: 'ax' }); z1.textContent = '0';
        const trail = sv('polyline', { fill: 'none', stroke: '#fff', 'stroke-opacity': .35, 'stroke-width': 1.5, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' });
        const dotHalo = sv('circle', { r: 11, fill: '#fff', 'fill-opacity': .12 });
        const dot = sv('circle', { r: 5, fill: '#fff' });
        dot.style.filter = 'drop-shadow(0 0 6px #fff)';
        const trailPts = [];

        // ---- states found (a guide only, never a gate) ----
        const found = new Set(), fdots = refs.fdots;
        PROFILES.forEach(pr => { const d = el('i'); d.style.setProperty('--c', pr.c); d.title = pr.name; fdots.appendChild(d); });
        function updateFound() {
            [...fdots.children].forEach((d, i) => d.classList.toggle('on', found.has(i)));
            refs.ftxt.textContent = found.size + ' / ' + PROFILES.length + ' states found';
            regions.forEach(rg => { rg.t.lastChild.textContent = rg.last + (found.has(rg.pr.id) ? ' ✓' : ''); });
        }
        updateFound();

        let shown;
        function showProfile(pr) {
            if (pr === shown) return;
            shown = pr;
            refs.card.classList.toggle('idle', !pr);
            refs.card.style.setProperty('--c', pr ? pr.c : '');
            refs.sname.textContent = pr ? pr.name : IDLE.name;
            refs.squote.textContent = pr ? pr.quote : IDLE.quote;
            regions.forEach(rg => {
                const sel = rg.pr === pr;
                rg.r.setAttribute('fill-opacity', sel ? .26 : .07);
                rg.r.setAttribute('stroke-opacity', sel ? 1 : .3);
            });
            if (pr && !found.has(pr.id)) { found.add(pr.id); updateFound(); }
        }

        // ---- click a state: slide the controls to an example ----
        function applyPreset(pr) {
            tween = { from: { ...vals }, to: presetFor(pr), t: 0 };
            setActive(null);
        }
        function tickTween(dt) {
            if (!tween) return;
            tween.t = Math.min(1, tween.t + dt / (INSTANT ? .001 : .9));
            const k = 1 - Math.pow(1 - tween.t, 3);
            SLIDERS.forEach(s => { vals[s.id] = tween.from[s.id] + (tween.to[s.id] - tween.from[s.id]) * k; });
            syncInputs();
            if (tween.t >= 1) tween = null;
        }

        // ---- phone tabs ----
        const tabBtns = [...root.querySelectorAll('.tabs button')];
        tabBtns.forEach(b => on(b, 'click', () => {
            root.classList.toggle('tab-state', b.dataset.tab === 'state');
            tabBtns.forEach(x => x.setAttribute('aria-selected', String(x === b)));
        }));

        // ================= 3D =================
        const C = h => new THREE.Color(h), V = (x, y, z) => new THREE.Vector3(x, y, z), TAU = Math.PI * 2;
        const clamp01 = x => Math.max(0, Math.min(1, x));
        const smooth = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
        const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, opts.lite ? 1.5 : 2));
        renderer.setClearColor(0x000000, 1);
        renderer.domElement.className = 'pe3d-canvas';
        root.prepend(renderer.domElement);
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(40, 1, 1, 9000);
        const HOME_POS = V(170, 110, 960), HOME_TARGET = V(0, 20, -40);
        camera.position.copy(HOME_POS);
        const controls = new THREE.OrbitControls(camera, renderer.domElement);
        controls.target.copy(HOME_TARGET);
        Object.assign(controls, { enableDamping: true, dampingFactor: .06, enablePan: false, minDistance: 260, maxDistance: 1800, rotateSpeed: .5, zoomSpeed: .7, maxPolarAngle: Math.PI * .52 });
        // Inside a scrolling lesson page, plain wheel scrolls the page and Ctrl/Cmd + wheel zooms.
        // On a full-screen page (nothing to scroll), plain wheel zooms.
        const pageScrolls = () => { const se = document.scrollingElement || document.documentElement; return se.scrollHeight > window.innerHeight + 4; };
        on(renderer.domElement, 'wheel', e => { controls.enableZoom = !pageScrolls() || e.ctrlKey || e.metaKey; }, { capture: true, passive: true });
        const composer = new THREE.EffectComposer(renderer);
        composer.addPass(new THREE.RenderPass(scene, camera));
        const bloom = opts.lite ? null : new THREE.UnrealBloomPass(new THREE.Vector2(256, 256), .7, .55, .3);
        if (bloom) composer.addPass(bloom);

        // backdrop + stars (house style)
        scene.add(new THREE.Mesh(new THREE.SphereGeometry(4000, 32, 24), new THREE.ShaderMaterial({
            side: THREE.BackSide, depthWrite: false,
            vertexShader: 'varying vec3 d; void main(){ d = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
            fragmentShader: `varying vec3 d; void main(){ vec3 v = normalize(d);
                float a = pow(max(dot(v, normalize(vec3(-.6,.35,-.7))),0.),2.5);
                float b = pow(max(dot(v, normalize(vec3(.75,-.2,-.6))),0.),2.5);
                float c = pow(max(dot(v, normalize(vec3(0.,.9,-.3))),0.),2.);
                gl_FragColor = vec4((vec3(.29,.17,.58)*a + vec3(.36,.16,.43)*b + vec3(.106,.227,.47)*c)*.34, 1.); }`
        })));
        {
            const n = 1400, pos = new Float32Array(n * 3);
            for (let i = 0; i < n; i++) {
                const u = Math.random() * .95 + .05, th = Math.random() * TAU, r = Math.sqrt(1 - u * u), Rr = 1800 + Math.random() * 1500;
                pos.set([r * Math.cos(th) * Rr, u * Rr, r * Math.sin(th) * Rr], i * 3);
            }
            const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
            scene.add(new THREE.Points(g, new THREE.PointsMaterial({ size: 1.4, sizeAttenuation: false, color: 0xd8d0ff, transparent: true, opacity: .6, depthWrite: false })));
        }

        // helpers
        const additive = { transparent: true, blending: THREE.AdditiveBlending, depthWrite: false };
        const radialTex = (size, stops) => {
            const c = document.createElement('canvas'); c.width = c.height = size;
            const g = c.getContext('2d'), h = size / 2, gr = g.createRadialGradient(h, h, 0, h, h, h);
            stops.forEach(([o, a]) => gr.addColorStop(o, `rgba(255,255,255,${a})`));
            g.fillStyle = gr; g.fillRect(0, 0, size, size);
            return new THREE.CanvasTexture(c);
        };
        const glowTex = radialTex(128, [[0, 1], [.25, .4], [.6, .08], [1, 0]]);
        const dotTex = radialTex(64, [[0, 1], [.35, .8], [1, 0]]);
        function glow(color, size, opacity = .5) {
            const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color, opacity, ...additive }));
            s.scale.setScalar(size); return s;
        }
        const RIM_VS = 'varying vec3 n; varying vec3 v; void main(){ n = normalize(normalMatrix*normal); vec4 mv = modelViewMatrix*vec4(position,1.); v = -mv.xyz; gl_Position = projectionMatrix*mv; }';
        function glassMaterial(color, strength = 1) {
            return new THREE.ShaderMaterial({
                uniforms: { uColor: { value: C(color) }, uStrength: { value: strength }, uFlash: { value: 0 } },
                vertexShader: RIM_VS,
                fragmentShader: `uniform vec3 uColor; uniform float uStrength; uniform float uFlash; varying vec3 n; varying vec3 v;
                    void main(){ float f = pow(1. - abs(dot(normalize(n), normalize(v))), 2.4);
                    gl_FragColor = vec4((uColor * (f * .95 + .045) + vec3(1.)*uFlash*(f*.6+.08)) * uStrength, 1.); }`,
                ...additive
            });
        }
        // glowing dots sitting on a mesh's surface; uScatter pushes them off the body (low embodiment)
        function surfacePoints(color, size) {
            return new THREE.ShaderMaterial({
                uniforms: { uColor: { value: C(color) }, uOpacity: { value: 1 }, uScatter: { value: 0 }, uTime: { value: 0 }, uSize: { value: size } },
                vertexShader: `uniform float uScatter; uniform float uTime; uniform float uSize; varying float vH;
                    void main(){ float h = fract(sin(dot(position, vec3(12.9898,78.233,37.719)))*43758.5453); vH = h;
                    vec3 p = position + normal*uScatter*(h*1.4+.3)*(1.+.35*sin(uTime*1.3+h*20.))
                           + vec3(sin(uTime*.7+h*30.), cos(uTime*.9+h*17.), sin(uTime*.5+h*9.))*uScatter*.45;
                    vec4 mv = modelViewMatrix*vec4(p,1.); gl_PointSize = uSize*(320./-mv.z); gl_Position = projectionMatrix*mv; }`,
                fragmentShader: `uniform vec3 uColor; uniform float uOpacity; varying float vH;
                    void main(){ float d = length(gl_PointCoord-.5); if (d > .5) discard;
                    gl_FragColor = vec4(uColor*(1.-d*2.)*uOpacity*(.6+.4*vH), 1.); }`,
                ...additive
            });
        }

        // ---- the world (what the headset shows); rotated by the head-tracking lag ----
        const FEET = -150;
        const world = new THREE.Group(); scene.add(world);
        const floorMat = new THREE.ShaderMaterial({
            uniforms: { uP: { value: 0 }, uPrep: { value: 0 }, uTime: { value: 0 }, uRip: { value: [0, 0, 0, 0].map(() => new THREE.Vector2()) } },
            vertexShader: 'varying vec2 vp; void main(){ vp = position.xy; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
            fragmentShader: `uniform float uP; uniform float uPrep; uniform float uTime; uniform vec2 uRip[4]; varying vec2 vp;
                void main(){ float r = length(vp), a = atan(vp.y, vp.x);
                float fade = smoothstep(460., 140., r);
                float ring = 1. - smoothstep(0., 1.4, abs(fract(r/42. + .5) - .5)*42.);
                float spoke = (1. - smoothstep(0., 1.1, abs(fract(a/6.2832*36. + .5) - .5)*(6.2832/36.)*r)) * step(60., r);
                float grid = max(ring, spoke*.55) * fade * (.08 + .5*uP);
                float rip = 0.;
                for (int i = 0; i < 4; i++) rip += uRip[i].y * exp(-pow((r - uRip[i].x)/9., 2.));
                vec3 col = vec3(.30,.86,.94) * (grid + rip*fade*.9);
                float m = (1. - smoothstep(0., 1.4, abs(r - 54.))) + (1. - smoothstep(0., 1.1, abs(r - 68.)))*.6
                        + (1. - smoothstep(0., 1.4, abs(r - (34. + 7.*cos(a*12.)))))*step(r, 46.)*.8;
                col += vec3(.71,.61,.97) * m * uPrep * (.75 + .25*sin(uTime*1.2));
                col += vec3(.71,.61,.97) * exp(-r*r/1800.) * .12 * uPrep;
                gl_FragColor = vec4(col, 1.); }`,
            ...additive, side: THREE.DoubleSide
        });
        const floor = new THREE.Mesh(new THREE.CircleGeometry(470, 96), floorMat);
        floor.rotation.x = -Math.PI / 2; floor.position.y = FEET;
        world.add(floor);

        // crystals around the edge of the room (kept off the camera side)
        const crystals = [], ghostWorld = new THREE.Group(); scene.add(ghostWorld);
        const ghostMat = new THREE.LineBasicMaterial({ color: 0xffffff, opacity: 0, ...additive });
        for (let i = 0; i < 13; i++) {
            const ang = Math.PI * .34 + i / 12 * Math.PI * 1.32 + (Math.random() - .5) * .1;   // a horseshoe that opens towards the camera
            const Rr = 330 + Math.random() * 100, h = 90 + Math.random() * 200, w = 12 + Math.random() * 12;
            const geo = new THREE.CylinderGeometry(w * .35, w, h, 6, 1); geo.translate(0, h / 2, 0);
            const tip = new THREE.ConeGeometry(w * .35, w * 1.4, 6); tip.translate(0, h + w * .7, 0);
            const col = i % 3 === 0 ? '#B49BF8' : '#4CDCEF';
            const mat = glassMaterial(col, .2);
            const g = new THREE.Group();
            g.add(new THREE.Mesh(geo, mat), new THREE.Mesh(tip, mat));
            g.position.set(Math.sin(ang) * Rr, FEET, Math.cos(ang) * Rr); g.rotation.y = Math.random() * TAU;
            const base = glow(col, w * 7, 0); base.position.y = 6; g.add(base);
            world.add(g);
            const gh = new THREE.Group();
            gh.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo), ghostMat), new THREE.LineSegments(new THREE.EdgesGeometry(tip), ghostMat));
            gh.position.copy(g.position); gh.rotation.copy(g.rotation);
            ghostWorld.add(gh);
            crystals.push({ mat, base, R: Rr, flash: 0 });
        }
        // a dome of light that only forms with presence
        const domeMat = new THREE.PointsMaterial({ size: 3, map: dotTex, vertexColors: true, opacity: 0, ...additive });
        {
            const n = 1500, pos = new Float32Array(n * 3), col = new Float32Array(n * 3), a = C('#4CDCEF'), b = C('#B49BF8'), tmpc = new THREE.Color();
            for (let i = 0; i < n; i++) {
                const u = Math.random() * .92 + .04, th = Math.random() * TAU, r = Math.sqrt(1 - u * u), Rr = 640 + Math.random() * 60;
                pos.set([r * Math.cos(th) * Rr, FEET + u * Rr * .8, r * Math.sin(th) * Rr], i * 3);
                tmpc.copy(a).lerp(b, Math.random()); col.set([tmpc.r, tmpc.g, tmpc.b], i * 3);
            }
            const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
            world.add(new THREE.Points(g, domeMat));
        }

        // ---- the client ----
        const body = new THREE.Group(); body.position.y = FEET + 4; body.rotation.y = -.5; scene.add(body);
        const bodyMat = glassMaterial('#B49BF8', 0), handMat = glassMaterial('#B49BF8', 0);
        const bodyPts = surfacePoints('#B49BF8', 2.2), handPts = surfacePoints('#B49BF8', 2.4);
        function part(parent, geo, p, s, hand) {
            const m = new THREE.Mesh(geo, hand ? handMat : bodyMat);
            m.position.set(...p); if (s) m.scale.set(...s);
            m.add(new THREE.Points(geo, hand ? handPts : bodyPts));
            parent.add(m); return m;
        }
        function limb(parent, a, b, r1, r2) {
            const A = V(...a), B = V(...b), d = B.clone().sub(A);
            const m = part(parent, new THREE.CylinderGeometry(r2, r1, d.length(), 20, 4, true), [0, 0, 0]);
            m.position.copy(A).add(B).multiplyScalar(.5);
            m.quaternion.setFromUnitVectors(V(0, 1, 0), d.normalize());
        }
        // legs stay with the body, the torso turns a little with the head, arms hang from the shoulders
        [-1, 1].forEach(sd => {
            limb(body, [sd * 15, 2, 0], [sd * 17, -70, 2], 14, 9.5);
            part(body, new THREE.SphereGeometry(9.5, 16, 12), [sd * 17, -70, 2]);
            limb(body, [sd * 17, -70, 2], [sd * 18, -138, 0], 9.5, 6.5);
            part(body, new THREE.SphereGeometry(8, 16, 12), [sd * 18, -145, 7], [.8, .5, 1.7]);
        });
        body.children.forEach(m => { m.position.y += 150; });   // feet at the floor
        const torso = new THREE.Group(); torso.position.y = 150; body.add(torso);
        const torsoProfile = [[0, -6], [24, -2], [33, 10], [33, 28], [28, 48], [30, 66], [37, 86], [43, 100], [42, 110], [31, 119], [13, 125], [9, 132], [9, 142], [0, 144]].map(p => new THREE.Vector2(p[0], p[1]));
        part(torso, new THREE.LatheGeometry(torsoProfile, 36), [0, 0, 0], [1, 1, .6]);
        const headPivot = new THREE.Group(); headPivot.position.y = 140; torso.add(headPivot);
        part(headPivot, new THREE.SphereGeometry(20, 36, 24), [0, 20, 0], [.92, 1.12, 1]);
        const arms = [-1, 1].map(sd => {
            const sh = new THREE.Group(); sh.position.set(sd * 41, 106, 0); torso.add(sh);
            part(sh, new THREE.SphereGeometry(10, 18, 12), [0, 0, 0]);
            limb(sh, [sd * 2, 0, 0], [sd * 11, -44, 0], 9, 7.5);
            part(sh, new THREE.SphereGeometry(7.5, 14, 10), [sd * 11, -44, 0]);
            limb(sh, [sd * 11, -44, 0], [sd * 15, -86, 4], 7.5, 5.5);
            part(sh, new THREE.SphereGeometry(7, 16, 12), [sd * 16, -96, 5], [.75, 1.35, .55], true);
            return { sh, sd };
        });
        const heart = glow('#E562A4', 70, 0); heart.position.set(-6, 96, 8); torso.add(heart);

        // the real head: headset, viewpoint and gaze. Always there, even with no avatar.
        const realHead = new THREE.Group(); realHead.position.y = 150 + 160; body.add(realHead);
        const visorMat = glassMaterial('#4CDCEF', 1);
        const visor = new THREE.Mesh(new THREE.CylinderGeometry(23, 23, 15, 32, 1, true, -Math.PI * .42, Math.PI * .84), visorMat);
        visor.position.set(0, 4, 2); realHead.add(visor);
        const strap = new THREE.Mesh(new THREE.TorusGeometry(22.5, 1.1, 6, 48), new THREE.MeshBasicMaterial({ color: 0x4CDCEF, opacity: .5, ...additive }));
        strap.rotation.x = Math.PI / 2; strap.position.y = 4; realHead.add(strap);
        const eye = glow('#ffffff', 26, .8); eye.position.set(0, 4, 6); realHead.add(eye);
        const gazeMat = new THREE.ShaderMaterial({
            uniforms: { uOpacity: { value: .12 } },
            vertexShader: 'varying float vY; void main(){ vY = uv.y; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
            fragmentShader: 'uniform float uOpacity; varying float vY; void main(){ gl_FragColor = vec4(vec3(.3,.86,.94)*uOpacity*pow(vY, 1.6), 1.); }',
            ...additive, side: THREE.DoubleSide
        });
        const gazeGeo = new THREE.ConeGeometry(70, 300, 32, 1, true); gazeGeo.translate(0, -150, 0); gazeGeo.rotateX(-Math.PI / 2);
        const gaze = new THREE.Mesh(gazeGeo, gazeMat); gaze.position.set(0, 4, 8); realHead.add(gaze);

        // ---- sensory channels: sight, sound, motion, touch ----
        const SENSES = [
            { name: 'sight', c: '#4CDCEF', y: 312, r: 34, k: 0 },
            { name: 'sound', c: '#B49BF8', y: 262, r: 56, k: .41 },
            { name: 'motion', c: '#5FDFA6', y: 214, r: 72, k: -.33 },
            { name: 'touch', c: '#DDB049', y: 160, r: 90, k: .67 }
        ].map(s => {
            const g = new THREE.Group(); scene.add(g);
            const ringMat = new THREE.MeshBasicMaterial({ color: s.c, opacity: .5, ...additive });
            const ring = new THREE.Mesh(new THREE.TorusGeometry(s.r, 1.1, 6, 128), ringMat); ring.rotation.x = Math.PI / 2; g.add(ring);
            const waveMat = new THREE.MeshBasicMaterial({ color: s.c, opacity: 0, ...additive });
            const wave = new THREE.Mesh(new THREE.TorusGeometry(s.r, .8, 6, 128), waveMat); wave.rotation.x = Math.PI / 2; g.add(wave);
            const anchor = new THREE.Object3D(); anchor.position.set(s.r + 10, 0, 0); g.add(anchor);
            const off = V(Math.random() - .5, (Math.random() - .5) * .6, Math.random() - .5).normalize();
            return { ...s, g, ring, ringMat, wave, waveMat, anchor, off, tilt: [(Math.random() - .5) * 1.6, (Math.random() - .5) * 1.6], ph: Math.random() * TAU };
        });

        // ---- preparation: the threshold they walked through, and the path in ----
        const back = V(-Math.sin(body.rotation.y), 0, -Math.cos(body.rotation.y));   // behind the client
        const arch = new THREE.Group(); arch.position.copy(back.clone().multiplyScalar(250)).setY(FEET); scene.add(arch);
        arch.lookAt(V(0, FEET, 0));
        const archCurve = new THREE.CurvePath();
        archCurve.add(new THREE.LineCurve3(V(-62, 0, 0), V(-62, 170, 0)));
        archCurve.add(new THREE.CubicBezierCurve3(V(-62, 170, 0), V(-62, 250, 0), V(62, 250, 0), V(62, 170, 0)));
        archCurve.add(new THREE.LineCurve3(V(62, 170, 0), V(62, 0, 0)));
        const archGeo = new THREE.TubeGeometry(archCurve, 160, 3.2, 8, false);
        const archMat = glassMaterial('#B49BF8', 1);
        const archMesh = new THREE.Mesh(archGeo, archMat); arch.add(archMesh);
        const archTotal = archGeo.index.count;
        const portalMat = new THREE.ShaderMaterial({
            uniforms: { uOpacity: { value: 0 }, uTime: { value: 0 } },
            vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
            fragmentShader: `uniform float uOpacity; uniform float uTime; varying vec2 vUv;
                void main(){ float d = 1. - smoothstep(0., .5, length((vUv - vec2(.5,.38))*vec2(1.,.8)));
                vec3 c = mix(vec3(.71,.61,.97), vec3(.3,.86,.94), vUv.y) * d * (.8 + .2*sin(uTime*1.5 + vUv.y*8.));
                gl_FragColor = vec4(c*uOpacity, 1.); }`,
            ...additive, side: THREE.DoubleSide
        });
        const portal = new THREE.Mesh(new THREE.PlaneGeometry(120, 240), portalMat); portal.position.y = 118; arch.add(portal);
        const pathDots = Array.from({ length: 14 }, (_, i) => {
            const s = glow('#B49BF8', 22, 0); const t = (i + 1) / 15;
            s.position.copy(arch.position.clone().lerp(V(0, FEET, 0), t * .82)).setY(FEET + 2);
            scene.add(s); return s;
        });

        // ---- motes: drift on their own, or gather where the client looks ----
        const MOTES = opts.lite ? 180 : 300, motePos = new Float32Array(MOTES * 3);
        const motes = Array.from({ length: MOTES }, () => ({ a: Math.random() * TAU, r: 120 + Math.random() * 330, y: FEET + 20 + Math.random() * 380, s: (.04 + Math.random() * .08) * (Math.random() < .5 ? -1 : 1), p: V() }));
        motes.forEach(m => m.p.set(Math.cos(m.a) * m.r, m.y, Math.sin(m.a) * m.r));
        const moteGeo = new THREE.BufferGeometry(); moteGeo.setAttribute('position', new THREE.BufferAttribute(motePos, 3));
        const moteMat = new THREE.PointsMaterial({ size: 4, map: dotTex, color: 0xBDEFF7, opacity: .5, ...additive });
        const moteObj = new THREE.Points(moteGeo, moteMat); moteObj.frustumCulled = false; scene.add(moteObj);

        // ---- full immersion: a stream joining body and world ----
        const HEL = 260, helPos = new Float32Array(HEL * 3), helCol = new Float32Array(HEL * 3);
        const helGeo = new THREE.BufferGeometry(); helGeo.setAttribute('position', new THREE.BufferAttribute(helPos, 3)); helGeo.setAttribute('color', new THREE.BufferAttribute(helCol, 3));
        const helMat = new THREE.PointsMaterial({ size: 5, map: dotTex, vertexColors: true, opacity: 0, ...additive });
        const helObj = new THREE.Points(helGeo, helMat); helObj.frustumCulled = false; scene.add(helObj);
        const brandAt = (() => { const a = C('#4CDCEF'), b = C('#B49BF8'), c = C('#E562A4'), t = new THREE.Color(); return u => u < .5 ? t.copy(a).lerp(b, u * 2) : t.copy(b).lerp(c, u * 2 - 1); })();

        // ---- labels ----
        const labelsEl = root.querySelector('.labels'), labelList = [];
        function addLabel(obj, text, color) {
            const n = el('div', 'lab', text); n.style.setProperty('--c', color); labelsEl.appendChild(n);
            const item = { obj, el: n, op: 1 }; labelList.push(item); return item;
        }
        const anchorAt = (parent, pos) => { const o = new THREE.Object3D(); o.position.copy(pos); parent.add(o); return o; };
        const senseLabels = SENSES.map(s => addLabel(s.anchor, s.name, s.c));
        const headsetLabel = addLabel(anchorAt(realHead, V(0, 52, 0)), 'headset', '#4CDCEF');
        const thresholdLabel = addLabel(anchorAt(arch, V(0, 268, 0)), 'threshold', '#B49BF8');
        const ghostLabel = addLabel(anchorAt(scene, ghostWorld.children[6].position.clone().add(V(0, 40, 0))), 'where the world should be', '#F1EEFB');

        // ================= layout =================
        let W = 0, H = 0, layout = '';
        // the part of the screen the panels leave free for the room
        function freeBand() {
            if (W < 640) return { top: 112, bottom: H * .5 - 26, left: 0, right: 0 };
            if (W < 1240) return { top: 96, bottom: H * .56 - 26, left: 0, right: 0 };
            return { top: 0, bottom: H, left: 388, right: 360 };
        }
        // pull the camera back until the room (about 860 wide, 520 tall) fits the free band
        function homePos() {
            const b = freeBand(), t = Math.tan(camera.fov * Math.PI / 360);
            const bandH = Math.max(120, b.bottom - b.top), bandW = Math.max(200, W - b.left - b.right);
            const fitW = W < 640 ? 470 : 860;
            const dist = Math.max(HOME_POS.distanceTo(HOME_TARGET) * (W >= 1240 ? 1 : 0), 520 * H / bandH / (2 * t), fitW * W / bandW / (2 * t * camera.aspect));
            return HOME_TARGET.clone().add(HOME_POS.clone().sub(HOME_TARGET).normalize().multiplyScalar(dist));
        }
        function home() {
            camera.position.copy(homePos()); controls.target.copy(HOME_TARGET);
            controls.maxDistance = Math.max(1800, camera.position.distanceTo(HOME_TARGET) * 1.6);
        }
        function resize() {
            const w = root.clientWidth, h = root.clientHeight;
            if (!w || !h) return;   // hidden (e.g. lesson module not shown yet)
            W = w; H = h;
            renderer.setSize(W, H); composer.setSize(W, H);
            camera.aspect = W / H; camera.updateProjectionMatrix();
            root.classList.toggle('pe-compact', W < 1240);
            root.classList.toggle('pe-phone', W < 640);
            const now = W < 640 ? 'phone' : W < 1240 ? 'tablet' : 'desktop';
            if (now !== layout) { layout = now; home(); }   // re-frame when the layout changes
        }
        const ro = new ResizeObserver(resize);
        ro.observe(root);

        // ================= frame =================
        const S = {};                         // smoothed slider values 0..1
        SLIDERS.forEach(s => { S[s.id] = vals[s.id] / 100; });
        let pNow = 0, eNow = 0, time = 0, yawLag = 0, ripT = 0, ripI = 0;
        const rips = [0, 0, 0, 0].map(() => ({ r: 0, a: 0 }));
        const tmp = V(), gazeTarget = V(), bodyCol = new THREE.Color(), BODY_A = C('#B49BF8'), BODY_B = C('#E562A4');

        function frame(dtIn) {
            if (!W || !H) { resize(); if (!W) return; }
            const dt = Math.min(Math.max(dtIn || 0, 0), .05);
            time += dt;
            tickTween(dt);
            const tg = targets(vals);
            const k = 1 - Math.pow(1 - .035, dt * 60);        // same smoothing as the previous version
            pNow += (tg.p - pNow) * k; eNow += (tg.e - eNow) * k;
            const ks = 1 - Math.pow(1 - .08, dt * 60);
            SLIDERS.forEach(s => { S[s.id] += (vals[s.id] / 100 - S[s.id]) * ks; });
            const P = pNow / 100, E = eNow / 100;
            const Pm = smooth(.05, .85, P), Em = smooth(.05, .85, E);

            // meters + map
            refs.pn.firstChild.nodeValue = Math.round(pNow); refs.en.firstChild.nodeValue = Math.round(eNow);
            refs.pm.style.width = pNow + '%'; refs.em.style.width = eNow + '%';
            const x = mx(pNow), y = my(eNow);
            dot.setAttribute('cx', x); dot.setAttribute('cy', y); dotHalo.setAttribute('cx', x); dotHalo.setAttribute('cy', y);
            dotHalo.setAttribute('r', 9 + 3 * Math.sin(time * 3));
            const last = trailPts[trailPts.length - 1];
            if (!last || Math.hypot(last[0] - x, last[1] - y) > 1.5) { trailPts.push([x, y]); if (trailPts.length > 60) trailPts.shift(); }
            trail.setAttribute('points', trailPts.map(p => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' '));
            showProfile(profileAt(tg.p, tg.e));
            if (W < 640) {
                refs.mpn.textContent = Math.round(pNow); refs.men.textContent = Math.round(eNow);
                refs.ms.textContent = shown ? shown.name : IDLE.name; refs.ms.style.setProperty('--c', shown ? shown.c : '');
            }

            // --- the client moves: looks around (their real head) ---
            const yawReal = .62 * Math.sin(time * .55) + .22 * Math.sin(time * 1.37 + 1);
            const gest = Math.pow(Math.max(0, Math.sin(time * .42 - .6)), 2);
            realHead.rotation.y = yawReal;

            // s1 synchrony: the world lags behind the head
            const tau = .012 + Math.pow(1 - S.s1, 1.7) * .95;
            yawLag += (yawReal - yawLag) * (1 - Math.exp(-Math.max(dt, 1e-4) / tau));
            const drift = yawReal - yawLag;
            world.rotation.y = drift;
            ghostMat.opacity = clamp01(Math.abs(drift) * 5) * (.15 + Pm * .85) * .32;
            ghostLabel.op = clamp01(Math.abs(drift) * 6 - .4) * smooth(.55, .8, 1 - S.s1);

            // presence: the world materialises, the headset fades
            domeMat.opacity = .05 + Pm * .7;
            floorMat.uniforms.uP.value = Pm; floorMat.uniforms.uTime.value = time;
            visorMat.uniforms.uStrength.value = .12 + Math.pow(1 - P, 1.4) * 1.3;
            strap.material.opacity = .06 + (1 - Pm) * .5;
            headsetLabel.op = smooth(.35, .75, 1 - P);
            gazeMat.uniforms.uOpacity.value = .05 + .09 * (1 - Em * .5);

            // s2 responsiveness: ripples from the feet, crystals answer, motes gather where they look
            const resp = S.s2;
            ripT += dt;
            if (ripT > 1.5) { ripT = 0; const r = rips[ripI++ % 4]; r.r = 0; r.a = resp; }
            rips.forEach((r, i) => {
                if (r.a > 0) { r.r += dt * 150; if (r.r > 460) r.a = 0; }
                floorMat.uniforms.uRip.value[i].set(r.r, r.a * (1 - r.r / 470) * .9);
            });
            crystals.forEach(c => {
                rips.forEach(r => { if (r.a > .02 && Math.abs(r.r - c.R) < 8) c.flash = Math.max(c.flash, r.a); });
                c.flash = Math.max(0, c.flash - dt * 1.4);
                c.mat.uniforms.uStrength.value = .1 + Pm * .95;
                c.mat.uniforms.uFlash.value = c.flash * .9;
                c.base.material.opacity = (.05 + c.flash * .6) * (.2 + Pm);
            });
            realHead.updateMatrixWorld(true);
            realHead.localToWorld(gazeTarget.set(0, -20, 230));
            motes.forEach((m, i) => {
                m.a += m.s * dt * (1 - resp * .4);
                tmp.set(Math.cos(m.a) * m.r, m.y + Math.sin(time * .5 + i) * 6, Math.sin(m.a) * m.r);
                const pull = resp * .8 * Math.exp(-tmp.distanceTo(gazeTarget) / 260);
                if (pull > .01) tmp.lerp(V(gazeTarget.x + Math.sin(i * 7.1) * 60, gazeTarget.y + Math.cos(i * 3.3) * 50, gazeTarget.z + Math.sin(i * 1.9) * 60), pull);
                m.p.lerp(tmp, Math.min(1, dt * 2.5));
                motePos.set([m.p.x, m.p.y, m.p.z], i * 3);
            });
            moteGeo.attributes.position.needsUpdate = true;
            moteMat.opacity = .25 + Pm * .35 + resp * .2;

            // s3 avatar: viewpoint -> hands -> still body -> synchronized body
            const av = S.s3;
            const handsVis = smooth(.1, .3, av), outlineVis = smooth(.3, .5, av), glassVis = smooth(.45, .7, av), sync = smooth(.62, .95, av);
            const scatter = (1 - E) * 22;
            bodyCol.copy(BODY_A).lerp(BODY_B, Em * .8);
            [bodyMat, handMat].forEach(m => m.uniforms.uColor.value.copy(bodyCol));
            [bodyPts, handPts].forEach(m => { m.uniforms.uColor.value.copy(bodyCol); m.uniforms.uScatter.value = scatter; m.uniforms.uTime.value = time; });
            bodyMat.uniforms.uStrength.value = glassVis * (.45 + .6 * Em);
            handMat.uniforms.uStrength.value = Math.max(handsVis * .8, glassVis) * (.45 + .6 * Em);
            bodyPts.uniforms.uOpacity.value = outlineVis * (1 - glassVis * .45) * .9;
            handPts.uniforms.uOpacity.value = handsVis * .9;
            heart.material.opacity = Math.max(outlineVis, handsVis * .3) * Em * (.35 + .35 * Math.pow(Math.max(0, Math.sin(time * 7)), 8));
            // the avatar copies the real movement only as far as it is synchronized
            torso.rotation.y = yawReal * .25 * sync;
            headPivot.rotation.y = yawReal * .75 * sync;
            arms.forEach(({ sh, sd }) => {
                const g = sd > 0 ? gest : gest * .25;
                sh.rotation.z = sd * (.08 + g * 1.1 * sync);
                sh.rotation.x = -g * .7 * sync;
            });

            // s4 coherence: the senses line up and pulse together
            const frag = 1 - S.s4;
            SENSES.forEach((s, i) => {
                const wob = Math.sin(time * (.6 + i * .17) + s.ph) * frag;
                s.g.position.set(s.off.x * frag * 52 + wob * 6, FEET + s.y + s.off.y * frag * 40, s.off.z * frag * 52);
                s.g.rotation.set(s.tilt[0] * frag * .7 + wob * .08, 0, s.tilt[1] * frag * .7);
                const f = 1 + s.k * frag * 1.4, phase = ((time * .8 * f + s.ph * frag) % 1 + 1) % 1;
                s.wave.scale.setScalar(1 + phase * .45);
                s.waveMat.opacity = (1 - phase) * (.15 + .45 * S.s4);
                s.ringMat.opacity = .22 + .5 * S.s4;
            });
            senseLabels.forEach(l => { l.op = .55 + .45 * S.s4; });

            // s5 preparation: the threshold, the path in, the grounding ring
            const prep = S.s5;
            archMesh.geometry.setDrawRange(0, Math.floor(archTotal * smooth(.02, .9, prep) / 6) * 6);
            archMat.uniforms.uStrength.value = .4 + prep * .8;
            portalMat.uniforms.uOpacity.value = smooth(.5, 1, prep) * .35; portalMat.uniforms.uTime.value = time;
            pathDots.forEach((d, i) => { d.material.opacity = smooth(i / 14 - .05, i / 14 + .12, prep) * (.35 + .15 * Math.sin(time * 2 - i * .6)); });
            floorMat.uniforms.uPrep.value = prep;
            thresholdLabel.op = smooth(.2, .5, prep);

            // full immersion: body and world share one stream of light
            const imm = smooth(.6, .85, Math.min(P, E));
            helMat.opacity = imm * .85;
            if (imm > .001) {
                for (let i = 0; i < HEL; i++) {
                    const u = ((i / HEL) + time * .06) % 1, a = u * TAU * 3 + (i % 2) * Math.PI;
                    const r = 70 + 40 * Math.sin(u * Math.PI) + (i % 2) * 18;
                    helPos.set([Math.cos(a) * r, FEET + u * 420, Math.sin(a) * r], i * 3);
                    const c = brandAt(u); helCol.set([c.r, c.g, c.b], i * 3);
                }
                helGeo.attributes.position.needsUpdate = true; helGeo.attributes.color.needsUpdate = true;
            }
            if (bloom) bloom.strength = .6 + imm * .35;

            controls.update();
            // centre the room in the space the panels leave free
            const band = freeBand(), shift = (band.left - band.right) / 2, offY = H / 2 - (band.top + band.bottom) / 2;
            if (Math.abs(shift) < .5 && Math.abs(offY) < .5) { if (camera.view && camera.view.enabled) camera.clearViewOffset(); }
            else camera.setViewOffset(W, H, -shift, offY, W, H);

            labelList.forEach(l => {
                l.obj.getWorldPosition(tmp); tmp.project(camera);
                if (tmp.z > 1 || l.op < .02) { l.el.style.opacity = 0; return; }
                l.el.style.opacity = l.op;
                const sx = (tmp.x * .5 + .5) * W, sy = (-tmp.y * .5 + .5) * H;
                l.el.style.transform = `translate(${sx.toFixed(1)}px, ${sy.toFixed(1)}px) translate(-50%, -50%)`;
            });
            composer.render();
        }

        // back to the starting session: default sliders, fresh map, camera home
        function reset() {
            Object.assign(vals, defaults());
            tween = null;
            setActive(null);
            syncInputs();
            trailPts.length = 0;
            found.clear(); shown = undefined; updateFound();
            home();
        }

        function destroy() {
            cleanups.forEach(fn => fn());
            ro.disconnect();
            controls.dispose();
            scene.traverse(obj => {
                if (obj.geometry) obj.geometry.dispose();
                if (obj.material) (Array.isArray(obj.material) ? obj.material : [obj.material]).forEach(m => m.dispose());
            });
            glowTex.dispose(); dotTex.dispose();
            if (composer.renderTarget1) composer.renderTarget1.dispose();
            if (composer.renderTarget2) composer.renderTarget2.dispose();
            renderer.dispose();
            if (renderer.forceContextLoss) renderer.forceContextLoss();
            renderer.domElement.remove();
            uiNodes.forEach(n => n.remove());
        }

        resize();
        return { frame, resize, reset, destroy };
    }

    // ------------------------------------------------------------------
    // ENGINE DEFINITION
    // ------------------------------------------------------------------
    window.SimulationEngines['PresenceEmbodimentSim'] = {
        name: 'Presence Embodiment Sim',
        showPlaybackControls: false,
        defaults: {},

        // The engine draws its own controls, so the host builds no slider.
        config: [],

        init: function (container, params, host) {
            this.host = host;
            this._destroyed = false;
            this._room = null;

            container.querySelectorAll(':scope > .pe3d').forEach(n => n.remove());
            const root = el('div', 'pe3d');
            root.setAttribute('role', 'region');
            root.setAttribute('aria-label', 'Presence and Embodiment: interactive 3D session room');
            const status = el('div', 'pe3d-status', 'Loading the 3D room…');
            root.appendChild(status);
            container.appendChild(root);
            if (getComputedStyle(container).position === 'static') container.style.position = 'relative';
            this._root = root;

            const lite = (window.matchMedia('(pointer: coarse)').matches && Math.min(window.innerWidth, window.innerHeight) < 600);
            loadDeps().then(() => {
                if (this._destroyed) return;
                status.remove();
                this._room = createRoom(root, { lite });
                console.log('[PresenceEmbodimentSim] 3D Threshold Room initialized');
            }).catch(err => {
                console.error('[PresenceEmbodimentSim] Could not load three.js add-ons', err);
                status.textContent = 'The 3D view could not load. Check your connection and reload the page.';
                status.classList.add('error');
            });
        },

        // Host calls this every frame (dt in seconds)
        update: function (dt) {
            if (this._room) this._room.frame(dt);
        },

        resize: function () {
            if (this._room) this._room.resize();
        },

        reset: function () {
            if (this._room) this._room.reset();
        },

        destroy: function () {
            this._destroyed = true;
            if (this._room) this._room.destroy();
            if (this._root) this._root.remove();
            this._room = null;
            this._root = null;
        }
    };
})();
