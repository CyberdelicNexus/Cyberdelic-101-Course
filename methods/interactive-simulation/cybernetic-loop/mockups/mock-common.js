/**
 * Shared scaffolding for the Cybernetic Loop 3D layout mockups (low detail).
 * Brand backdrop, bloom, orbit camera, signal tabs, stress slider, step panel, labels.
 * Each concept page calls CLMock.create(...) and adds its own scene.
 * Reads ../cybernetic-loop-data.js (window.CyberneticLoopData).
 */
(function () {
    'use strict';

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

    const CSS = `
    :root{--cyan:#4CDCEF;--violet:#B49BF8;--text:#F1EEFB;--text2:#ABA4C9;--text3:#9890BB;--line:rgba(255,255,255,.11);--line-hi:rgba(180,155,248,.36);
      --blur:blur(22px) saturate(155%);--brand:linear-gradient(100deg,#4CDCEF,#B49BF8 50%,#E562A4);--ease:cubic-bezier(.16,1,.3,1)}
    *{box-sizing:border-box}
    html,body{margin:0;height:100%;background:#000;color:var(--text);font-family:Poppins,system-ui,sans-serif;-webkit-font-smoothing:antialiased;overflow:hidden}
    #stage{position:relative;width:100%;height:100%;overflow:hidden}
    #stage canvas{display:block;width:100%;height:100%;cursor:grab;touch-action:none}
    #stage.hovering canvas{cursor:pointer}
    :where(button,input):focus-visible{outline:2px solid var(--cyan);outline-offset:2px}
    .eb{display:block;font-size:.72rem;font-weight:600;letter-spacing:.18em;text-transform:uppercase;color:var(--cyan)}
    .bar{display:block;width:64px;height:3px;border-radius:2px;background:var(--brand)}
    .head{position:absolute;top:24px;left:24px;max-width:380px;pointer-events:none;transition:opacity .4s}
    .zoomed .head{opacity:0}
    .head h1{margin:6px 0 10px;font-size:1.8rem;font-weight:700;letter-spacing:-.015em;line-height:1.2}
    .head p{margin:12px 0 0;font-size:.86rem;line-height:1.6;color:var(--text3)}
    .tabs{position:absolute;top:24px;left:50%;transform:translateX(-50%);display:flex;gap:4px;padding:4px;border-radius:999px;
      border:1px solid var(--line);background:rgba(15,11,26,.6);backdrop-filter:var(--blur);-webkit-backdrop-filter:var(--blur)}
    .tabs button{min-height:40px;padding:0 16px;border:none;border-radius:999px;background:transparent;color:var(--text2);font:500 .82rem Poppins,sans-serif;cursor:pointer;transition:background .24s,color .24s}
    .tabs button:hover{color:var(--text)}
    .tabs button[aria-pressed=true]{background:rgba(180,155,248,.16);color:var(--text)}
    .dock{position:absolute;left:50%;bottom:24px;transform:translateX(-50%);width:min(520px,calc(100% - 32px));display:flex;align-items:center;gap:16px;
      padding:12px 22px;border-radius:999px;border:1px solid var(--line);background:rgba(15,11,26,.62);backdrop-filter:var(--blur);-webkit-backdrop-filter:var(--blur)}
    .dock .lbl{font:400 .72rem 'JetBrains Mono',monospace;color:var(--text3)}
    .dock input{flex:1;-webkit-appearance:none;appearance:none;height:28px;background:transparent;cursor:pointer}
    .dock input::-webkit-slider-runnable-track{height:4px;border-radius:999px;background:linear-gradient(90deg,#4CDCEF,#B49BF8 55%,#FF5C72)}
    .dock input::-webkit-slider-thumb{-webkit-appearance:none;width:22px;height:22px;margin-top:-9px;border-radius:50%;border:1.5px solid var(--violet);background:radial-gradient(circle,#F1EEFB 0 3px,#0F0B1A 4px);box-shadow:0 0 16px rgba(180,155,248,.7)}
    .dock input::-moz-range-track{height:4px;border-radius:999px;background:linear-gradient(90deg,#4CDCEF,#B49BF8 55%,#FF5C72)}
    .dock .state{min-width:96px;text-align:right}
    .dock .bands{display:none;flex:1;gap:6px}
    .dock--bands{padding:6px}
    .dock--bands>:not(.bands){display:none}
    .dock--bands .bands{display:flex}
    .bands button{flex:1;display:flex;flex-direction:column;align-items:center;gap:1px;min-height:48px;padding:6px 10px;border:none;border-radius:999px;background:transparent;color:var(--text2);cursor:pointer;transition:background .24s,color .24s}
    .bands button strong{font:600 .86rem Poppins,sans-serif}
    .bands button small{font:400 .66rem 'JetBrains Mono',monospace;color:var(--text3)}
    .bands button:hover{color:var(--text)}
    .bands button[aria-pressed=true]{background:rgba(180,155,248,.16);color:var(--text)}
    .panel{position:absolute;top:84px;right:24px;width:min(380px,calc(100% - 48px));padding:24px;border-radius:22px;border:1px solid var(--line);
      background:rgba(22,15,36,.62);backdrop-filter:var(--blur);-webkit-backdrop-filter:var(--blur);box-shadow:0 18px 48px rgba(0,0,0,.55);
      opacity:0;transform:translateX(24px);pointer-events:none;transition:opacity .4s,transform .7s var(--ease)}
    .panel.open{opacity:1;transform:none;pointer-events:auto}
    .panel .eb{color:var(--c,var(--cyan))}
    .panel h2{margin:6px 0 12px;font-size:1.35rem;font-weight:700;line-height:1.25}
    .panel p{margin:14px 0 0;font-size:.9rem;line-height:1.6;color:var(--text2)}
    .panel p.why{color:var(--text3);font-size:.84rem}
    .panel{max-height:calc(100% - 200px);overflow-y:auto;scrollbar-width:thin;scrollbar-color:rgba(180,155,248,.35) transparent}
    .panel .ex{margin-top:16px}
    .panel table{width:100%;border-collapse:collapse;font-size:.76rem;line-height:1.45}
    .panel th{text-align:left;font:600 .62rem Poppins,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:var(--text3);padding:0 6px 8px 0;border-bottom:1px solid var(--line)}
    .panel td{vertical-align:top;padding:8px 6px 8px 0;border-bottom:1px solid rgba(255,255,255,.06);color:var(--text2)}
    .panel td:last-child{font-family:'JetBrains Mono',monospace;font-size:.7rem;color:var(--cyan)}
    .panel td strong{color:var(--text)}
    .panel .nav{display:flex;justify-content:space-between;margin-top:18px}
    .panel .nav button,.panel .close{min-height:36px;padding:0 14px;border-radius:999px;border:1px solid var(--line);background:transparent;color:var(--text);font:500 .8rem Poppins,sans-serif;cursor:pointer}
    .panel .nav button:hover,.panel .close:hover{border-color:var(--line-hi);background:rgba(255,255,255,.075)}
    .panel .close{float:right;margin:-6px -6px 0 0;border:none}
    .labels{position:absolute;inset:0;pointer-events:none}
    .lab{position:absolute;left:0;top:0;transform-origin:0 0;font:600 .8rem/1.25 Poppins,sans-serif;text-align:center;white-space:pre-line;color:var(--text);
      text-shadow:0 0 12px #000,0 0 4px #000;pointer-events:auto;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:5px}
    .lab::after{content:"";width:16px;height:2px;border-radius:2px;background:var(--c);box-shadow:0 0 8px var(--c)}
    .lab.plain{pointer-events:none;cursor:default;font-weight:500;color:var(--text2);letter-spacing:.14em;text-transform:uppercase;font-size:.68rem}
    .lab.plain::after{display:none}
    .lab.gone{visibility:hidden}
    .lab.side{align-items:flex-start;text-align:left}
    .lab.side::after{display:none}
    .lab.dev{gap:2px;transition:filter .3s}
    .lab.dev b{font:600 .76rem Poppins,sans-serif}
    .lab.dev i{font:400 .66rem 'JetBrains Mono',monospace;font-style:normal;color:var(--cyan);white-space:normal;max-width:220px}
    .lab.dev.dim{filter:opacity(.38)}
    .lab.dev.strat i{color:#E9C77A}
    .lab.dev:hover{filter:none}
    .badge{position:absolute;right:24px;bottom:34px;font:500 .7rem 'JetBrains Mono',monospace;color:var(--text3)}
    @media (max-width:900px){.head p{display:none}.tabs{top:auto;bottom:96px}.badge{display:none}}
    `;

    const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text !== undefined) n.textContent = text; return n; };

    function create(opts) {
        const THREE = window.THREE;
        const DATA = window.CyberneticLoopData;
        const style = document.createElement('style');
        style.textContent = CSS;
        document.head.appendChild(style);
        const fonts = document.createElement('link');
        fonts.rel = 'stylesheet';
        fonts.href = 'https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap';
        document.head.appendChild(fonts);

        const stage = document.getElementById('stage');
        const qs = new URLSearchParams(location.search);

        // ---------- renderer / camera / bloom ----------
        const renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
        stage.appendChild(renderer.domElement);
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(42, 1, 1, 9000);
        const HOME_POS = new THREE.Vector3(...opts.home.pos);
        const HOME_TARGET = new THREE.Vector3(...opts.home.target);
        camera.position.copy(HOME_POS);
        const controls = new THREE.OrbitControls(camera, renderer.domElement);
        controls.target.copy(HOME_TARGET);
        Object.assign(controls, { enableDamping: true, dampingFactor: 0.06, enablePan: false, minDistance: 80, maxDistance: 1400, rotateSpeed: 0.5 });
        const composer = new THREE.EffectComposer(renderer);
        composer.addPass(new THREE.RenderPass(scene, camera));
        const bloom = new THREE.UnrealBloomPass(new THREE.Vector2(256, 256), 0.75, 0.55, 0.3);
        if (!qs.has('nobloom')) composer.addPass(bloom);   // ?nobloom = quick test captures

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
        const head = el('header', 'head');
        head.append(el('span', 'eb', opts.eyebrow), el('h1', null, opts.title), el('span', 'bar'), el('p', null, opts.sub));
        const tabs = el('div', 'tabs');
        tabs.setAttribute('role', 'group');
        tabs.setAttribute('aria-label', 'Signal type');
        const labels = el('div', 'labels');
        const dock = el('div', 'dock');
        const calmL = el('span', 'lbl', 'Calm');
        const range = Object.assign(el('input'), { type: 'range', min: 0, max: 1, step: 0.01, value: 0.65 });
        range.setAttribute('aria-label', 'Stress level');
        const tenseL = el('span', 'lbl', 'Tense');
        const stateOut = el('span', 'eb state', '');
        // EEG band picker: replaces the calm/tense slider when a page asks for it
        const bands = el('div', 'bands');
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
        const panel = el('aside', 'panel');
        const badge = el('div', 'badge', 'Layout mockup · low detail');
        stage.append(labels, head, tabs, dock, panel, badge);

        const state = { signal: qs.get('signal') || 'eeg', stress: 0.65, band: qs.get('band') || 'alpha', open: null, time: 0 };
        const frameFns = [], signalFns = [], pickables = [];
        const nodes = () => DATA[state.signal];

        function setBand(id) {
            state.band = id;
            bands.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.id === id)));
        }
        setBand(state.band);
        function setDockMode(mode) { dock.classList.toggle('dock--bands', mode === 'bands'); }

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
            const close = el('button', 'close', '✕');
            close.type = 'button';
            close.setAttribute('aria-label', 'Close');
            close.addEventListener('click', home);
            const nav = el('div', 'nav');
            const prev = el('button', null, '← Prev'), next = el('button', null, 'Next →');
            prev.type = next.type = 'button';
            prev.addEventListener('click', () => openStep((i + 4) % 5));
            next.addEventListener('click', () => openStep((i + 1) % 5));
            nav.append(prev, next);
            panel.append(close, el('span', 'eb', `Step ${n.step} of 5`), el('h2', null, n.title), el('span', 'bar'),
                el('p', null, n.body), el('p', 'why', n.why));
            if (n.example) { const ex = el('div', 'ex'); ex.innerHTML = n.example; panel.appendChild(ex); }   // trusted local course data
            panel.appendChild(nav);
            panel.classList.add('open'); stage.classList.add('zoomed');
            if (fly && api.onOpen) api.onOpen(i);
        }
        function home() {
            state.open = null;
            panel.classList.remove('open'); stage.classList.remove('zoomed');
            flyTo(HOME_POS, HOME_TARGET);
        }

        // ---------- camera flight ----------
        let flight = null;
        function flyTo(pos, target, dur = 1.2) {
            if (qs.has("instant")) dur = .001;   // ?instant = test captures
            flight = { p0: camera.position.clone(), p1: pos.clone(), t0: controls.target.clone(), t1: target.clone(), t: 0, dur };
        }

        // ---------- labels ----------
        const labelList = [];
        const tmp = new THREE.Vector3();
        function addLabel(obj, text, color, onClick, offsetPx = 28, plain = false, side = false) {
            const n = el('div', 'lab' + (plain ? ' plain' : '') + (side ? ' side' : ''), text);
            n.style.setProperty('--c', color || '#B49BF8');
            if (onClick) n.addEventListener('click', onClick);
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
            const hit = ray.intersectObjects(pickables.map(p => p.mesh), false)[0];
            return hit ? pickables.find(p => p.mesh === hit.object).index : null;
        }
        let down = null;
        renderer.domElement.addEventListener('pointerdown', e => { down = [e.clientX, e.clientY]; });
        renderer.domElement.addEventListener('pointerup', e => {
            if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 5) { down = null; return; }
            down = null;
            const i = pick(e);
            if (i !== null) openStep(i); else if (state.open !== null) home();
        });
        renderer.domElement.addEventListener('pointermove', e => stage.classList.toggle('hovering', pick(e) !== null));
        window.addEventListener('keydown', e => { if (e.key === 'Escape') home(); });

        // ---------- resize + loop ----------
        let W = 1, H = 1;
        function resize() {
            W = stage.clientWidth; H = stage.clientHeight;
            renderer.setSize(W, H); composer.setSize(W, H);
            camera.aspect = W / H; camera.updateProjectionMatrix();
        }
        new ResizeObserver(resize).observe(stage);
        resize();

        const clock = new THREE.Clock();
        function loop() {
            const dt = Math.min(clock.getDelta(), 0.05);
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
                l.el.style.opacity = 1;
                const x = (tmp.x * .5 + .5) * W, y = (-tmp.y * .5 + .5) * H;
                l.el.style.transform = l.side ? `translate(${(x + 14).toFixed(1)}px, ${(y - 12).toFixed(1)}px)`
                    : `translate(${x.toFixed(1)}px, ${(y + l.offsetPx).toFixed(1)}px) translateX(-50%)`;
            });
            composer.render();
            requestAnimationFrame(loop);
        }

        const api = {
            THREE, scene, camera, controls, state, BRAND, nodes, glow, orbMaterial, tube, additive,
            addLabel, flyTo, home, openStep, setDockMode, setBand,
            setStress: v => { range.value = v; setStress(v); },
            onFrame: fn => frameFns.push(fn),
            onSignal: fn => signalFns.push(fn),
            pickable: (mesh, index) => pickables.push({ mesh, index }),
            start() {
                setSignal(state.signal);
                const s = Number(qs.get('stress'));
                if (qs.has('stress')) { range.value = s; setStress(s); }
                if (qs.has('open')) setTimeout(() => openStep(Number(qs.get('open'))), 200);
                requestAnimationFrame(loop);
            }
        };
        return api;
    }

    window.CLMock = { create, BRAND };
})();
