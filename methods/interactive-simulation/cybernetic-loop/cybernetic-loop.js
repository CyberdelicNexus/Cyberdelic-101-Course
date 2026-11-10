/**
 * Cybernetic Loop - Simulation Engine (3D "Biofeedback Loop")
 * Registers itself to window.SimulationEngines['CyberneticLoop'].
 *
 * A glass avatar's signal travels a loop of five stations: Body Signal → Sensor
 * Detection (devices from the course data, linked to where they are worn) →
 * Algorithm Processing (a live screen per signal) → VR Environment Response (a
 * particle world matched to each signal) → Learner Adjustment (strategies, a
 * target-zone gauge and a learning spiral), then back into the body.
 *
 * - Content comes from cybernetic-loop-data.js (window.CyberneticLoopData).
 * - The engine draws its own controls (signal tabs, calm/tense slider or EEG
 *   band picker, step panel), so `config` is empty and the host builds no slider.
 *   A manifest can choose the starting signal: content.params.signal.
 * - three.js add-ons (OrbitControls, bloom) are loaded on demand, so host pages only
 *   need three.min.js (and work without it too: three is loaded if missing).
 * - The previous 2D canvas version lives in cybernetic-loop-2d.js.
 */
(function () {
    'use strict';

    window.SimulationEngines = window.SimulationEngines || {};

    // Loop steps mapped onto the Cyberdelic Nexus palette
    const BRAND = {
        body: '#5FDFA6',      // chlorophyll green
        sensor: '#4CDCEF',    // cyan
        algorithm: '#B49BF8', // violet
        vr: '#E562A4',        // magenta
        adjustment: '#DDB049' // academy amber
    };
    const SIGNALS = [
        ['eeg', 'EEG · Brain'],
        ['hrv', 'HRV · Heart'],
        ['gsr', 'GSR · Skin'],
        ['respiration', 'Breath']
    ];

    // ------------------------------------------------------------------
    // Dependency loader (shared by every instance on the page)
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
        if (window.__cnLoopDeps) return window.__cnLoopDeps;
        window.__cnLoopDeps = (async () => {
            if (!window.THREE) await loadScript(THREE_CDN);
            for (const [name, path] of DEPS) {
                if (!window.THREE[name]) await loadScript(EXAMPLES + path);
            }
        })();
        window.__cnLoopDeps.catch(() => { window.__cnLoopDeps = null; });   // allow a retry on the next init
        return window.__cnLoopDeps;
    }

    const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text !== undefined) n.textContent = text; return n; };

    // ------------------------------------------------------------------
    // Stage: renderer, camera, bloom, backdrop, UI (tabs, dock, step panel, labels)
    // ------------------------------------------------------------------
    function createStage(root, opts) {
        const THREE = window.THREE;
        const DATA = window.CyberneticLoopData;
        const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        const cleanups = [];
        const on = (target, type, fn, o) => { target.addEventListener(type, fn, o); cleanups.push(() => target.removeEventListener(type, fn, o)); };

        // ---------- renderer / camera / bloom ----------
        const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, opts.lite ? 1.5 : 2));
        renderer.setClearColor(0x000000, 1);
        renderer.domElement.className = 'cl3d-canvas';
        root.prepend(renderer.domElement);
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(42, 1, 1, 9000);
        camera.position.set(70, 120, 1160);
        const controls = new THREE.OrbitControls(camera, renderer.domElement);
        controls.target.set(70, 40, 0);
        Object.assign(controls, { enableDamping: true, dampingFactor: 0.06, enablePan: false, minDistance: 80, maxDistance: 2600, rotateSpeed: 0.5, zoomSpeed: 0.7 });

        // Inside a scrolling lesson page, plain wheel scrolls the page and Ctrl/⌘ + wheel zooms.
        // On a full-screen page (nothing to scroll), plain wheel zooms.
        const pageScrolls = () => {
            const se = document.scrollingElement || document.documentElement;
            return se.scrollHeight > window.innerHeight + 4;
        };
        on(renderer.domElement, 'wheel', e => {
            controls.enableZoom = !pageScrolls() || e.ctrlKey || e.metaKey;
        }, { capture: true, passive: true });

        const composer = new THREE.EffectComposer(renderer);
        composer.addPass(new THREE.RenderPass(scene, camera));
        const bloom = new THREE.UnrealBloomPass(new THREE.Vector2(256, 256), 0.75, 0.55, 0.3);
        if (!opts.lite) composer.addPass(bloom);

        // ---------- backdrop: blob light + stars ----------
        scene.add(new THREE.Mesh(new THREE.SphereGeometry(4000, 32, 24), new THREE.ShaderMaterial({
            side: THREE.BackSide, depthWrite: false,
            vertexShader: 'varying vec3 d; void main(){ d = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
            fragmentShader: `varying vec3 d; void main(){
                vec3 v = normalize(d);
                float a = pow(max(dot(v, normalize(vec3(-.6,.35,-.7))),0.),2.5);
                float b = pow(max(dot(v, normalize(vec3(.75,-.2,-.6))),0.),2.5);
                float c = pow(max(dot(v, normalize(vec3(0.,-.85,-.4))),0.),2.);
                gl_FragColor = vec4((vec3(.29,.17,.58)*a + vec3(.36,.16,.43)*b + vec3(.106,.227,.47)*c)*.4, 1.); }`
        })));
        {
            const n = 1800, pos = new Float32Array(n * 3);
            for (let i = 0; i < n; i++) {
                const u = Math.random() * 2 - 1, th = Math.random() * 6.283, r = Math.sqrt(1 - u * u), R = 1800 + Math.random() * 1500;
                pos.set([r * Math.cos(th) * R, u * R, r * Math.sin(th) * R], i * 3);
            }
            const g = new THREE.BufferGeometry();
            g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
            scene.add(new THREE.Points(g, new THREE.PointsMaterial({ size: 1.4, sizeAttenuation: false, color: 0xd8d0ff, transparent: true, opacity: .7, depthWrite: false })));
        }

        // ---------- helpers ----------
        const glowTex = (() => {
            const c = document.createElement('canvas'); c.width = c.height = 128;
            const g = c.getContext('2d'), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
            gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.25, 'rgba(255,255,255,.4)'); gr.addColorStop(.6, 'rgba(255,255,255,.08)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
            g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
            return new THREE.CanvasTexture(c);
        })();
        const additive = { transparent: true, blending: THREE.AdditiveBlending, depthWrite: false };
        function glow(color, size, opacity = .5) {
            const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color, opacity, ...additive }));
            s.scale.setScalar(size);
            return s;
        }
        // Dark orb with a colour rim (fresnel): the house "obsidian plate" look
        function orbMaterial(color) {
            return new THREE.ShaderMaterial({
                uniforms: { uColor: { value: new THREE.Color(color) }, uBoost: { value: 0 } },
                vertexShader: 'varying vec3 n; varying vec3 v; void main(){ n = normalize(normalMatrix*normal); vec4 mv = modelViewMatrix*vec4(position,1.); v = -mv.xyz; gl_Position = projectionMatrix*mv; }',
                fragmentShader: `uniform vec3 uColor; uniform float uBoost; varying vec3 n; varying vec3 v;
                    void main(){ float f = pow(1. - max(dot(normalize(n), normalize(v)), 0.), 2.4);
                    gl_FragColor = vec4(vec3(.035,.025,.07) + uColor * (f * (1.4 + uBoost * 1.5) + uBoost * .25), 1.); }`
            });
        }
        function tube(curve, color, radius, opacity, segments = 200, closed = false) {
            return new THREE.Mesh(new THREE.TubeGeometry(curve, segments, radius, 8, closed),
                new THREE.MeshBasicMaterial({ color, opacity, ...additive }));
        }

        // ---------- UI ----------
        const head = el('header', 'cl3d-head');
        head.append(el('span', 'cl3d-eb', opts.eyebrow), el('h1', null, opts.title), el('span', 'cl3d-bar'), el('p', null, opts.sub));
        const tabs = el('div', 'cl3d-tabs');
        tabs.setAttribute('role', 'group');
        tabs.setAttribute('aria-label', 'Signal type');
        const labels = el('div', 'cl3d-labels');
        const dock = el('div', 'cl3d-dock');
        const calmL = el('span', 'cl3d-lbl', 'Calm');
        const range = Object.assign(el('input'), { type: 'range', min: 0, max: 1, step: 0.01, value: 0.65 });
        range.setAttribute('aria-label', 'Stress level');
        const tenseL = el('span', 'cl3d-lbl', 'Tense');
        const stateOut = el('span', 'cl3d-eb cl3d-state', '');
        stateOut.setAttribute('aria-live', 'polite');
        // EEG band picker: replaces the calm/tense slider for EEG
        const bands = el('div', 'cl3d-bands');
        bands.setAttribute('role', 'group');
        bands.setAttribute('aria-label', 'Brainwave band');
        const BANDS = [['theta', 'Theta', '4–8 Hz · deep'], ['alpha', 'Alpha', '8–12 Hz · relaxed'], ['beta', 'Beta', '13–30 Hz · focused']];
        BANDS.forEach(([id, name, hz]) => {
            const b = el('button');
            b.type = 'button';
            b.dataset.id = id;
            b.append(el('strong', null, name), el('small', null, hz));
            b.addEventListener('click', () => setBand(id));
            bands.appendChild(b);
        });
        dock.append(calmL, range, tenseL, stateOut, bands);
        const panel = el('aside', 'cl3d-panel');
        panel.setAttribute('aria-live', 'polite');
        root.append(labels, head, tabs, dock, panel);

        const state = { signal: DATA[opts.signal] ? opts.signal : 'eeg', stress: 0.65, band: 'alpha', open: null, time: 0 };
        const frameFns = [], signalFns = [], pickables = [];
        const nodes = () => DATA[state.signal];

        function setBand(id) {
            state.band = id;
            bands.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.id === id)));
        }
        setBand(state.band);
        function setDockMode(mode) { dock.classList.toggle('cl3d-dock--bands', mode === 'bands'); }

        function setStress(v) {
            state.stress = v;
            stateOut.textContent = v < .35 ? 'Coherent' : v < .7 ? 'Settling' : 'Stressed';
            stateOut.style.color = v < .35 ? '#5FDFA6' : v < .7 ? '#B49BF8' : '#FF5C72';
        }
        range.addEventListener('input', () => setStress(Number(range.value)));
        setStress(0.65);

        SIGNALS.forEach(([id, name]) => {
            const b = el('button', null, name);
            b.type = 'button';
            b.dataset.id = id;
            b.addEventListener('click', () => setSignal(id));
            tabs.appendChild(b);
        });
        function setSignal(id) {
            state.signal = id;
            tabs.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.id === id)));
            signalFns.forEach(fn => fn(id));
            if (state.open !== null) openStep(state.open, false);
        }

        function openStep(i, fly = true) {
            const n = nodes()[i];
            state.open = i;
            panel.style.setProperty('--c', BRAND[n.id]);
            panel.replaceChildren();
            const close = el('button', 'cl3d-close', '✕');
            close.type = 'button';
            close.setAttribute('aria-label', 'Close');
            close.addEventListener('click', home);
            const nav = el('div', 'cl3d-nav');
            const prev = el('button', null, '← Prev'), next = el('button', null, 'Next →');
            prev.type = next.type = 'button';
            prev.addEventListener('click', () => openStep((i + 4) % 5));
            next.addEventListener('click', () => openStep((i + 1) % 5));
            nav.append(prev, next);
            panel.append(close, el('span', 'cl3d-eb', `Step ${n.step} of 5`), el('h2', null, n.title), el('span', 'cl3d-bar'),
                el('p', null, n.body), el('p', 'cl3d-why', n.why));
            if (n.example) { const ex = el('div', 'cl3d-ex'); ex.innerHTML = n.example; panel.appendChild(ex); }   // trusted local course data
            panel.appendChild(nav);
            panel.scrollTop = 0;
            panel.classList.add('open'); root.classList.add('cl3d--zoomed');
            if (fly && api.onOpen) api.onOpen(i);
        }
        function home() {
            state.open = null;
            panel.classList.remove('open'); root.classList.remove('cl3d--zoomed');
            if (api.onHome) api.onHome();
        }

        // ---------- camera flight ----------
        let flight = null;
        function flyTo(pos, target, instant) {
            flight = { p0: camera.position.clone(), p1: pos.clone(), t0: controls.target.clone(), t1: target.clone(), t: 0, dur: instant || reduceMotion ? .001 : 1.2 };
        }

        // ---------- labels ----------
        const labelList = [];
        const tmp = new THREE.Vector3();
        function addLabel(obj, text, color, onClick, offsetPx = 28, plain = false, side = false) {
            const n = el('div', 'cl3d-lab' + (plain ? ' plain' : '') + (side ? ' side' : ''), text);
            n.style.setProperty('--c', color || '#B49BF8');
            if (onClick) {
                n.addEventListener('click', onClick);
                n.setAttribute('role', 'button');
                n.tabIndex = 0;
                n.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } });
            }
            labels.appendChild(n);
            const item = { obj, el: n, offsetPx, side };
            labelList.push(item);
            return item;
        }

        // ---------- picking ----------
        const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
        function pick(e) {
            const r = renderer.domElement.getBoundingClientRect();
            ndc.set((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1);
            ray.setFromCamera(ndc, camera);
            const hit = ray.intersectObjects(pickables.filter(p => p.mesh.visible).map(p => p.mesh), false)[0];
            return hit ? pickables.find(p => p.mesh === hit.object).index : null;
        }
        let down = null;
        on(renderer.domElement, 'pointerdown', e => { down = [e.clientX, e.clientY]; });
        on(renderer.domElement, 'pointerup', e => {
            if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 5) { down = null; return; }
            down = null;
            const i = pick(e);
            if (i !== null) openStep(i); else if (state.open !== null) home();
        });
        on(renderer.domElement, 'pointermove', e => root.classList.toggle('cl3d--hovering', pick(e) !== null));

        // Escape closes the step panel, only while the pointer or focus is inside the simulation
        let pointerInside = false;
        on(root, 'pointerenter', () => { pointerInside = true; });
        on(root, 'pointerleave', () => { pointerInside = false; });
        on(window, 'keydown', e => {
            if (e.key !== 'Escape' || state.open === null) return;
            if (!pointerInside && !root.contains(document.activeElement)) return;
            home();
        });

        // ---------- resize ----------
        let W = 0, H = 0, started = false;
        function resize() {
            const w = root.clientWidth, h = root.clientHeight;
            if (!w || !h) return;   // hidden (e.g. lesson module not shown yet)
            const changed = w !== W || h !== H;
            W = w; H = h;
            renderer.setSize(W, H); composer.setSize(W, H);
            camera.aspect = W / H; camera.updateProjectionMatrix();
            root.classList.toggle('cl3d--compact', W < 1180);
            root.classList.toggle('cl3d--narrow', W < 860);
            if (started && changed) {   // keep whatever is in view framed
                if (state.open !== null) { if (api.onOpen) api.onOpen(state.open, true); }
                else if (api.onHome) api.onHome(true);
            }
        }
        const ro = new ResizeObserver(resize);
        ro.observe(root);

        // Screen area free of UI, where the camera frames things: below the tabs, above the dock,
        // and beside (wide) or above (narrow) the step panel
        function freeRect() {
            const narrow = W < 860;
            const r = { x0: 16, x1: W - 16, y0: tabs.offsetTop + tabs.offsetHeight + 12, y1: dock.offsetTop - 12 };
            if (narrow) r.y0 = 12 + tabs.offsetTop + tabs.offsetHeight;
            if (state.open !== null) {
                if (narrow) r.y1 = Math.min(r.y1, panel.offsetTop - 12);
                else r.x1 = panel.offsetLeft - 16;
            }
            return r;
        }

        // ---------- per-frame (driven by the host's update loop) ----------
        function frame(dtIn) {
            if (!W || !H) { resize(); if (!W) return; }
            const dt = Math.min(Math.max(dtIn || 0, 0), 0.05);
            state.time += dt;
            frameFns.forEach(fn => fn(dt, state.time));
            if (flight) {
                flight.t += dt / flight.dur;
                const k = 1 - Math.pow(1 - Math.min(1, flight.t), 4);
                camera.position.lerpVectors(flight.p0, flight.p1, k);
                controls.target.lerpVectors(flight.t0, flight.t1, k);
                if (flight.t >= 1) flight = null;
            }
            controls.update();
            labelList.forEach(l => {
                l.obj.getWorldPosition(tmp);
                tmp.project(camera);
                if (tmp.z > 1) { l.el.style.opacity = 0; return; }
                l.el.style.opacity = '';
                const x = (tmp.x * .5 + .5) * W, y = (-tmp.y * .5 + .5) * H;
                l.el.style.transform = l.side ? `translate(${(x + 14).toFixed(1)}px, ${(y - 12).toFixed(1)}px)`
                    : `translate(${x.toFixed(1)}px, ${(y + l.offsetPx).toFixed(1)}px) translateX(-50%)`;
            });
            composer.render();
        }

        function destroy() {
            cleanups.forEach(fn => fn());
            ro.disconnect();
            controls.dispose();
            scene.traverse(obj => {
                if (obj.geometry) obj.geometry.dispose();
                if (obj.material) {
                    (Array.isArray(obj.material) ? obj.material : [obj.material]).forEach(m => {
                        if (m.map) m.map.dispose();
                        m.dispose();
                    });
                }
            });
            glowTex.dispose();
            composer.renderTarget1 && composer.renderTarget1.dispose();
            composer.renderTarget2 && composer.renderTarget2.dispose();
            renderer.dispose();
            if (renderer.forceContextLoss) renderer.forceContextLoss();
            renderer.domElement.remove();
            [labels, head, tabs, dock, panel].forEach(n => n.remove());
        }

        const api = {
            THREE, scene, camera, controls, state, BRAND, nodes, glow, orbMaterial, tube, additive, reduceMotion,
            addLabel, flyTo, home, openStep, setDockMode, setBand,
            setStress: v => { range.value = v; setStress(v); },
            onFrame: fn => frameFns.push(fn),
            onSignal: fn => signalFns.push(fn),
            pickable: (mesh, index) => pickables.push({ mesh, index }),
            size: () => ({ W, H }),
            freeRect, frame, resize, destroy,
            start() {
                setSignal(state.signal);
                resize();
                started = true;
                if (W && api.onHome) api.onHome(true);
            }
        };
        return api;
    }

    // ------------------------------------------------------------------
    // The loop scene, built on the stage
    // ------------------------------------------------------------------
    function buildLoop(M) {
        const { THREE, scene, BRAND, state } = M;
        const BODY_X = -470, WORLD_X = 520;
        const C = h => new THREE.Color(h);
        const TAU = Math.PI * 2;

        const dot = (() => {
            const c = document.createElement('canvas'); c.width = c.height = 64;
            const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
            gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.35, 'rgba(255,255,255,.8)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
            g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
            return new THREE.CanvasTexture(c);
        })();

        // ================= simulated physiology (drives everything) =================
        const focus = [1, 1, 1, 1, 1], INSTANT = M.reduceMotion;   // reduced motion: no fades
        function tickFocus(dt) {
            for (let i = 0; i < 5; i++) {
                const want = state.open === null || state.open === i ? 1 : .06;
                focus[i] += (want - focus[i]) * (INSTANT ? 1 : Math.min(1, dt * 6));
                if (labs[i]) labs[i].el.classList.toggle("gone", focus[i] < .5);
            }
        }
        const sig = { hp: 0, hInt: .9, beat: 0, bp: 0, breath: 0, spike: 0, boltX: 0, bolt: [], rr: [] };
        function tickSignals(dt, t) {
            const s = state.stress;
            sig.bp += dt * (.11 + s * .3) * TAU * (1 + Math.sin(t * 1.7) * s * .4);
            sig.breath = Math.sin(sig.bp) * (1 - s * .55);
            sig.hp += dt / sig.hInt;
            if (sig.hp >= 1) {
                sig.hp = 0;
                sig.hInt = (.95 - s * .4) * (1 + Math.sin(sig.bp) * .1 * (1 - s) + (Math.random() - .5) * s * .45);
                sig.rr.push(sig.hInt * 1000); if (sig.rr.length > 44) sig.rr.shift();
            }
            sig.beat = Math.exp(-sig.hp * 7);
            if (Math.random() < dt * s * s * 1.4) {
                sig.spike = 1;
                sig.boltX = (Math.random() * 2 - 1) * 110;
                let x = 0; sig.bolt = Array.from({ length: 12 }, () => (x += (Math.random() - .5) * 26));
            }
            sig.spike = Math.max(0, sig.spike - dt * 1.3);
        }

        // ================= glass avatar =================
        const bodyG = new THREE.Group();
        bodyG.position.set(BODY_X, -10, 0);
        bodyG.rotation.y = 0.32;
        scene.add(bodyG);

        const glass = new THREE.ShaderMaterial({
            uniforms: { uColor: { value: C('#B49BF8') }, uShim: { value: 0 }, uShimColor: { value: C('#DDB049') }, uTime: { value: 0 } },
            vertexShader: `varying vec3 n; varying vec3 v; varying vec3 wp;
                void main(){ n = normalize(normalMatrix*normal); vec4 w = modelMatrix*vec4(position,1.); wp = w.xyz;
                vec4 mv = viewMatrix*w; v = -mv.xyz; gl_Position = projectionMatrix*mv; }`,
            fragmentShader: `uniform vec3 uColor; uniform vec3 uShimColor; uniform float uShim; uniform float uTime;
                varying vec3 n; varying vec3 v; varying vec3 wp;
                void main(){ float f = pow(1. - abs(dot(normalize(n), normalize(v))), 2.6);
                float band = .5 + .5*sin(wp.y*.16 - uTime*3. + sin(wp.x*.3 + wp.z*.2)*1.5);
                vec3 col = uColor*(f*.85 + .03) + uShimColor*uShim*band*(f*.9 + .1);
                gl_FragColor = vec4(col, 1.); }`,
            transparent: true, blending: THREE.AdditiveBlending, depthWrite: false
        });
        const handGlass = glass.clone();
        const add = (geo, p, s) => { const m = new THREE.Mesh(geo, glass); m.position.set(...p); if (s) m.scale.set(...s); bodyG.add(m); return m; };
        const torsoProfile = [[0, -6], [24, -2], [33, 10], [33, 28], [28, 48], [30, 66], [37, 86], [43, 100], [42, 110], [31, 119], [13, 125], [9, 132], [9, 142], [0, 144]]
            .map(p => new THREE.Vector2(p[0], p[1]));
        add(new THREE.LatheGeometry(torsoProfile, 40), [0, 0, 0], [1, 1, .6]);
        add(new THREE.SphereGeometry(20, 40, 28), [0, 160, 0], [.92, 1.12, 1]);
        function limb(a, b, r1, r2) {
            const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), d = B.clone().sub(A);
            const m = add(new THREE.CylinderGeometry(r2, r1, d.length(), 24, 1, true), [0, 0, 0]);
            m.position.copy(A).add(B).multiplyScalar(.5);
            m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
        }
        [-1, 1].forEach(sd => {
            add(new THREE.SphereGeometry(10, 20, 14), [sd * 41, 106, 0]);
            limb([sd * 43, 106, 0], [sd * 52, 62, 0], 9, 7.5);
            add(new THREE.SphereGeometry(7.5, 16, 12), [sd * 52, 62, 0]);
            limb([sd * 52, 62, 0], [sd * 56, 20, 4], 7.5, 5.5);
            add(new THREE.SphereGeometry(7, 16, 12), [sd * 57, 10, 5], [.75, 1.35, .55]).material = handGlass;
            limb([sd * 15, 2, 0], [sd * 17, -70, 2], 14, 9.5);
            add(new THREE.SphereGeometry(9.5, 16, 12), [sd * 17, -70, 2]);
            limb([sd * 17, -70, 2], [sd * 18, -138, 0], 9.5, 6.5);
            add(new THREE.SphereGeometry(8, 16, 12), [sd * 18, -145, 7], [.8, .5, 1.7]);
        });

        // ---- inner systems (X-ray) ----
        function cloud(n, center, r, color, size) {
            const base = new Float32Array(n * 3);
            for (let i = 0; i < n; i++) {
                let x, y, z;
                do { x = Math.random() * 2 - 1; y = Math.random() * 2 - 1; z = Math.random() * 2 - 1; } while (x * x + y * y + z * z > 1);
                base.set([x * r[0], y * r[1], z * r[2]], i * 3);
            }
            const geo = new THREE.BufferGeometry();
            geo.setAttribute('position', new THREE.BufferAttribute(base.slice(), 3));
            const mat = new THREE.PointsMaterial({ size, color, map: dot, opacity: .9, ...M.additive });
            const pts = new THREE.Points(geo, mat);
            pts.position.set(...center);
            bodyG.add(pts);
            return { pts, base, geo, mat };
        }
        const brain = cloud(800, [0, 163, 0], [15, 13, 15], '#5FDFA6', 2.4);
        const lungs = [-1, 1].map(sd => cloud(380, [sd * 13, 90, -2], [11, 19, 8], '#4CDCEF', 2.2));
        const heart = new THREE.Mesh(new THREE.SphereGeometry(6, 20, 14), M.orbMaterial('#E562A4'));
        heart.position.set(-6, 96, 7);
        const heartGlow = M.glow('#E562A4', 60, .4);
        heartGlow.position.copy(heart.position);
        bodyG.add(heart, heartGlow);
        const spine = cloud(90, [0, 70, -9], [1.2, 70, 1.2], '#B49BF8', 1.8);
        const palms = [-1, 1].map(sd => { const g = M.glow('#DDB049', 95, 0); g.position.set(sd * 57, 6, 6); bodyG.add(g); return g; });
        const sparks = [-1, 1].map(sd => cloud(90, [sd * 57, 5, 6], [10, 14, 9], '#DDB049', 2.6));

        // ---- sensor placements: every spot a listed device can be worn ----
        const ringMat = color => new THREE.MeshBasicMaterial({ color, opacity: .9, ...M.additive });
        function ring(r, p, rx = 0, ry = 0, flat = 0) {
            const m = new THREE.Mesh(new THREE.TorusGeometry(r, .9, 8, 64), ringMat(BRAND.sensor));
            m.position.set(...p); m.rotation.set(rx, ry, 0); if (flat) m.scale.set(1, flat, 1);
            bodyG.add(m); return m;
        }
        const capDots = Array.from({ length: 19 }, (_, i) => {
            const u = .2 + .8 * ((i * .618) % 1), a = i * 2.4, r = Math.sqrt(1 - u * u);
            const m = new THREE.Mesh(new THREE.SphereGeometry(1.7, 8, 6), ringMat(BRAND.sensor));
            m.position.set(Math.cos(a) * r * 18.8, 160 + u * 22.8, Math.sin(a) * r * 20.4);
            bodyG.add(m); return m;
        });
        const H = Math.PI / 2;
        const PLACES = {
            forehead: [ring(20.5, [0, 168, 3], H + .35)],
            cap: capDots,
            ear: [ring(3.2, [-18.9, 160, 0], 0, H), ring(3.2, [18.9, 160, 0], 0, H)],
            earlobe: [ring(2.2, [19, 150, 1], 0, H)],
            wrist: [ring(6.6, [-55.6, 24, 3.6], H)],
            finger: [ring(2.8, [-57, -1, 5], H)],
            fingertips: [ring(3.2, [-57, -2, 5], H), ring(3.2, [57, -2, 5], H)],
            chest: [ring(43, [0, 96, 0], H, 0, .62)],
            belt: [ring(38, [0, 82, 0], H, 0, .62)],
            belly: [ring(30.5, [0, 52, 0], H, 0, .62)],
            nose: [ring(2.4, [0, 156, 21])],
            mouth: [ring(3, [0, 146, 20])]
        };
        Object.values(PLACES).flat().forEach(m => { m.visible = false; });
        const PLACE_RULES = [[/dry electrode/i, ['forehead']], [/wet electrode/i, ['cap']], [/in-ear/i, ['ear']], [/ppg/i, ['wrist', 'finger', 'earlobe']],
            [/ecg/i, ['chest']], [/fingertip/i, ['fingertips']], [/wristband/i, ['wrist']], [/strain/i, ['belt', 'belly']], [/thermistor/i, ['nose']], [/microphone|acoustic/i, ['mouth']]];
        // device list comes straight from the course data (the Sensor step's example table)
        function devicesFor() {
            const doc = new DOMParser().parseFromString(M.nodes()[1].example || '', 'text/html');
            return [...doc.querySelectorAll('tbody tr')].map(tr => {
                const td = tr.querySelectorAll('td'), type = td[0].textContent.trim();
                return { type, ex: td[2].textContent.trim(), places: (PLACE_RULES.find(r => r[0].test(type)) || [0, []])[1] };
            });
        }

        const SYSTEM = {   // where the signal starts + label text
            eeg: { p: [0, 180, 0], name: 'Brain' },
            hrv: { p: [-6, 96, 7], name: 'Heart' },
            gsr: { p: [-57, 6, 6], name: 'Skin' },
            respiration: { p: [0, 92, 10], name: 'Lungs' }
        };
        const organ = new THREE.Object3D(); bodyG.add(organ);
        const sys = { eeg: 0, hrv: 0, gsr: 0, respiration: 0 };
        const BAND = {
            theta: { w: 2.2, k: .22, a: 2.6, c: C('#B964F5') },
            alpha: { w: 5, k: .45, a: 1.8, c: C('#5FDFA6') },
            beta: { w: 11, k: 1.0, a: .9, c: C('#4CDCEF') }
        };

        function tickBody(dt, t) {
            Object.keys(sys).forEach(k => { sys[k] += ((state.signal === k ? 1 : .12) - sys[k]) * Math.min(1, dt * 3); });
            glass.uniforms.uTime.value = t;
            glass.uniforms.uShim.value = sys.gsr * (.2 + state.stress * .35 + sig.spike * 1.3);
            // brain: travelling wave whose speed/size follows the chosen band
            const b = BAND[state.band], arr = brain.geo.attributes.position.array, amp = b.a * sys.eeg;
            for (let i = 0; i < arr.length; i += 3) {
                const x = brain.base[i], y = brain.base[i + 1], z = brain.base[i + 2], l = Math.hypot(x, y, z) || 1;
                const d = Math.sin(y * b.k + x * b.k * .5 - t * b.w) * amp / l;
                arr[i] = x + x * d; arr[i + 1] = y + y * d; arr[i + 2] = z + z * d;
            }
            brain.geo.attributes.position.needsUpdate = true;
            brain.mat.color.copy(b.c);
            brain.mat.opacity = .15 + sys.eeg * .8;
            // lungs breathe, heart beats, palms flare on sweat spikes
            lungs.forEach(l => { l.pts.scale.setScalar(1 + sig.breath * .16); l.mat.opacity = .12 + sys.respiration * .8; });
            heart.scale.setScalar(1 + sig.beat * .35 * (.3 + sys.hrv));
            heart.material.uniforms.uBoost.value = sig.beat * sys.hrv;
            heartGlow.material.opacity = (.1 + sig.beat * .6) * sys.hrv;
            handGlass.uniforms.uTime.value = t;
            handGlass.uniforms.uColor.value.copy(K.violet).lerp(K.amber, sys.gsr);
            handGlass.uniforms.uShim.value = sys.gsr * (1 + state.stress * .6 + sig.spike * 2);
            palms.forEach(p => { p.material.opacity = sys.gsr * (.5 + state.stress * .3 + sig.spike * .7 + Math.sin(t * 3) * .08); });
            sparks.forEach(c => {
                c.mat.opacity = sys.gsr * (.55 + sig.spike * .45);
                c.pts.scale.setScalar(1 + sig.spike * .5 + Math.sin(t * 2.4) * .06);
                c.pts.rotation.y += dt * (.5 + state.stress * 2);
            });
            spine.mat.opacity = .25;

        }

        // ================= loop stations + ribbon =================
        function station(id, pos, idx) {
            const g = new THREE.Group();
            g.position.set(...pos);
            const orb = new THREE.Mesh(new THREE.SphereGeometry(15, 32, 24), M.orbMaterial(BRAND[id]));
            const halo = M.glow(BRAND[id], 90, .3);
            const plinth = new THREE.Mesh(new THREE.TorusGeometry(24, .8, 8, 64), ringMat(BRAND[id]));
            plinth.rotation.x = Math.PI / 2; plinth.position.y = -18;
            g.add(orb, halo, plinth);
            scene.add(g);
            M.pickable(orb, idx);
            return { g, orb, halo, heat: 0 };
        }
        const stSensor = station('sensor', [-230, 235, 0], 1);
        const stAlgo = station('algorithm', [120, 235, 0], 2);
        const stAdj = station('adjustment', [20, -130, 60], 4);

        const envG = new THREE.Group();
        envG.position.set(WORLD_X, -40, 0);
        scene.add(envG);
        const worldTop = new THREE.Vector3(WORLD_X, 200, 0);

        let curve = null, ribbon = null, ribbonGlow = null, stepU = [0, .2, .35, .5, .75];
        const tw = new THREE.Vector3(), entry = new THREE.Vector3();
        function buildRibbon() {
            const sp = SYSTEM[state.signal].p;
            organ.position.set(...sp);
            bodyG.updateMatrixWorld(true);
            const o = organ.getWorldPosition(new THREE.Vector3());
            bodyG.localToWorld(entry.set(8, 70, 22));   // chest: the loop closes into the body here
            const ptsArr = [o, new THREE.Vector3(BODY_X + 95, 225, 10), stSensor.g.position.clone(), stAlgo.g.position.clone(), worldTop.clone(),
                new THREE.Vector3(WORLD_X - 40, -40, 80), new THREE.Vector3(WORLD_X - 220, -125, 70), stAdj.g.position.clone(),
                new THREE.Vector3(BODY_X + 125, 10, 64), entry.clone().add(new THREE.Vector3(34, 0, 22)), entry.clone()];
            curve = new THREE.CatmullRomCurve3(ptsArr, true, 'centripetal');
            [ribbon, ribbonGlow].forEach(m => m && (scene.remove(m), m.geometry.dispose()));
            ribbon = M.tube(curve, 0xB49BF8, 1.3, .38, 320, true);
            ribbonGlow = M.tube(curve, 0x4CDCEF, 5, .045, 320, true);
            scene.add(ribbon, ribbonGlow);
            // where each step sits along the curve
            const near = target => { let best = 0, bd = 1e9; for (let i = 0; i < 400; i++) { const d = curve.getPointAt(i / 400, tw).distanceTo(target); if (d < bd) { bd = d; best = i / 400; } } return best; };
            stepU = [0, near(stSensor.g.position), near(stAlgo.g.position), near(worldTop), near(stAdj.g.position)];
        }

        // data packets + a lead comet (Living Circuit style)
        const PN = 110, pU = Float32Array.from({ length: PN }, (_, i) => i / PN);
        const pGeo = new THREE.BufferGeometry();
        pGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(PN * 3), 3));
        pGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(PN * 3), 3));
        scene.add(new THREE.Points(pGeo, new THREE.PointsMaterial({ size: 6, vertexColors: true, map: dot, opacity: .9, ...M.additive })));
        const stepCols = ['body', 'sensor', 'algorithm', 'vr', 'adjustment'].map(id => C(BRAND[id]));
        const colAt = u => { let s = 0; for (let i = 0; i < 5; i++) if (u >= stepU[i]) s = i; return stepCols[s]; };
        const comet = M.glow(0xffffff, 44, .95); scene.add(comet);
        const trail = Array.from({ length: 22 }, (_, k) => { const s = M.glow(0x4CDCEF, 26 * (1 - k / 22) + 6, .5 * (1 - k / 22)); scene.add(s); return s; });
        let cu = 0;
        const stations = [null, stSensor, stAlgo, null, stAdj];

        function tickLoop(dt, t) {
            if (!curve) return;
            const pa = pGeo.attributes.position.array, ca = pGeo.attributes.color.array;
            for (let i = 0; i < PN; i++) {
                pU[i] = (pU[i] + dt * .05) % 1;
                curve.getPointAt(pU[i], tw);
                const j = i * 3; pa[j] = tw.x; pa[j + 1] = tw.y; pa[j + 2] = tw.z;
                const c = colAt(pU[i]); ca[j] = c.r; ca[j + 1] = c.g; ca[j + 2] = c.b;
            }
            pGeo.attributes.position.needsUpdate = true;
            pGeo.attributes.color.needsUpdate = true;
            cu = (cu + dt / 9) % 1;
            curve.getPointAt(cu, comet.position);
            trail.forEach((s, k) => curve.getPointAt(((cu - (k + 1) * .004) % 1 + 1) % 1, s.position));
            stations.forEach((s, i) => {
                if (!s) return;
                s.heat = Math.max(s.heat - dt * 1.4, Math.abs(cu - stepU[i]) < .012 ? 1 : 0);
                s.orb.material.uniforms.uBoost.value = s.heat + (state.open === i ? .6 : 0);
                s.halo.material.opacity = (.22 + s.heat * .5) * focus[i];
                s.g.position.y += Math.sin(t * 1.2 + i) * .03;
            });
        }

        // ================= devices (hang from the Sensor station, link to where they're worn) =================
        const devG = new THREE.Group(); scene.add(devG);
        const thread = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: BRAND.sensor, opacity: .35, ...M.additive }));
        devG.add(thread);
        let devices = [], devIdx = 0, devTimer = 0, devLocked = false;
        const devNodes = [0, 1, 2].map(k => {
            const g = new THREE.Group();
            g.position.set(stSensor.g.position.x, stSensor.g.position.y - 92 - k * 48, 20);
            const orb = new THREE.Mesh(new THREE.SphereGeometry(5.5, 20, 14), M.orbMaterial(BRAND.sensor));
            const halo = M.glow(BRAND.sensor, 40, .3);
            g.add(orb, halo); devG.add(g);
            const lab = M.addLabel(g, '', BRAND.sensor, () => { devLocked = true; setDevice(k); }, 0, false, true);
            lab.el.classList.add('dev');
            return { g, orb, halo, lab };
        });
        const links = [0, 1, 2].map(() => {
            const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints(Array.from({ length: 32 }, () => new THREE.Vector3())),
                new THREE.LineBasicMaterial({ color: BRAND.sensor, opacity: .55, ...M.additive }));
            scene.add(l); return l;
        });
        function setDevice(k) {
            devIdx = k; devTimer = 0;
            Object.values(PLACES).flat().forEach(m => { m.visible = false; });
            (devices[k] ? devices[k].places : []).forEach(pk => PLACES[pk].forEach(m => { m.visible = true; }));
            devNodes.forEach((d, i) => d.lab.el.classList.toggle('dim', i !== k));
        }
        function loadDevices() {
            devices = devicesFor();
            devNodes.forEach((d, i) => {
                const dv = devices[i];
                d.g.visible = !!dv;
                d.lab.el.style.display = dv ? '' : 'none';
                if (dv) { const b = document.createElement('b'), it = document.createElement('i'); b.textContent = dv.type; it.textContent = dv.ex; d.lab.el.replaceChildren(b, it); }
            });
            const top = stSensor.g.position.clone().add(new THREE.Vector3(0, -18, 20));
            thread.geometry.setFromPoints([top, devNodes[Math.max(0, devices.length - 1)].g.position]);
            devLocked = false; setDevice(0);
        }
        const lp = new THREE.Vector3(), lq = new THREE.Vector3(), lc = new THREE.Vector3(), bez = new THREE.QuadraticBezierCurve3();
        function tickDevices(dt, t) {
            devTimer += dt;
            if (!devLocked && devices.length > 1 && devTimer > 4.5) setDevice((devIdx + 1) % devices.length);
            devNodes.forEach((d, i) => {
                const on = i === devIdx;
                d.orb.material.uniforms.uBoost.value = on ? .8 + Math.sin(t * 4) * .2 : 0;
                d.halo.material.opacity = (on ? .55 : .12) * focus[1];
                d.orb.visible = focus[1] > .2;
                d.lab.el.classList.toggle('gone', focus[1] < .5);
            });
            const marks = devices[devIdx] ? devices[devIdx].places.map(pk => PLACES[pk][0]) : [];
            devNodes[devIdx].g.getWorldPosition(lp);
            links.forEach((l, i) => {
                l.visible = !!marks[i] && focus[1] > .5;
                if (!marks[i]) return;
                marks[i].getWorldPosition(lq);
                lc.copy(lp).lerp(lq, .5); lc.y += 30;
                bez.v0.copy(lp); bez.v1.copy(lc); bez.v2.copy(lq);
                const a = l.geometry.attributes.position.array;
                for (let k = 0; k < 32; k++) { bez.getPoint(k / 31, lc); a[k * 3] = lc.x; a[k * 3 + 1] = lc.y; a[k * 3 + 2] = lc.z; }
                l.geometry.attributes.position.needsUpdate = true;
                l.material.opacity = .4 + Math.sin(t * 4) * .15;
            });
            Object.values(PLACES).flat().forEach(m => { if (m.visible) m.material.opacity = .6 + Math.sin(t * 4) * .3; });
        }

        // ================= algorithm screen: how each signal is processed =================
        const AW = 640, AH = 360, HN = 240;
        const acv = document.createElement('canvas'); acv.width = AW; acv.height = AH;
        const ax = acv.getContext('2d');
        const atex = new THREE.CanvasTexture(acv);
        const screen = new THREE.Mesh(new THREE.PlaneGeometry(240, 135), new THREE.MeshBasicMaterial({ map: atex, transparent: true, depthWrite: false }));
        screen.position.set(stAlgo.g.position.x + 40, stAlgo.g.position.y - 135, 40);
        scene.add(screen);
        M.pickable(screen, 2);
        scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([stAlgo.g.position.clone().add(new THREE.Vector3(0, -18, 10)), screen.position.clone().add(new THREE.Vector3(-50, 67, 0))]),
            new THREE.LineBasicMaterial({ color: BRAND.algorithm, opacity: .4, ...M.additive })));

        const POW = { theta: [.3, .9, .4, .2, .1], alpha: [.2, .35, .95, .3, .1], beta: [.15, .2, .3, .9, .35] };
        const H2 = { raw: [], gsr: [], tonic: [], pk: [], br: [] };
        let aAcc = 0, aDraw = 0, scrAge = 9, prevSpike = 0, tonicV = .3;
        const push = (a, v) => { a.push(v); if (a.length > HN) a.shift(); };
        function sampleAlgo(t) {
            const s = state.stress, P = POW[state.band], ft = t * TAU * .15;
            push(H2.raw, P[0] * Math.sin(ft * 2) + P[1] * Math.sin(ft * 6) + P[2] * Math.sin(ft * 10) + P[3] * Math.sin(ft * 20 + 1) + P[4] * Math.sin(ft * 34) + (Math.random() - .5) * .5);
            tonicV += ((.25 + s * .45) - tonicV) * .01;
            if (sig.spike > prevSpike + .5) scrAge = 0;
            prevSpike = sig.spike;
            const was = scrAge; scrAge += 1 / 30;
            const ph = scrAge < .4 ? scrAge / .4 : Math.exp(-(scrAge - .4) * 1.5);
            push(H2.gsr, tonicV + ph * .3 + (Math.random() - .5) * .008);
            push(H2.tonic, tonicV);
            push(H2.pk, was < .4 && scrAge >= .4 ? 1 : 0);
            push(H2.br, sig.breath);
        }

        function rrect(x, y, w, h, r) { ax.beginPath(); ax.moveTo(x + r, y); ax.arcTo(x + w, y, x + w, y + h, r); ax.arcTo(x + w, y + h, x, y + h, r); ax.arcTo(x, y + h, x, y, r); ax.arcTo(x, y, x + w, y, r); ax.closePath(); }
        function frame(title, sub) {
            ax.clearRect(0, 0, AW, AH);
            rrect(2, 2, AW - 4, AH - 4, 26); ax.fillStyle = 'rgba(18,12,30,.82)'; ax.fill();
            ax.strokeStyle = 'rgba(180,155,248,.4)'; ax.lineWidth = 2; ax.stroke();
            ax.fillStyle = '#B49BF8'; ax.font = '600 19px Poppins, sans-serif'; ax.fillText(title.toUpperCase(), 28, 40);
            ax.fillStyle = '#9890BB'; ax.font = '400 16px "JetBrains Mono", monospace'; ax.fillText(sub, 28, 66);
        }
        const px = (i, n, x, w) => x + (i + HN - n) / (HN - 1) * w;
        function plot(arr, x, y, w, h, lo, hi, color, lw = 2.5, dash) {
            ax.beginPath();
            arr.forEach((v, i) => { const X = px(i, arr.length, x, w), Y = y + h - (v - lo) / (hi - lo) * h; i ? ax.lineTo(X, Y) : ax.moveTo(X, Y); });
            ax.strokeStyle = color; ax.lineWidth = lw; ax.setLineDash(dash || []); ax.stroke(); ax.setLineDash([]);
        }
        function small(text, x, y, color = '#9890BB', align = 'left') { ax.fillStyle = color; ax.font = '400 15px "JetBrains Mono", monospace'; ax.textAlign = align; ax.fillText(text, x, y); ax.textAlign = 'left'; }
        function big(text, x, y, color) { ax.fillStyle = color; ax.font = '700 34px Poppins, sans-serif'; ax.fillText(text, x, y); }

        const DRAW = {
            eeg(t) {
                frame('Algorithm · Fast Fourier Transform', 'raw EEG  →  frequency bands');
                small('raw signal', 28, 100);
                plot(H2.raw, 28, 115, 250, 170, -2.3, 2.3, '#4CDCEF', 2);
                ax.strokeStyle = '#B49BF8'; ax.lineWidth = 2; ax.beginPath(); ax.moveTo(296, 200); ax.lineTo(340, 200); ax.lineTo(332, 193); ax.moveTo(340, 200); ax.lineTo(332, 207); ax.stroke();
                small('FFT', 318, 186, '#B49BF8', 'center');
                const P = POW[state.band], dom = P.indexOf(Math.max(...P)), names = ['δ', 'θ', 'α', 'β', 'γ'], hz = ['1-4', '4-8', '8-12', '13-30', '30+'];
                P.forEach((v, k) => {
                    const h = (v + Math.sin(t * 3 + k * 2) * .04 + (Math.random() - .5) * .03) * 175, x = 362 + k * 52;
                    rrect(x, 290 - h, 36, h, 6); ax.fillStyle = k === dom ? '#' + BAND[state.band].c.getHexString() : 'rgba(180,155,248,.28)'; ax.fill();
                    ax.fillStyle = k === dom ? '#F1EEFB' : '#9890BB'; ax.font = '600 18px Poppins, sans-serif'; ax.textAlign = 'center'; ax.fillText(names[k], x + 18, 314); ax.textAlign = 'left';
                    small(hz[k], x + 18, 332, '#9890BB', 'center');
                });
                const mood = { theta: 'deep / meditative', alpha: 'relaxed / calm focus', beta: 'alert / concentrating' }[state.band];
                small('dominant: ' + state.band + ' → ' + mood, 28, 336, '#' + BAND[state.band].c.getHexString());
            },
            hrv() {
                frame('Algorithm · Beat-to-beat intervals', 'heartbeats  →  HRV waveform');
                const rr = sig.rr.length > 2 ? sig.rr : [900, 900, 900];
                const lo = Math.min(...rr) - 40, hi = Math.max(...rr) + 40, x0 = 40, w = 560, y0 = 96, h = 190, n = rr.length;
                small(Math.round(hi) + ' ms', 28, y0 - 4); small(Math.round(lo) + ' ms', 28, y0 + h + 16);
                const P = rr.map((v, i) => [x0 + (i + 44 - n) / 43 * w, y0 + h - (v - lo) / (hi - lo) * h]);
                ax.beginPath(); P.forEach(([X, Y], i) => i ? ax.lineTo(X, Y) : ax.moveTo(X, Y));
                ax.strokeStyle = 'rgba(229,98,164,.85)'; ax.lineWidth = 2.5; ax.stroke();
                P.forEach(([X, Y]) => { ax.beginPath(); ax.arc(X, Y, 4.5, 0, TAU); ax.fillStyle = '#F1EEFB'; ax.fill(); });
                let d2 = 0; for (let i = 1; i < n; i++) d2 += (rr[i] - rr[i - 1]) ** 2;
                const rmssd = Math.sqrt(d2 / Math.max(1, n - 1)), s = state.stress;
                const coh = s < .35 ? ['high', '#5FDFA6', 'smooth wave'] : s < .7 ? ['medium', '#B49BF8', 'uneven'] : ['low', '#FF5C72', 'jagged'];
                small('each dot = time between two heartbeats', 28, 316);
                small('RMSSD ' + Math.round(rmssd) + ' ms  ·  coherence ' + coh[0] + ' (' + coh[2] + ')', 28, 338, coh[1]);
            },
            gsr() {
                frame('Algorithm · Tonic vs Phasic', 'skin conductance  →  baseline + spikes');
                const x = 28, y = 90, w = 584, h = 200;
                plot(H2.tonic, x, y, w, h, .15, 1.1, 'rgba(180,155,248,.8)', 2, [8, 7]);
                plot(H2.gsr, x, y, w, h, .15, 1.1, '#DDB049', 3);
                let count = 0;
                H2.pk.forEach((on, i) => {
                    if (!on) return; count++;
                    const X = px(i, H2.pk.length, x, w), Y = y + h - (H2.gsr[i] - .15) / .95 * h - 12;
                    ax.beginPath(); ax.moveTo(X, Y); ax.lineTo(X - 7, Y - 12); ax.lineTo(X + 7, Y - 12); ax.closePath(); ax.fillStyle = '#FF5C72'; ax.fill();
                    small('phasic', X, Y - 18, '#FF5C72', 'center');
                });
                small('- - tonic baseline (slow arousal)', 28, 316, '#B49BF8');
                small('tonic ' + (tonicV * 10).toFixed(1) + ' µS  ·  phasic spikes: ' + count, 28, 338, '#DDB049');
            },
            respiration() {
                frame('Algorithm · Breathing metrics', 'chest movement  →  rate, ratio, rhythm');
                const x = 28, y = 96, w = 360, h = 200, a = H2.br;
                for (let i = 1; i < a.length; i++) {
                    const X0 = px(i - 1, a.length, x, w), X1 = px(i, a.length, x, w);
                    ax.beginPath(); ax.moveTo(X0, y + h / 2 - a[i - 1] * h / 2.2); ax.lineTo(X1, y + h / 2 - a[i] * h / 2.2);
                    ax.strokeStyle = a[i] > a[i - 1] ? '#4CDCEF' : '#B49BF8'; ax.lineWidth = 3; ax.stroke();
                }
                small('inhale', 28, 330, '#4CDCEF'); small('exhale', 100, 330, '#B49BF8');
                const s = state.stress, bpm = (.11 + s * .3) * 60, ie = 1 + (1 - s) * .8, rhythm = Math.round(100 - s * 55 - Math.random() * 3);
                [['breaths / min', bpm.toFixed(1), s < .4 ? '#5FDFA6' : '#F1EEFB'], ['inhale : exhale', '1 : ' + ie.toFixed(1), '#F1EEFB'], ['rhythm', rhythm + '%', rhythm > 75 ? '#5FDFA6' : '#FF5C72']]
                    .forEach(([l, v, c], k) => { small(l, 420, 112 + k * 76); big(v, 420, 148 + k * 76, c); });
            }
        };
        let algoReady = false;
        function tickAlgo(dt, t) {
            if (!algoReady) {   // pre-fill history so every chart starts complete
                algoReady = true;
                const s0 = state.stress;
                for (let k = HN; k > 0; k--) {
                    const tt = t - k / 30;
                    if (Math.random() < (1 / 30) * s0 * s0 * 1.4) sig.spike = 1; else sig.spike = Math.max(0, sig.spike - 1.3 / 30);
                    sig.breath = Math.sin(tt * (.11 + s0 * .3) * TAU) * (1 - s0 * .55);
                    sampleAlgo(tt);
                }
                sig.spike = 0;
                for (let k = 0; k < 44; k++) sig.rr.push((.95 - s0 * .4) * (1 + Math.sin(k * .9) * .1 * (1 - s0) + (Math.random() - .5) * s0 * .45) * 1000);
            }
            aAcc += dt;
            while (aAcc > 1 / 30) { sampleAlgo(t); aAcc -= 1 / 30; }
            aDraw += dt;
            if (aDraw > .05) { aDraw = 0; DRAW[state.signal](t); atex.needsUpdate = true; }
            screen.quaternion.copy(M.camera.quaternion);
            screen.material.opacity = focus[2];
            screen.visible = focus[2] > .08;
        }

        // ================= learner adjustment: strategy menu + target-zone gauge + learning spiral =================
        // [name, how-to, goal]: goal is a target band for EEG, a target stress level for the rest
        const STRATS = {
            eeg: [['Soft gaze, eyes closed', 'aim: alpha · relaxed focus', 'alpha'], ['Drift into imagery', 'aim: theta · deep, dreamy', 'theta'], ['Count breaths to ten', 'aim: beta · steady focus', 'beta']],
            hrv: [['Resonance breathing', '~6 breaths/min · in 5s, out 5s', .08], ['Slow exhale', 'breathe out longer than in', .2], ['Warm memory', 'recall someone you care about', .3]],
            gsr: [['Unclench your hands', 'open palms, loosen the grip', .18], ['Drop your shoulders', 'scan and soften the body', .26], ['Name 5 things you see', 'shift attention outward', .34]],
            respiration: [['Lengthen the exhale', 'out about twice as long as in', .15], ['Box breathing', '4 in · 4 hold · 4 out · 4 hold', .22], ['4-7-8 breath', 'in 4 · hold 7 · out 8', .1]]
        };
        const GAUGE = {
            eeg: { sub: 'dominant band  →  reach the target band' },
            hrv: { sub: 'heart coherence  →  reach the green zone', read: v => Math.round(v * 100) + '%', unit: 'coherence' },
            gsr: { sub: 'skin arousal  →  reach the green zone', read: () => (tonicV * 10).toFixed(1) + ' µS', unit: 'tonic skin conductance' },
            respiration: { sub: 'breath pace  →  reach the green zone', read: v => ((.11 + (1 - v) * .3) * 60).toFixed(1) + ' /min', unit: 'breaths per minute' }
        };
        const ZONE = .65, BANDPOS = { theta: 1 / 6, alpha: .5, beta: 5 / 6 }, AMB = C(BRAND.adjustment);
        const A = stAdj.g.position.clone(), MENU_X = A.x - 330, adjLines = [];
        const adjLine = (pts, op) => { const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: BRAND.adjustment, opacity: op, ...M.additive })); l.userData.op = op; scene.add(l); adjLines.push(l); return l; };

        // strategy menu: amber twin of the sensor's device menu, to the left of the station
        const stratHead = new THREE.Object3D(); stratHead.position.set(MENU_X, A.y - 20, A.z + 10); scene.add(stratHead);
        const stratHeadLab = M.addLabel(stratHead, 'Try a strategy', null, null, 0, true, true);
        const stratNodes = [0, 1, 2].map(k => {
            const g = new THREE.Group();
            g.position.set(MENU_X, A.y - 50 - k * 42, A.z + 10);
            const orb = new THREE.Mesh(new THREE.SphereGeometry(5.5, 20, 14), M.orbMaterial(BRAND.adjustment));
            const halo = M.glow(BRAND.adjustment, 40, .3);
            g.add(orb, halo); scene.add(g);
            const lab = M.addLabel(g, '', BRAND.adjustment, () => pickStrategy(k), 0, false, true);
            lab.el.classList.add('dev', 'strat');
            return { g, orb, halo, lab };
        });
        adjLine([A.clone().add(new THREE.Vector3(-17, 0, 0)), new THREE.Vector3(MENU_X, A.y, A.z + 10), stratNodes[2].g.position.clone()], .35);

        let strat = null, lastS = 0, lastBand = '', eegAim = .5, gVal = .35;
        const targetBand = () => strat !== null && state.signal === 'eeg' ? STRATS.eeg[strat][2] : 'alpha';
        function setStrat(k) {
            strat = k; lastS = state.stress; lastBand = state.band;
            stratNodes.forEach((d, i) => d.lab.el.classList.toggle('dim', k !== null && i !== k));
        }
        function pickStrategy(k) { setStrat(strat === k ? null : k); }
        function loadStrategies() {
            STRATS[state.signal].forEach((sx, i) => {
                const b = document.createElement('b'), it = document.createElement('i');
                b.textContent = sx[0]; it.textContent = sx[1];
                stratNodes[i].lab.el.replaceChildren(b, it);
            });
            setStrat(null);
            eegAim = BANDPOS[state.band]; gVal = 1 - state.stress;
            lapR.length = 0; gHist.length = 0;
        }

        // target-zone gauge: a small screen to the lower right of the station
        const GW = 512, GH = 320;
        const gcv = document.createElement('canvas'); gcv.width = GW; gcv.height = GH;
        const gx = gcv.getContext('2d'), gtex = new THREE.CanvasTexture(gcv);
        const gauge = new THREE.Mesh(new THREE.PlaneGeometry(210, 131), new THREE.MeshBasicMaterial({ map: gtex, transparent: true, depthWrite: false }));
        gauge.position.set(A.x + 190, A.y - 85, A.z + 10);
        scene.add(gauge);
        M.pickable(gauge, 4);
        adjLine([A.clone().add(new THREE.Vector3(16, -6, 0)), gauge.position.clone().add(new THREE.Vector3(-100, 55, 0))], .4);

        const gHist = [];
        const gt = (text, x, y, color, font, align = 'left') => { gx.fillStyle = color; gx.font = font; gx.textAlign = align; gx.fillText(text, x, y); };
        const MONO = '400 14px "JetBrains Mono", monospace';
        function gap() {
            if (state.signal === 'eeg') return Math.min(1, Math.max(0, Math.abs(eegAim - BANDPOS[targetBand()]) - .04) / .62);
            return Math.max(0, ZONE - gVal) / ZONE;
        }
        function drawGauge() {
            const sg = state.signal, cx = 256, cy = 228, R = 124;
            gx.clearRect(0, 0, GW, GH);
            gx.beginPath(); gx.moveTo(26, 2); gx.arcTo(GW - 2, 2, GW - 2, GH - 2, 24); gx.arcTo(GW - 2, GH - 2, 2, GH - 2, 24); gx.arcTo(2, GH - 2, 2, 2, 24); gx.arcTo(2, 2, GW - 2, 2, 24); gx.closePath();
            gx.fillStyle = 'rgba(18,12,30,.82)'; gx.fill(); gx.strokeStyle = 'rgba(221,176,73,.45)'; gx.lineWidth = 2; gx.stroke();
            gt('LEARNER · TARGET ZONE', 24, 36, '#DDB049', '600 18px Poppins, sans-serif');
            gt(GAUGE[sg].sub, 24, 60, '#9890BB', MONO);
            const ang = v => Math.PI + v * Math.PI;
            const arc = (a, b, color, w) => { gx.beginPath(); gx.arc(cx, cy, R, ang(a), ang(b)); gx.strokeStyle = color; gx.lineWidth = w; gx.lineCap = 'round'; gx.stroke(); };
            let pos, inZone, big, unit;
            if (sg === 'eeg') {
                const tb = targetBand();
                ['theta', 'alpha', 'beta'].forEach((b, i) => {
                    const on = b === tb, a = ang((i + .5) / 3);
                    arc(i / 3 + .03, (i + 1) / 3 - .03, on ? '#' + BAND[b].c.getHexString() : 'rgba(255,255,255,.13)', on ? 22 : 14);
                    gt(['θ', 'α', 'β'][i], cx + Math.cos(a) * (R + 28), cy + Math.sin(a) * (R + 28) + 7, on ? '#F1EEFB' : '#9890BB', '600 19px Poppins, sans-serif', 'center');
                });
                pos = eegAim; inZone = Math.abs(eegAim - BANDPOS[tb]) < 1 / 6;
                const cb = state.band; big = { theta: 'θ theta', alpha: 'α alpha', beta: 'β beta' }[cb]; unit = 'dominant band now';
            } else {
                arc(0, .33, 'rgba(255,92,114,.4)', 14); arc(.36, ZONE - .03, 'rgba(180,155,248,.3)', 14); arc(ZONE, 1, '#5FDFA6', 22);
                gt('tense', cx - R, cy + 32, '#FF5C72', MONO, 'center'); gt('calm', cx + R, cy + 32, '#5FDFA6', MONO, 'center');
                pos = gVal; inZone = gVal >= ZONE; big = GAUGE[sg].read(gVal); unit = GAUGE[sg].unit;
            }
            // where the learner has been (fading trail) and where they are now
            gHist.forEach((v, i) => {
                const a = ang(v), k = i / gHist.length;
                gx.beginPath(); gx.arc(cx + Math.cos(a) * R, cy + Math.sin(a) * R, 2 + k * 3, 0, TAU);
                gx.fillStyle = 'rgba(241,238,251,' + (k * .5).toFixed(3) + ')'; gx.fill();
            });
            const a = ang(pos);
            gx.save(); gx.shadowColor = inZone ? '#5FDFA6' : '#DDB049'; gx.shadowBlur = 18;
            gx.beginPath(); gx.arc(cx + Math.cos(a) * R, cy + Math.sin(a) * R, 11, 0, TAU); gx.fillStyle = '#FFFFFF'; gx.fill(); gx.restore();
            gt(big, cx, cy - 22, '#F1EEFB', '700 32px Poppins, sans-serif', 'center');
            gt(unit, cx, cy + 2, '#9890BB', MONO, 'center');
            const trend = lapR.length > 1 && lapR[lapR.length - 1] < lapR[lapR.length - 2] - .5 ? '  ·  closing in' : '';
            gt(inZone ? '✓ in the zone' : 'gap ' + Math.round(gap() * 100) + '%' + trend, cx, cy + 34, inZone ? '#5FDFA6' : '#DDB049', '600 16px Poppins, sans-serif', 'center');
            gt(strat !== null ? 'trying: ' + STRATS[sg][strat][0] : '← pick a strategy to try', cx, GH - 18, strat !== null ? '#DDB049' : '#9890BB', MONO, 'center');
        }

        // learning spiral: one turn per loop; the turn's radius is how far from target you were,
        // so as the learner improves the spiral winds inward toward the station
        const SPN = 9 * 64;
        const spGeo = new THREE.BufferGeometry();
        spGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(SPN * 3), 3));
        spGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(SPN * 3), 3));
        const spiralG = new THREE.Group(); spiralG.position.copy(A); scene.add(spiralG);
        spiralG.add(new THREE.Line(spGeo, new THREE.LineBasicMaterial({ vertexColors: true, opacity: 1, ...M.additive })));
        const spHead = M.glow(BRAND.adjustment, 22, .9); spiralG.add(spHead);
        const lapR = [];
        let prevRel = 0, gAcc = 0, gDraw = 0;
        const curR = () => 24 + gap() * 36;
        function tickSpiral() {
            const rel = ((cu - stepU[4]) % 1 + 1) % 1;
            if (!lapR.length) { const r = curR(); for (let k = 5; k >= 0; k--) lapR.push(Math.min(60, r + k * 5)); }
            if (rel < prevRel) { lapR.push(curR()); if (lapR.length > 7) lapR.shift(); }
            prevRel = rel;
            const radii = [...lapR, curR()], turns = radii.length - 1, pa = spGeo.attributes.position.array, ca = spGeo.attributes.color.array, f = focus[4];
            let n = 0;
            for (let k = 0; k < turns; k++) {
                const upto = k === turns - 1 ? Math.max(1, Math.round(rel * 64)) : 64;
                for (let j = k ? 1 : 0; j <= upto; j++) {
                    const u = j / 64, r = radii[k] + (radii[k + 1] - radii[k]) * u, an = (k + u) * TAU, b = (.12 + .88 * Math.pow((k + u) / turns, 1.6)) * f;
                    pa[n * 3] = Math.sin(an) * r; pa[n * 3 + 1] = Math.cos(an) * r; pa[n * 3 + 2] = 0;
                    ca[n * 3] = AMB.r * b; ca[n * 3 + 1] = AMB.g * b; ca[n * 3 + 2] = AMB.b * b;
                    n++;
                }
            }
            spGeo.setDrawRange(0, n);
            spGeo.attributes.position.needsUpdate = true; spGeo.attributes.color.needsUpdate = true;
            spHead.position.set(pa[(n - 1) * 3], pa[(n - 1) * 3 + 1], 0);
            spHead.material.opacity = .9 * f;
            spiralG.quaternion.copy(M.camera.quaternion);
        }

        function tickAdj(dt, t) {
            const sg = state.signal;
            // the learner practising: the chosen strategy slowly nudges the body toward its goal.
            // Touching the dock yourself takes back control (cancels the strategy).
            if (strat !== null) {
                if (sg === 'eeg') {
                    if (state.band !== lastBand) setStrat(null);
                    else {
                        const tb = STRATS.eeg[strat][2];
                        eegAim += (BANDPOS[tb] - eegAim) * Math.min(1, dt * .45);
                        if (Math.abs(eegAim - BANDPOS[tb]) < .1 && state.band !== tb) M.setBand(tb);
                        lastBand = state.band;
                    }
                } else if (Math.abs(state.stress - lastS) > .004) setStrat(null);
                else { M.setStress(state.stress + (STRATS[sg][strat][2] - state.stress) * Math.min(1, dt * .28)); lastS = state.stress; }
            }
            if (strat === null || sg !== 'eeg') eegAim += (BANDPOS[state.band] - eegAim) * Math.min(1, dt * 2);
            gVal += ((1 - state.stress) - gVal) * Math.min(1, dt * 3);
            gAcc += dt;
            if (gAcc > .1) { gAcc = 0; gHist.push(sg === 'eeg' ? eegAim : gVal); if (gHist.length > 70) gHist.shift(); }
            gDraw += dt;
            if (gDraw > .05) { gDraw = 0; drawGauge(); gtex.needsUpdate = true; }
            tickSpiral();
            const f = focus[4];
            gauge.quaternion.copy(M.camera.quaternion);
            gauge.material.opacity = f; gauge.visible = f > .08;
            adjLines.forEach(l => { l.material.opacity = l.userData.op * f; l.visible = f > .08; });
            stratHeadLab.el.classList.toggle('gone', f < .5);
            stratNodes.forEach((d, i) => {
                const on = strat === i;
                d.orb.material.uniforms.uBoost.value = on ? .8 + Math.sin(t * 4) * .2 : strat === null ? .25 + Math.sin(t * 2 + i) * .15 : 0;
                d.halo.material.opacity = (on ? .55 : .15) * f;
                d.orb.visible = f > .2;
                d.lab.el.classList.toggle('gone', f < .5);
            });
        }

        // ================= matched environments (one morphing particle system) =================
        const N = 3200;
        const cur = new Float32Array(N * 3), tgt = new Float32Array(N * 3), col = new Float32Array(N * 3), tcol = new Float32Array(N * 3);
        const R1 = new Float32Array(N), R2 = new Float32Array(N), R3 = new Float32Array(N);
        for (let i = 0; i < N; i++) { R1[i] = Math.random(); R2[i] = Math.random(); R3[i] = Math.random(); }
        const envGeo = new THREE.BufferGeometry();
        envGeo.setAttribute('position', new THREE.BufferAttribute(cur, 3));
        envGeo.setAttribute('color', new THREE.BufferAttribute(col, 3));
        const envMat = new THREE.PointsMaterial({ size: 4, vertexColors: true, map: dot, opacity: .95, ...M.additive });
        envG.add(new THREE.Points(envGeo, envMat));

        // world platform (portal ring) + hit area
        const platform = new THREE.Mesh(new THREE.TorusGeometry(170, 1.1, 8, 128), ringMat(BRAND.vr));
        platform.rotation.x = Math.PI / 2; platform.scale.set(1, .72, 1);
        const pdisc = new THREE.Mesh(new THREE.CircleGeometry(170, 64), new THREE.MeshBasicMaterial({ color: 0x7C4FF0, opacity: .05, side: THREE.DoubleSide, ...M.additive }));
        pdisc.rotation.x = -Math.PI / 2; pdisc.scale.set(1, .72, 1);
        const flash = M.glow(0xffffff, 520, 0); flash.position.y = 140;
        const worldHit = new THREE.Mesh(new THREE.SphereGeometry(160, 16, 12), new THREE.MeshBasicMaterial({ visible: false }));
        worldHit.position.y = 90;
        envG.add(platform, pdisc, flash, worldHit);
        M.pickable(worldHit, 3);

        const K = {   // palette
            green: C('#5FDFA6'), violet: C('#B49BF8'), magenta: C('#E562A4'), orchid: C('#B964F5'), cyan: C('#4CDCEF'), white: C('#F1EEFB'),
            amber: C('#DDB049'), red: C('#FF5C72'), teal: C('#1E9FB8'), rain: C('#9FB4FF'), ash: C('#6B6680'), deep: C('#3A2A8C')
        };
        const tc = new THREE.Color();
        function put(i, x, y, z, c, k) { const j = i * 3; tgt[j] = x; tgt[j + 1] = y; tgt[j + 2] = z; tcol[j] = c.r * k; tcol[j + 1] = c.g * k; tcol[j + 2] = c.b * k; }

        const ENV = {
            eeg(t) {
                const B = state.band;
                for (let i = 0; i < 2800; i++) {
                    const c = i % 4, j = (i / 4) | 0, u = (j % 70) / 69 * 2 - 1, v = ((j / 70) | 0) / 9;
                    let x, y, z, k;
                    if (B === 'theta') {        // slow, deep spiral curtains
                        const a = u * Math.PI * 1.1 + t * .22 + c * Math.PI / 2, r = 30 + v * 100;
                        x = Math.cos(a) * r; z = Math.sin(a) * r * .7; y = 100 + Math.sin(a * 2 + t * .35) * 24 + (v - .5) * 30;
                        tc.copy(K.orchid).lerp(K.magenta, v); k = .45 + .4 * Math.sin(a * 3 - t) ** 2;
                    } else if (B === 'beta') {  // fast, tight, structured ripples
                        x = u * 150; z = -55 + c * 36 + Math.sin(u * 15 + t * 6.5 + c) * 6; y = 50 + v * 125 + Math.sin(u * 22 - t * 10 + v * 3) * 2.5;
                        tc.copy(K.cyan).lerp(K.white, v * .7); k = .45 + .45 * Math.abs(Math.sin(u * 30 - t * 12));
                    } else {                    // alpha: flowing aurora curtains
                        x = u * 150; z = -55 + c * 36 + Math.sin(u * 2.6 + t * .7 + c * 1.3) * 26; y = 70 + v * 100 + Math.sin(u * 4 + t * .9 + c) * 8;
                        tc.copy(K.green).lerp(K.violet, v); k = .4 + .5 * Math.sin(u * 6 - t * 1.5 + c) ** 2;
                    }
                    put(i, x, y, z, tc, k * (1 - v * .35));
                }
                for (let i = 2800; i < N; i++) {   // star dome
                    const a = R1[i] * TAU, el = .15 + R2[i] * 1.3, r = 175;
                    put(i, Math.cos(a) * Math.cos(el) * r, 20 + Math.sin(el) * r, Math.sin(a) * Math.cos(el) * r * .7, K.white, .2 + .25 * Math.sin(t * 2 + R3[i] * 40) ** 2);
                }
                return 'Aurora Sky · ' + B[0].toUpperCase() + B.slice(1);
            },
            hrv(t) {
                const s = state.stress, coh = 1 - s;
                for (let i = 0; i < 2800; i++) {
                    const gx = i % 56, gz = (i / 56) | 0, x = (gx / 55 * 2 - 1) * 160, z = (gz / 49 * 2 - 1) * 115;
                    const swell = Math.sin(x * .028 + sig.bp) * 16 * coh + Math.sin(z * .04 + sig.bp * .5) * 4 * coh;
                    const chop = s * (Math.sin(x * .21 + t * 3.1 + R1[i] * 3) * Math.sin(z * .17 - t * 2.3) * 10 + Math.sin((x + z) * .13 + t * 4.7) * 6);
                    const d = Math.hypot(x, z * 1.3), ripple = Math.exp(-((d - sig.hp * 180) ** 2) / 260) * 7 * coh * (1 - sig.hp);
                    const h = swell + chop + ripple;
                    tc.copy(K.teal).lerp(K.cyan, Math.min(1, Math.max(0, h / 14 + .4))).lerp(K.white, Math.max(0, h - 10) / 20).lerp(K.red, s * .45);
                    put(i, x, 40 + h, z, tc, .3 + Math.max(0, h) * .04 + ripple * .06);
                }
                for (let i = 2800; i < N; i++) {   // moon
                    const a = R1[i] * TAU, r = Math.sqrt(R2[i]) * 20;
                    put(i, -40 + Math.cos(a) * r, 175 + Math.sin(a) * r, -120, K.white, .35);
                }
                return 'Bioluminescent Ocean';
            },
            gsr(t) {
                const s = state.stress, grow = 1 - s * .7, TP = [[-95, -30], [-35, 45], [40, -55], [100, 25], [5, -100]];
                for (let i = 0; i < 1500; i++) {
                    const k = (i / 300) | 0, j = i % 300, [tx, tz] = TP[k], th = 28 + grow * 38 + (k % 2) * 10;
                    const sway = Math.sin(t * (1 + s * 6) + k) * s * 10;
                    if (j < 70) { const v = j / 69; put(i, tx + sway * v, v * th, tz, K.amber, .35); continue; }
                    const u = R1[i] * 2 - 1, a = R2[i] * TAU, rr = Math.sqrt(1 - u * u), R = (12 + grow * 20) * (.6 + R3[i] * .4);
                    tc.copy(K.green).lerp(K.ash, s);
                    put(i, tx + sway + rr * Math.cos(a) * R, th + R * .5 + u * R * .8 - s * (1 - u) * 6, tz + rr * Math.sin(a) * R, tc, .5 + (1 - s) * .3);
                }
                for (let i = 1500; i < 1800; i++) {   // ground
                    const a = R1[i] * TAU, r = Math.sqrt(R2[i]) * 165;
                    put(i, Math.cos(a) * r, 0, Math.sin(a) * r * .72, K.deep, .5);
                }
                for (let i = 1800; i < N; i++) {      // weather: fireflies when calm, rain when stressed, lightning on sweat spikes
                    if (sig.spike > .05 && i < 1920) {
                        const v = (i - 1800) / 119, seg = Math.min(10, (v * 11) | 0), f = v * 11 - seg;
                        const x = sig.boltX + sig.bolt[seg] * (1 - f) + sig.bolt[seg + 1] * f;
                        put(i, x, 215 - v * 215, 0, K.white, sig.spike * 1.6);
                    } else if (R1[i] < s * .9) {
                        put(i, (R2[i] * 2 - 1) * 150, 210 - ((t * 230 * (.8 + R1[i] * .4) + R3[i] * 400) % 210), (R3[i] * 2 - 1) * 110, K.rain, .4);
                    } else {
                        put(i, Math.sin(t * .3 + R1[i] * 20) * 130 * R2[i], 18 + R3[i] * 100 + Math.sin(t * 1.3 + R1[i] * 9) * 8,
                            Math.cos(t * .25 + R2[i] * 17) * 100 * R3[i], K.amber, .25 + .7 * Math.sin(t * 3 + R1[i] * 30) ** 2);
                    }
                }
                flash.material.opacity = sig.spike * .45;
                return 'Living Forest';
            },
            respiration(t) {
                const s = state.stress;
                for (let i = 0; i < 2200; i++) {      // scrolling terrain
                    const gx = i % 55, gz = (i / 55) | 0, x = (gx / 54 * 2 - 1) * 160, z = (gz / 39 * 2 - 1) * 110, xw = x + t * 40;
                    const h = (Math.sin(xw * .035 + gz * .3) * .5 + .5) * 24 * (Math.sin(z * .03 + 1) + 1.1);
                    tc.copy(K.deep).lerp(K.cyan, h / 50);
                    put(i, x, 6 + h, z, tc, .45);
                }
                for (let i = 2200; i < 2600; i++) {   // drifting cloud layer
                    const x = ((R1[i] * 320 - t * 25) % 320 + 320) % 320 - 160;
                    put(i, x, 150 + R2[i] * 16, (R3[i] * 2 - 1) * 100, K.white, .12);
                }
                const birdY = 95 + sig.breath * 45 - s * 18 + Math.sin(t * 9) * s * 6, flap = Math.cos(sig.bp);
                hist.push(birdY); if (hist.length > 300) hist.shift();
                for (let i = 2600; i < 2900; i++) {   // glider rides the breath
                    const j = i - 2600, w = (j % 30) / 29 * 2 - 1, ch = ((j / 30) | 0) / 9;
                    put(i, 30 - ch * 10 - Math.abs(w) * 16, birdY + Math.abs(w) * flap * 14, w * 50, K.white, .9);
                }
                for (let i = 2900; i < N; i++) {      // its trail draws the breath wave
                    const k = i - 2900, y = hist[Math.max(0, hist.length - 1 - k)] ?? birdY;
                    tc.copy(K.cyan).lerp(K.violet, k / 300);
                    put(i, 14 - k * .58, y, 0, tc, .9 * (1 - k / 300));
                }
                return 'Breath Flight';
            }
        };
        const hist = [];
        let envAge = 0, lastEnv = null, envFirst = true;
        const worldLabA = new THREE.Object3D(); worldLabA.position.set(0, 235, 0); envG.add(worldLabA);
        const worldLab = M.addLabel(worldLabA, '', null, null, 0, true);

        function tickEnv(dt, t) {
            const key = state.signal + (state.signal === 'eeg' ? state.band : '');
            if (key !== lastEnv) { lastEnv = key; envAge = 0; }
            envAge += dt;
            if (state.signal !== 'gsr') flash.material.opacity = 0;
            worldLab.el.textContent = ENV[state.signal](t);
            if (envFirst) { envFirst = false; cur.set(tgt); col.set(tcol); }   // first world appears fully formed
            const k = Math.min(1, .05 + envAge * envAge * .25);   // morph between worlds, then track exactly
            for (let i = 0; i < N * 3; i++) { cur[i] += (tgt[i] - cur[i]) * k; col[i] += (tcol[i] - col[i]) * Math.min(1, k * 1.5); }
            envGeo.attributes.position.needsUpdate = true;
            envGeo.attributes.color.needsUpdate = true;
            platform.material.opacity = (.45 + Math.sin(t * 1.5) * .1) * focus[3];
            envMat.opacity = .95 * Math.max(focus[3], .15);
            worldLab.el.classList.toggle('gone', focus[3] < .5);
        }

        // ================= labels =================
        const bodyLabA = new THREE.Object3D(); bodyG.add(bodyLabA);
        const labs = [
            M.addLabel(bodyLabA, '', BRAND.body, () => M.openStep(0), 0),
            M.addLabel(stSensor.g, '', BRAND.sensor, () => M.openStep(1), 30),
            M.addLabel(stAlgo.g, '', BRAND.algorithm, () => M.openStep(2), 30),
            M.addLabel(platform, '', BRAND.vr, () => M.openStep(3), 18),
            M.addLabel(stAdj.g, '', BRAND.adjustment, () => M.openStep(4), 30)
        ];
        const youA = new THREE.Object3D(); youA.position.set(0, -165, 0); bodyG.add(youA);
        M.addLabel(youA, 'You', null, null, 0, true);
        // the VR label sits on the front of the platform ring
        labs[3].obj = new THREE.Object3D(); labs[3].obj.position.set(0, 0, 125); envG.add(labs[3].obj);

        M.onSignal(id => {
            M.setDockMode(id === 'eeg' ? 'bands' : 'slider');
            loadDevices();
            loadStrategies();
            buildRibbon();
            const sp = SYSTEM[id].p;
            bodyLabA.position.set(sp[0] - 70, sp[1] + 6, sp[2]);
            labs.forEach((l, i) => { l.el.textContent = M.nodes()[i].label; });
            labs[0].el.textContent = M.nodes()[0].label + '\n· ' + SYSTEM[id].name + ' ·';
        });

        M.onFrame((dt, t) => { tickFocus(dt); tickSignals(dt, t); tickBody(dt, t); tickLoop(dt, t); tickEnv(dt, t); tickDevices(dt, t); tickAlgo(dt, t); tickAdj(dt, t); });

        const FOCUS = [
            () => [BODY_X - 30, 25, 300, 430],                                        // avatar + body label
            () => [stSensor.g.position.x + 100, 150, 380, 300],                       // sensor + device menu
            () => [screen.position.x - 15, 160, 330, 300],                            // algorithm + screen
            () => [WORLD_X, 75, 430, 380],                                            // VR world
            () => [stAdj.g.position.x - 25, stAdj.g.position.y - 55, 730, 300, 65]   // adjustment + strategies + gauge + spiral
        ];

        // Fit a box [centre x, centre y, width, height, depth] into the part of the screen
        // the UI leaves free (see freeRect), so nothing important hides behind the panel or dock
        const HOME_BOX = [75, -10, 1340, 590, 0];
        function fitBox(box, instant) {
            const [cx, cy, w, h, cz = 0] = box;
            const cam = M.camera, { W, H } = M.size(), r = M.freeRect(), tanV = Math.tan(cam.fov * Math.PI / 360);
            if (!W || !H) return;
            const rw = Math.max(120, r.x1 - r.x0), rh = Math.max(120, r.y1 - r.y0);
            const dist = Math.max((h / 2) / (tanV * rh / H), (w / 2) / (tanV * cam.aspect * rw / W));
            const upp = 2 * dist * tanV / H;   // world units per screen pixel at the box's depth
            const x = cx - ((r.x0 + r.x1) / 2 - W / 2) * upp, y = cy + ((r.y0 + r.y1) / 2 - H / 2) * upp;
            M.flyTo(new THREE.Vector3(x, y + dist * .06, cz + dist), new THREE.Vector3(x, y, cz), instant);
        }
        M.onOpen = (i, instant) => fitBox(FOCUS[i](), instant);
        M.onHome = instant => fitBox(HOME_BOX, instant);
    }

    // ------------------------------------------------------------------
    // ENGINE DEFINITION
    // ------------------------------------------------------------------
    window.SimulationEngines['CyberneticLoop'] = {
        name: 'Cybernetic Loop',
        showPlaybackControls: false,

        defaults: {},

        // The engine draws its own controls, so the host builds no slider.
        config: [],

        init: function (container, params) {
            if (!window.CyberneticLoopData || !window.CyberneticLoopData.eeg) {
                console.error('[CyberneticLoop] CyberneticLoopData not found or malformed.');
                return;
            }
            this._container = container;
            this._destroyed = false;
            this._stage = null;

            container.querySelectorAll(':scope > .cl3d').forEach(n => n.remove());
            const root = el('div', 'cl3d');
            root.setAttribute('role', 'region');
            root.setAttribute('aria-label', 'The Cybernetic Loop: interactive 3D biofeedback simulation');
            const status = el('div', 'cl3d-status', 'Loading the 3D loop…');
            root.appendChild(status);
            container.appendChild(root);
            if (getComputedStyle(container).position === 'static') container.style.position = 'relative';
            this._root = root;

            const qs = new URLSearchParams(location.search);
            const lite = qs.has('lite') ||
                (window.matchMedia('(pointer: coarse)').matches && Math.min(window.innerWidth, window.innerHeight) < 600);
            const signal = (params && params.signal) || qs.get('signal') || 'eeg';

            loadDeps().then(() => {
                if (this._destroyed) return;
                this._stage = createStage(root, {
                    lite, signal,
                    eyebrow: 'Biofeedback · Body → World',
                    title: 'The Cybernetic Loop',
                    sub: 'Your signal leaves the body, gets read and processed, then reshapes a world matched to that signal. Click any station to explore it.'
                });
                buildLoop(this._stage);
                this._stage.start();
                status.remove();
                const open = qs.get('open');
                if (open !== null && /^[0-4]$/.test(open)) setTimeout(() => this._stage && this._stage.openStep(Number(open)), 300);
                console.log('[CyberneticLoop] 3D loop initialized');
            }).catch(err => {
                console.error('[CyberneticLoop] Could not load three.js add-ons', err);
                status.textContent = 'The 3D view could not load. Check your connection and reload the page.';
                status.classList.add('error');
            });
        },

        // Host calls this every frame (dt in seconds)
        update: function (dt) {
            if (this._stage) this._stage.frame(dt);
        },

        resize: function () {
            if (this._stage) this._stage.resize();
        },

        reset: function () {
            if (this._stage) this._stage.home();
        },

        destroy: function () {
            this._destroyed = true;
            if (this._stage) this._stage.destroy();
            if (this._root) this._root.remove();
            this._stage = null;
            this._root = null;
        }
    };
})();
