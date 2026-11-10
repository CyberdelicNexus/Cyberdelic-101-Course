/**
 * Tesseract Explorer - Simulation Engine (3D "Unfolding Net")
 * Registers itself to window.SimulationEngines['TesseractExplorer'].
 *
 * At rest the tesseract is a glass hypercube: an inner cube, an outer cube and six frustum cells between
 * them, one per design dimension. Picking a dimension unfolds it into its 8-cube net (a column of four
 * cubes with four more around the second). The six dimension cubes keep their colours; the other two are
 * the neutral core and anchor. The chosen cube slides towards you and opens like a room: its front wall
 * fades and its options float inside as unlabelled crystals that light up when chosen (click one to toggle it;
 * hovering an option in the panel brightens its crystal). The only words in the scene are the dimension names.
 * "Fold the tesseract" folds it back. When every side is filled the core lights up and the Experience
 * Blueprint appears.
 *
 * - Content comes from tesseract-explorer-data.js (window.TesseractExplorerData, or params.data).
 * - Layouts: desktop (>=1240px) nav left, workspace right. Tablet and phone: a one-row dimension strip and
 *   a collapsible bottom sheet, so the tesseract stays visible; the camera re-frames to the space left free.
 * - A standalone simulation: no completion gate. "x / 6" is only a guide.
 * - three.js add-ons (OrbitControls, bloom) are loaded on demand.
 * - The previous version is kept as tesseract-explorer-2d.js / .css (not loaded).
 * - Testing: ?te-preview=fill or ?te-preview=<dimension id>, plus ?te-instant to skip the animations.
 */
(function () {
    'use strict';

    window.SimulationEngines = window.SimulationEngines || {};

    // Nexus palette for the six sides (the data file's own colours are darker print tones)
    const COL = { reality: '#5B8CF0', sensory: '#DDB049', presence: '#4CDCEF', states: '#B49BF8', traits: '#5FDFA6', meaning: '#E562A4' };
    // where each side sits around the inner cube (and its place in the unfolded net)
    const SIDE = { presence: [0, 1, 0], traits: [0, -1, 0], states: [1, 0, 0], sensory: [-1, 0, 0], meaning: [0, 0, 1], reality: [0, 0, -1] };
    const RULE = d => d.type === 'single' ? 'choose one' : d.type === 'multi-limit' ? 'choose up to ' + d.limit : d.type === 'multi' ? 'choose any' : 'three steps';

    // ------------------------------------------------------------------
    // Dependency loader (shared by every 3D engine on the page)
    // ------------------------------------------------------------------
    // three.js r128 and its add-ons are served from core/vendor/three-r128 (same origin).
    // The platform's Content-Security-Policy blocks scripts from any CDN. The folder is
    // found from this script's own URL, so it works from any page that loads the engine.
    const VENDOR = (() => {
        const me = document.currentScript ||
            [...document.scripts].reverse().find(s => /methods\/interactive-simulation\//.test(s.src));
        return new URL('../../../core/vendor/three-r128/', me ? me.src : location.href).href;
    })();
    const THREE_SRC = VENDOR + 'three.min.js';
    const EXAMPLES = VENDOR;
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
        if (window.__cnTeDeps) return window.__cnTeDeps;
        window.__cnTeDeps = (async () => {
            if (!window.THREE) await loadScript(THREE_SRC);
            for (const [name, path] of DEPS) {
                if (!window.THREE[name]) await loadScript(EXAMPLES + path);
            }
        })();
        window.__cnTeDeps.catch(() => { window.__cnTeDeps = null; });   // allow a retry on the next init
        return window.__cnTeDeps;
    }

    const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text !== undefined) n.textContent = text; return n; };
    const button = (cls, text) => { const b = el('button', cls, text); b.type = 'button'; return b; };

    // ------------------------------------------------------------------
    // The explorer: UI and 3D scene, built inside `root`
    // ------------------------------------------------------------------
    function createExplorer(root, DATA, opts) {
        const THREE = window.THREE;
        const DIMS = DATA.dimensions;
        const dimById = id => DIMS.find(d => d.id === id);
        const qs = new URLSearchParams(location.search);
        const INSTANT = qs.has('te-instant');
        const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        const cleanups = [];
        const on = (target, type, fn, o) => { target.addEventListener(type, fn, o); cleanups.push(() => target.removeEventListener(type, fn, o)); };

        // ================= selections =================
        const blank = () => ({ reality: [], sensory: [], presence: [], states: [], traits: [], meaning: { world: null, story: { from: null, toward: null }, magic: null } });
        let sel = blank();
        let mode = 'intro', current = null, mStep = 1, wasAll = false, bpTimer = null, sheetOpen = false;
        const isDone = id => id === 'meaning' ? !!(sel.meaning.world && sel.meaning.story.from && sel.meaning.story.toward && sel.meaning.magic) : sel[id].length > 0;
        const doneCount = () => DIMS.filter(d => isDone(d.id)).length;
        const allDone = () => doneCount() === DIMS.length;
        function toggle(dim, optId) {
            const arr = sel[dim.id];
            if (dim.type === 'single') sel[dim.id] = [optId];
            else {
                const i = arr.indexOf(optId);
                if (i > -1) arr.splice(i, 1);
                else { if (dim.limit && arr.length >= dim.limit) arr.shift(); arr.push(optId); }
            }
            changed();
        }
        function changed() {
            render();
            const all = allDone();
            if (all && !wasAll) { clearTimeout(bpTimer); bpTimer = setTimeout(showBlueprint, INSTANT ? 0 : 900); }
            wasAll = all;
        }

        // ================= UI =================
        const uiNodes = [];
        const add = n => { root.appendChild(n); uiNodes.push(n); return n; };
        const labelsEl = add(el('div', 'labels'));
        const head = add(el('header', 'head'));
        head.append(el('span', 'eb', 'Design Dimension Explorer'), el('h1', null, 'The Tesseract'), el('span', 'bar'),
            el('p', null, 'Six sides shape every cyberdelic experience. Pick a side to unfold the tesseract and design it.'));

        const dimsEl = add(el('nav', 'dims glass')); dimsEl.setAttribute('aria-label', 'Dimensions');
        const chipsEl = el('div', 'chips'), progEl = el('div', 'prog'), progTxt = el('span');
        progEl.appendChild(progTxt);
        const foldBtn = button('fold', 'Fold the tesseract');
        dimsEl.append(el('span', 'lbl', 'Dimensions'), chipsEl, progEl, foldBtn);
        const chipEls = {};
        DIMS.forEach(d => {
            const b = button('chip'); b.style.setProperty('--c', COL[d.id]); b.title = d.name;
            b.append(el('span', 'ic', d.icon), el('span', 'nm', d.name), el('span', 'st'));
            // tapping the open side again folds the tesseract
            on(b, 'click', () => (mode === 'dim' && current === d.id) ? fold() : openDim(d.id));
            chipsEl.appendChild(b); chipEls[d.id] = b;
        });
        on(foldBtn, 'click', fold);

        const panel = add(el('aside', 'panel glass')); panel.setAttribute('aria-label', 'Design workspace');
        const sheetBtn = button('sheet-head');
        const sheetIc = el('span', 'ic'), sheetTx = el('span', 'tx'), sheetTitle = el('b'), sheetSub = el('small');
        sheetTx.append(sheetTitle, sheetSub);
        sheetBtn.append(sheetIc, sheetTx, el('span', 'chev', '▲'));
        const scroll = el('div', 'scroll'); scroll.id = 'te3d-' + Math.random().toString(36).slice(2, 8);
        sheetBtn.setAttribute('aria-controls', scroll.id);
        const foot = el('div', 'foot');
        panel.append(sheetBtn, scroll, foot);
        on(sheetBtn, 'click', () => setSheet(!sheetOpen));

        let W = 0, H = 0, layout = '';
        const compact = () => W < 1240;
        function setSheet(open) {
            sheetOpen = open;
            root.classList.toggle('sheet-open', open);
            sheetBtn.setAttribute('aria-expanded', String(open));
            reframe = .8;
        }

        function openDim(id) {
            clearTimeout(bpTimer);
            mode = 'dim'; current = id;
            if (id === 'meaning') {
                const m = sel.meaning;
                mStep = !m.world ? 1 : !(m.story.from && m.story.toward) ? 2 : !m.magic ? 3 : 0;
            }
            render();
            scroll.scrollTop = 0;
            if (compact()) setSheet(true);
            reframe = .8;
        }
        function fold() {
            if (mode !== 'dim') return;
            mode = 'intro'; current = null; render();
            if (compact()) setSheet(false);
            reframe = .8;
        }
        function showBlueprint() { mode = 'blueprint'; current = null; render(); scroll.scrollTop = 0; if (compact()) setSheet(true); reframe = .8; }
        function resetAll() { clearTimeout(bpTimer); sel = blank(); wasAll = false; mode = 'intro'; current = null; render(); if (compact()) setSheet(false); reframe = .8; }

        let hoverIdx = -1;   // option hovered or focused in the panel: its crystal brightens
        function optButton(o, on_, single, onClick, idx) {
            const b = button('opt' + (single ? ' single' : ''));
            if (idx !== undefined) {
                const enter = () => { hoverIdx = idx; }, leave = () => { if (hoverIdx === idx) hoverIdx = -1; };
                on(b, 'pointerenter', enter); on(b, 'pointerleave', leave); on(b, 'focus', enter); on(b, 'blur', leave);
            }
            b.setAttribute('aria-pressed', String(on_));
            b.append(el('b', null, o.title), el('i'), el('span', null, o.description));
            on(b, 'click', onClick);
            return b;
        }
        const titleOf = (list, id) => (list.find(o => o.id === id) || {}).title;
        function summaryOf(d) {
            if (d.id === 'meaning') {
                const m = sel.meaning, M = DATA.meaningData;
                if (isDone('meaning')) return titleOf(M.world.options, m.world) + ' · ' + m.story.from + ' → ' + m.story.toward + ' · ' + titleOf(M.magic.options, m.magic);
                return 'three steps · ' + [m.world, m.story.from && m.story.toward, m.magic].filter(Boolean).length + ' of 3 done';
            }
            const picked = sel[d.id].map(id => titleOf(d.options, id));
            return RULE(d) + ' · ' + (picked.length ? picked.join(', ') : 'nothing chosen yet');
        }

        function render() {
            scroll.innerHTML = ''; foot.innerHTML = ''; hoverIdx = -1;
            scroll.className = 'scroll' + (mode === 'intro' ? ' intro' : mode === 'blueprint' ? ' bp' : '');
            if (mode === 'intro') {
                panel.style.setProperty('--c', '#B49BF8');
                sheetIc.textContent = '◇';
                sheetTitle.textContent = allDone() ? 'All six sides designed' : 'Six sides of an experience';
                sheetSub.textContent = 'Tap a cube or a dimension above to unfold it';
                scroll.append(el('span', 'lbl', 'Six sides of an experience'),
                    el('p', 'desc', 'Each side of the tesseract is one dimension of a cyberdelic design. Click a side, or pick one below, to unfold it.'));
                if (allDone()) {
                    const c = button('card bpc'); c.style.setProperty('--c', '#B49BF8');
                    const t = el('div'); t.append(el('b', null, 'View your Experience Blueprint'), el('span', null, DATA.methods.generateName(sel)));
                    c.append(el('span', 'ic', '✦'), t);
                    on(c, 'click', showBlueprint);
                    scroll.appendChild(c);
                }
                DIMS.forEach(d => {
                    const c = button('card'); c.style.setProperty('--c', COL[d.id]);
                    const t = el('div'); t.append(el('b', null, d.name + (isDone(d.id) ? '  ✓' : '')), el('span', null, d.description));
                    c.append(el('span', 'ic', d.icon), t);
                    on(c, 'click', () => openDim(d.id));
                    scroll.appendChild(c);
                });
            } else if (mode === 'dim') {
                const d = dimById(current);
                panel.style.setProperty('--c', COL[d.id]);
                scroll.style.setProperty('--c', COL[d.id]);
                sheetIc.textContent = d.icon; sheetTitle.textContent = d.name; sheetSub.textContent = summaryOf(d);
                const h = el('div', 'dh'); h.append(el('span', 'ic', d.icon), el('h2', null, d.name));
                const about = el('details', 'about'); about.open = !compact();
                about.append(el('summary', null, 'About ' + d.name), el('p', 'desc', d.description));
                scroll.append(h, about, el('div', 'q', d.question), el('span', 'rule', RULE(d)));
                if (d.id === 'meaning') renderMeaning();
                else d.options.forEach((o, i) => scroll.appendChild(optButton(o, sel[d.id].includes(o.id), d.type === 'single', () => toggle(d, o.id), i)));
                const i = DIMS.indexOf(d), P = DIMS[(i + DIMS.length - 1) % DIMS.length], N = DIMS[(i + 1) % DIMS.length];
                const prev = button('btn', '← ' + P.name), next = button('btn', N.name + ' →'), f2 = button('btn fold2', 'Fold');
                on(prev, 'click', () => openDim(P.id)); on(next, 'click', () => openDim(N.id)); on(f2, 'click', fold);
                foot.append(prev, f2, next);
                if (allDone()) { const bp = button('btn pri', '✦ Blueprint'); on(bp, 'click', showBlueprint); foot.appendChild(bp); }
            } else {
                const res = DATA.methods.generateDescription(sel), name = DATA.methods.generateName(sel);
                panel.style.setProperty('--c', '#B49BF8');
                scroll.style.setProperty('--c', '#B49BF8');
                sheetIc.textContent = '✦'; sheetTitle.textContent = 'Experience Blueprint'; sheetSub.textContent = name;
                scroll.append(el('span', 'eb', 'Experience Blueprint'), el('h2', null, name));
                const row = el('div', 'sumrow');
                DIMS.forEach(d => { const s = el('span', null, d.icon + ' ' + d.name); s.style.setProperty('--c', COL[d.id]); row.appendChild(s); });
                scroll.appendChild(row);
                res.paragraphs.forEach(p => scroll.appendChild(el('p', null, p)));
                const coh = el('div', 'coh'); coh.append(el('b', null, 'Coherence'), document.createTextNode(res.coherenceNote));
                scroll.appendChild(coh);
                const edit = button('btn', 'Edit choices'), again = button('btn pri', 'Build another');
                on(edit, 'click', () => openDim(DIMS[0].id)); on(again, 'click', resetAll);
                foot.append(edit, again);
            }
            // nav
            DIMS.forEach(d => { chipEls[d.id].classList.toggle('done', isDone(d.id)); chipEls[d.id].setAttribute('aria-current', String(d.id === current)); });
            const n = doneCount();
            progTxt.innerHTML = n + ' / 6<span class="pw"> dimensions</span>';
            progEl.classList.toggle('all', n === 6);
            foldBtn.disabled = mode !== 'dim';
        }

        function renderMeaning() {
            const M = DATA.meaningData, m = sel.meaning;
            const storyDone = !!(m.story.from && m.story.toward);
            const steps = [
                { n: 1, name: 'The World', val: titleOf(M.world.options, m.world), done: !!m.world, avail: true },
                { n: 2, name: 'The Story', val: storyDone ? m.story.from + ' → ' + m.story.toward : null, done: storyDone, avail: !!m.world },
                { n: 3, name: 'The Magic', val: titleOf(M.magic.options, m.magic), done: !!m.magic, avail: !!(m.world && storyDone) }
            ];
            steps.forEach(s => {
                const open = s.avail && mStep === s.n;
                const box = el('div', 'step' + (s.done ? ' done' : '') + (open ? ' open' : '') + (s.avail ? '' : ' locked'));
                const hb = button(); hb.setAttribute('aria-expanded', String(open)); hb.disabled = !s.avail;
                const si = s.n - 1, enter = () => { hoverIdx = si; }, leave = () => { if (hoverIdx === si) hoverIdx = -1; };
                on(hb, 'pointerenter', enter); on(hb, 'pointerleave', leave); on(hb, 'focus', enter); on(hb, 'blur', leave);
                const tx = el('div'); tx.append(el('small', null, 'Step ' + s.n + ' · ' + s.name), el('em', null, s.val || (s.avail ? 'Not chosen yet' : 'Finish step ' + (s.n - 1) + ' first')));
                hb.append(tx, el('span', 'ok'), el('span', 'chev', '▼'));
                on(hb, 'click', () => { mStep = mStep === s.n ? 0 : s.n; render(); });
                const body = el('div', 'body');
                if (s.n === 1) {
                    body.append(el('p', null, M.world.question + ' ' + M.world.description));
                    M.world.options.forEach(o => body.appendChild(optButton(o, m.world === o.id, true, () => { m.world = o.id; mStep = 2; changed(); })));
                } else if (s.n === 2) {
                    body.append(el('p', null, M.story.question + ' ' + M.story.description));
                    [['Moving from…', 'fromOptions', 'from'], ['Moving toward…', 'towardOptions', 'toward']].forEach(([lab, key, f]) => {
                        body.appendChild(el('span', 'lbl', lab));
                        const w = el('div', 'words');
                        M.story[key].forEach(word => {
                            const b = button('word', word); b.setAttribute('aria-pressed', String(m.story[f] === word));
                            on(b, 'click', () => { m.story[f] = word; if (m.story.from && m.story.toward) mStep = 3; changed(); });
                            w.appendChild(b);
                        });
                        body.appendChild(w);
                    });
                } else {
                    body.append(el('p', null, M.magic.question + ' ' + M.magic.description));
                    M.magic.options.forEach(o => body.appendChild(optButton(o, m.magic === o.id, true, () => { m.magic = o.id; mStep = 0; changed(); })));
                }
                box.append(hb, body);
                scroll.appendChild(box);
            });
        }

        // ================= 3D =================
        const C = h => new THREE.Color(h), V = (x, y, z) => new THREE.Vector3(x, y, z), TAU = Math.PI * 2;
        const clamp01 = x => Math.max(0, Math.min(1, x));
        const smooth = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
        const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, opts.lite ? 1.5 : 2));
        renderer.setClearColor(0x000000, 1);
        renderer.domElement.className = 'te3d-canvas';
        root.prepend(renderer.domElement);
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(40, 1, 1, 9000);
        const CAM_DIR = V(.3, .3, 1).normalize(), TARGET = V(0, 0, 0);
        camera.position.copy(CAM_DIR).multiplyScalar(900);
        const controls = new THREE.OrbitControls(camera, renderer.domElement);
        controls.target.copy(TARGET);
        Object.assign(controls, { enableDamping: true, dampingFactor: .06, enablePan: false, minDistance: 260, maxDistance: 2600, rotateSpeed: .5, zoomSpeed: .7 });
        // Inside a scrolling lesson page, plain wheel scrolls the page and Ctrl/Cmd + wheel zooms.
        // On a full-screen page (nothing to scroll), plain wheel zooms.
        const pageScrolls = () => { const se = document.scrollingElement || document.documentElement; return se.scrollHeight > window.innerHeight + 4; };
        on(renderer.domElement, 'wheel', e => { controls.enableZoom = !pageScrolls() || e.ctrlKey || e.metaKey; }, { capture: true, passive: true });
        const composer = new THREE.EffectComposer(renderer);
        composer.addPass(new THREE.RenderPass(scene, camera));
        const bloom = opts.lite ? null : new THREE.UnrealBloomPass(new THREE.Vector2(256, 256), .75, .55, .28);
        if (bloom) composer.addPass(bloom);

        // backdrop + stars (house style)
        scene.add(new THREE.Mesh(new THREE.SphereGeometry(4000, 32, 24), new THREE.ShaderMaterial({
            side: THREE.BackSide, depthWrite: false,
            vertexShader: 'varying vec3 d; void main(){ d = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
            fragmentShader: `varying vec3 d; void main(){ vec3 v = normalize(d);
                float a = pow(max(dot(v, normalize(vec3(-.6,.35,-.7))),0.),2.5);
                float b = pow(max(dot(v, normalize(vec3(.75,-.2,-.6))),0.),2.5);
                float c = pow(max(dot(v, normalize(vec3(0.,.9,-.3))),0.),2.);
                gl_FragColor = vec4((vec3(.29,.17,.58)*a + vec3(.36,.16,.43)*b + vec3(.106,.227,.47)*c)*.36, 1.); }`
        })));
        {
            const n = opts.lite ? 900 : 1500, pos = new Float32Array(n * 3);
            for (let i = 0; i < n; i++) {
                const u = Math.random() * 2 - 1, th = Math.random() * TAU, r = Math.sqrt(1 - u * u), R = 1800 + Math.random() * 1500;
                pos.set([r * Math.cos(th) * R, u * R, r * Math.sin(th) * R], i * 3);
            }
            const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
            scene.add(new THREE.Points(g, new THREE.PointsMaterial({ size: 1.4, sizeAttenuation: false, color: 0xd8d0ff, transparent: true, opacity: .6, depthWrite: false })));
        }
        const additive = { transparent: true, blending: THREE.AdditiveBlending, depthWrite: false };
        const glowTex = (() => {
            const c = document.createElement('canvas'); c.width = c.height = 128;
            const g = c.getContext('2d'), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
            gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.25, 'rgba(255,255,255,.4)'); gr.addColorStop(.6, 'rgba(255,255,255,.08)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
            g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
            return new THREE.CanvasTexture(c);
        })();
        function glow(color, size, opacity = .5) {
            const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color, opacity, ...additive }));
            s.scale.setScalar(size); return s;
        }
        // Rim-lit glass. Normals are not normalised in the vertex shader (a collapsed wall has a zero normal),
        // and any non-finite rim value is dropped so it cannot spread through the bloom pass.
        const RIM_VS = 'varying vec3 n; varying vec3 v; void main(){ n = normalMatrix*normal; vec4 mv = modelViewMatrix*vec4(position,1.); v = -mv.xyz; gl_Position = projectionMatrix*mv; }';
        const RIM = p => `float f = pow(max(0., 1. - abs(dot(n / max(length(n), 1e-5), normalize(v)))), ${p}); if (!(f >= 0. && f <= 1.)) f = 0.;`;
        function glassMaterial(color, strength = 1) {
            return new THREE.ShaderMaterial({
                uniforms: { uColor: { value: C(color) }, uStrength: { value: strength } },
                vertexShader: RIM_VS,
                fragmentShader: `uniform vec3 uColor; uniform float uStrength; varying vec3 n; varying vec3 v;
                    void main(){ ${RIM('2.4')} gl_FragColor = vec4(uColor * (f * .95 + .06) * uStrength, 1.); }`,
                ...additive
            });
        }
        // a cell's walls: per-vertex alpha so one wall can fade (the "door" of an open room)
        function wallMaterial(color) {
            return new THREE.ShaderMaterial({
                uniforms: { uColor: { value: C(color) }, uStrength: { value: .4 } },
                vertexShader: 'attribute float aA; varying float vA; varying vec3 n; varying vec3 v; void main(){ vA = aA; n = normalMatrix*normal; vec4 mv = modelViewMatrix*vec4(position,1.); v = -mv.xyz; gl_Position = projectionMatrix*mv; }',
                fragmentShader: `uniform vec3 uColor; uniform float uStrength; varying float vA; varying vec3 n; varying vec3 v;
                    void main(){ ${RIM('2.2')} gl_FragColor = vec4(uColor * (f * .6 + .025) * uStrength * vA, 1.); }`,
                ...additive, side: THREE.DoubleSide
            });
        }

        // ---- the tesseract's eight cells ----
        // folded: inner cube r, outer cube R, six frustums between them. net: cubes of half-size HS on a grid of GRID.
        const r = 48, R = 112, HS = 48, GRID = 104;
        const net = new THREE.Group(); scene.add(net);
        const FACES = [[0, 1, 3, 2], [4, 5, 7, 6], [0, 1, 5, 4], [2, 3, 7, 6], [0, 2, 6, 4], [1, 3, 7, 5]];   // face 1 = u+ (outer / front wall)
        const EDGES = []; for (let i = 0; i < 8; i++) for (let j = i + 1; j < 8; j++) if ([1, 2, 4].includes(i ^ j)) EDGES.push(i, j);
        function frameFor(n) {   // right-handed (t1, t2, n) with t2 as "up" when the cell faces the viewer
            const t2 = Math.abs(n.y) > .5 ? V(0, 0, -n.y) : V(0, 1, 0);
            return { t1: t2.clone().cross(n), t2 };
        }
        const cells = [];
        function makeCell(id, color, n, netPos, kind) {
            const fr = n ? frameFor(V(...n)) : { t1: V(1, 0, 0), t2: V(0, 1, 0) };
            const wallGeo = new THREE.BufferGeometry();
            wallGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(36 * 3), 3));
            wallGeo.setAttribute('aA', new THREE.BufferAttribute(new Float32Array(36).fill(1), 1));
            const wallMat = wallMaterial(color);
            const walls = new THREE.Mesh(wallGeo, wallMat); walls.frustumCulled = false; net.add(walls);
            const edgeGeo = new THREE.BufferGeometry(); edgeGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(24 * 3), 3));
            const edgeMat = new THREE.LineBasicMaterial({ color, opacity: .5, ...additive });
            const edges = new THREE.LineSegments(edgeGeo, edgeMat); edges.frustumCulled = false; net.add(edges);
            const c = {
                id, kind, color: C(color), n: n ? V(...n) : V(0, 0, 1), t1: fr.t1, t2: fr.t2, netC: V(...netPos).multiplyScalar(GRID),
                walls, wallMat, edges, edgeMat, corners: Array.from({ length: 8 }, () => V()), open: 0, lit: 0, centre: V()
            };
            walls.userData.cell = c;
            cells.push(c); return c;
        }
        const dimCells = {};
        DIMS.forEach(d => { dimCells[d.id] = makeCell(d.id, COL[d.id] || '#B49BF8', SIDE[d.id], SIDE[d.id], 'dim'); });
        const core = makeCell('core', '#F1EEFB', null, [0, 0, 0], 'core');
        makeCell('anchor', '#9890BB', null, [0, -2, 0], 'anchor');
        const coreGlow = glow('#B49BF8', 160, 0); net.add(coreGlow);
        const CORE_WHITE = C('#F1EEFB');
        const brandAt = (() => { const a = C('#4CDCEF'), b = C('#B49BF8'), c = C('#E562A4'), t = new THREE.Color(); return u => { u = ((u % 1) + 1) % 1; return u < .33 ? t.copy(a).lerp(b, u / .33) : u < .66 ? t.copy(b).lerp(c, (u - .33) / .33) : t.copy(c).lerp(a, (u - .66) / .34); }; })();

        const F = V(), N = V(), tmp = V();
        function updateCell(c, f) {
            const k = 1 + c.open * .8, slide = c.open * 96;
            for (let i = 0; i < 8; i++) {
                const u = i & 4 ? 1 : -1, a = i & 2 ? 1 : -1, b = i & 1 ? 1 : -1;
                if (c.kind === 'dim') {
                    const s = u < 0 ? r : R;
                    F.copy(c.n).multiplyScalar(s).addScaledVector(c.t1, a * s).addScaledVector(c.t2, b * s);
                    N.copy(c.netC).addScaledVector(c.n, slide).addScaledVector(c.n, u * HS * k).addScaledVector(c.t1, a * HS * k).addScaledVector(c.t2, b * HS * k);
                } else {
                    const s = c.kind === 'anchor' ? R : r;
                    F.set(a * s, b * s, u * s);
                    N.copy(c.netC).add(tmp.set(a * HS, b * HS, u * HS));
                }
                c.corners[i].lerpVectors(F, N, f);
            }
            const pos = c.walls.geometry.attributes.position.array, al = c.walls.geometry.attributes.aA.array;
            let p = 0, q = 0;
            FACES.forEach((fc, fi) => {
                const alpha = fi === 1 && c.kind === 'dim' ? 1 - c.open * .96 : 1;
                [fc[0], fc[1], fc[2], fc[0], fc[2], fc[3]].forEach(ci => { const v = c.corners[ci]; pos[p++] = v.x; pos[p++] = v.y; pos[p++] = v.z; al[q++] = alpha; });
            });
            c.walls.geometry.attributes.position.needsUpdate = true; c.walls.geometry.attributes.aA.needsUpdate = true;
            c.walls.geometry.computeVertexNormals(); c.walls.geometry.computeBoundingSphere();
            const ep = c.edges.geometry.attributes.position.array;
            for (let e = 0; e < EDGES.length; e++) { const v = c.corners[EDGES[e]]; ep[e * 3] = v.x; ep[e * 3 + 1] = v.y; ep[e * 3 + 2] = v.z; }
            c.edges.geometry.attributes.position.needsUpdate = true;
            c.centre.set(0, 0, 0); c.corners.forEach(v => c.centre.add(v)); c.centre.multiplyScalar(1 / 8);
        }

        // ---- option crystals that float inside the open room ----
        const MAX_ITEMS = Math.max(8, ...DIMS.map(d => (d.options || []).length));
        const crystals = Array.from({ length: MAX_ITEMS }, () => {
            const mat = glassMaterial('#ffffff', 0);
            const m = new THREE.Mesh(new THREE.OctahedronGeometry(9, 0), mat); m.scale.set(1, 1.5, 1);
            const g = glow('#ffffff', 46, 0); m.add(g);
            m.visible = false; net.add(m);
            return { m, mat, g, on: 0, item: null };
        });

        // ---- labels ----
        const cellLabels = DIMS.map(d => {
            const n = el('div', 'lab', d.name); n.style.setProperty('--c', COL[d.id]); labelsEl.appendChild(n);
            return { cell: dimCells[d.id], el: n };
        });

        // the open room's items: options (or the three meaning steps)
        function roomItems(id) {
            const d = dimById(id);
            if (id !== 'meaning') return d.options.map(o => ({ title: o.title, on: sel[id].includes(o.id), act: () => toggle(d, o.id) }));
            const m = sel.meaning, M = DATA.meaningData, storyDone = !!(m.story.from && m.story.toward);
            const go = n => { mStep = n; render(); if (compact()) setSheet(true); };
            return [
                { title: m.world ? titleOf(M.world.options, m.world) : 'The World', on: !!m.world, act: () => go(1) },
                { title: storyDone ? m.story.from + ' → ' + m.story.toward : 'The Story', on: storyDone, act: () => { if (m.world) go(2); } },
                { title: m.magic ? titleOf(M.magic.options, m.magic) : 'The Magic', on: !!m.magic, act: () => { if (m.world && storyDone) go(3); } }
            ];
        }

        // ---- picking ----
        const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
        let down = null;
        function pick(e) {
            const rc = renderer.domElement.getBoundingClientRect();
            ndc.set((e.clientX - rc.left) / rc.width * 2 - 1, -(e.clientY - rc.top) / rc.height * 2 + 1);
            ray.setFromCamera(ndc, camera);
            const cr = ray.intersectObjects(crystals.filter(c => c.m.visible && c.on > .3).map(c => c.m), false)[0];
            if (cr) return { crystal: crystals.find(c => c.m === cr.object) };
            const hit = ray.intersectObjects(DIMS.map(d => dimCells[d.id].walls), false).find(h => h.object.userData.cell.id !== current);
            return hit ? { cell: hit.object.userData.cell } : null;
        }
        on(renderer.domElement, 'pointerdown', e => { down = [e.clientX, e.clientY]; });
        on(renderer.domElement, 'pointerup', e => {
            if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 6) return;
            down = null;
            const p = pick(e);
            if (!p) return;
            if (p.crystal && p.crystal.item) p.crystal.item.act();
            else if (p.cell) openDim(p.cell.id);
        });
        on(renderer.domElement, 'pointermove', e => { if (e.buttons || e.pointerType === 'touch') return; root.classList.toggle('hovering', !!pick(e)); });

        // ================= layout =================
        // the part of the screen the panels leave free for the tesseract
        function freeBand() {
            if (!compact()) return { top: 0, bottom: H, left: 300, right: 430 };
            const top = dimsEl.offsetTop + dimsEl.offsetHeight + 8;
            return { top, bottom: Math.max(top + 120, panel.offsetTop - 8), left: 0, right: 0 };
        }
        // camera distance that fits the tesseract (folded, or the unfolded net) into the free band
        function homeDist(b) {
            const t = Math.tan(camera.fov * Math.PI / 360);
            const bandH = Math.max(120, b.bottom - b.top), bandW = Math.max(200, W - b.left - b.right);
            const fit = !compact() ? 560 : mode === 'dim' ? (W < 640 ? 400 : 380) : 470;
            return Math.max(compact() ? 0 : 900, (fit + 40) * H / bandH / (2 * t), fit * W / bandW / (2 * t * camera.aspect));
        }
        let reframe = 0;   // seconds left to ease the camera distance to the framing for the current layout
        function resize() {
            const w = root.clientWidth, h = root.clientHeight;
            if (!w || !h) return;   // hidden (e.g. lesson module not shown yet)
            W = w; H = h;
            renderer.setSize(W, H); composer.setSize(W, H);
            camera.aspect = W / H; camera.updateProjectionMatrix();
            root.classList.toggle('te-compact', W < 1240);
            root.classList.toggle('te-phone', W < 640);
            const now = W < 640 ? 'phone' : W < 1240 ? 'tablet' : 'desktop';
            if (now !== layout) {
                const first = !layout;
                layout = now;
                if (first || now === 'desktop') {   // jump straight to the framing
                    camera.position.copy(CAM_DIR).multiplyScalar(homeDist(freeBand())); controls.target.copy(TARGET);
                }
                setSheet(now === 'desktop' ? false : mode !== 'intro');
                render();
            }
            controls.maxDistance = Math.max(2600, camera.position.length() * 1.6);
            reframe = Math.max(reframe, .4);
        }
        const ro = new ResizeObserver(resize);
        ro.observe(root);

        // ================= frame =================
        let foldT = 0, time = 0;
        const qTarget = new THREE.Quaternion(), eul = new THREE.Euler();
        const m1 = new THREE.Matrix4(), m2 = new THREE.Matrix4(), xA = V(), yA = V(), zA = V(), UP = V(0, 1, 0);
        // turn the net so `c` faces the camera, upright, seen a little from above and to the side
        // (never exactly head-on: edges pointing straight at the camera break the bloom pass on some GPUs)
        function faceCamera(c, out) {
            zA.copy(camera.position).sub(controls.target).normalize();
            xA.copy(UP).cross(zA).normalize();
            zA.addScaledVector(xA, -.16).addScaledVector(UP, .2).normalize();
            xA.copy(UP).cross(zA).normalize(); yA.copy(zA).cross(xA);
            m1.makeBasis(xA, yA, zA); m2.makeBasis(c.t1, c.t2, c.n).transpose();
            return out.setFromRotationMatrix(m1.multiply(m2));
        }
        const band = { top: 0, bottom: 1, left: 0, right: 0 };

        function frame(dtIn) {
            if (!W || !H) { resize(); if (!W) return; }
            const dt = Math.min(Math.max(dtIn || 0, 0), .05);
            time += dt;
            const ease = k => INSTANT ? 1 : 1 - Math.exp(-dt * k * (REDUCED ? 3 : 1));
            const open = mode === 'dim' ? dimCells[current] : null;
            foldT += ((open ? 1 : 0) - foldT) * ease(2.6);
            const f = smooth(0, 1, foldT);

            // orientation: the open room turns to face you; at rest the hypercube drifts
            if (open) faceCamera(open, qTarget);
            else {
                const spin = REDUCED ? 0 : 1;
                eul.set(.42 + Math.sin(time * .2) * .12 * spin, (time * (mode === 'blueprint' ? .45 : .16) + .6) * spin + (1 - spin) * .6, Math.sin(time * .13) * .08 * spin);
                qTarget.setFromEuler(eul);
            }
            net.quaternion.slerp(qTarget, open ? ease(3) : ease(1.6));

            const all = allDone();
            const bp = mode === 'blueprint' ? 1 : 0;
            cells.forEach(c => {
                c.open += ((c === open ? smooth(.55, .95, foldT) : 0) - c.open) * ease(4);
                const done = c.kind === 'dim' && isDone(c.id);
                c.lit += ((done ? 1 : 0) - c.lit) * ease(3);
                updateCell(c, f);
                let s, eo;
                if (c.kind === 'dim') {
                    const dimmed = open && c !== open ? .45 : 1;
                    s = (.16 + c.lit * .26 + (c === open ? .3 : 0) + bp * .1) * dimmed;
                    eo = (.35 + c.lit * .5 + (c === open ? .3 : 0)) * dimmed;
                } else if (c.kind === 'core') {
                    s = .14 + bp * (.55 + .15 * Math.sin(time * 2.4));
                    eo = .3 + bp * .6;
                    c.wallMat.uniforms.uColor.value.copy(bp ? brandAt(time * .12) : CORE_WHITE);
                    c.edgeMat.color.copy(c.wallMat.uniforms.uColor.value);
                } else { s = .03 * (1 - f) + .14 * f; eo = .28 + .12 * f; }
                c.wallMat.uniforms.uStrength.value = s;
                c.edgeMat.opacity = eo;
            });
            coreGlow.position.copy(core.centre);
            coreGlow.material.color.copy(brandAt(time * .12));
            coreGlow.material.opacity += ((bp ? .55 + .2 * Math.sin(time * 2.4) : all ? .2 : .04) - coreGlow.material.opacity) * ease(2);
            coreGlow.scale.setScalar(150 + bp * 60 * (1 + .1 * Math.sin(time * 2.4)));

            // framing: centre the tesseract in the space the panels leave free (eased while the sheet moves)
            const b = freeBand(), kb = ease(8);
            if (!band.bottom || band.bottom === 1) Object.assign(band, b);
            for (const key in b) band[key] += (b[key] - band[key]) * kb;
            if (reframe > 0) {
                reframe -= dt;
                const dist = camera.position.distanceTo(controls.target), want = homeDist(b);
                tmp.copy(camera.position).sub(controls.target).normalize().multiplyScalar(dist + (want - dist) * ease(6));
                camera.position.copy(controls.target).add(tmp);
            }
            controls.update();
            const shift = (band.left - band.right) / 2, offY = H / 2 - (band.top + band.bottom) / 2;
            if (Math.abs(shift) < .5 && Math.abs(offY) < .5) { if (camera.view && camera.view.enabled) camera.clearViewOffset(); }
            else camera.setViewOffset(W, H, -shift, offY, W, H);
            camera.updateMatrixWorld();
            net.updateMatrixWorld();

            // crystals inside the open room
            const items = open && open.open > .05 ? roomItems(open.id) : [];
            crystals.forEach((cr, i) => {
                const it = items[i];
                cr.item = it || null;
                cr.on += ((it ? open.open : 0) - cr.on) * ease(5);
                cr.m.visible = cr.on > .01;
                if (!cr.m.visible || !it) return;
                cr.hl = (cr.hl || 0) + ((i === hoverIdx ? 1 : 0) - (cr.hl || 0)) * ease(10);
                const n = items.length, k = 1 + open.open * .8;
                const ringR = HS * k * (n > 6 ? .66 : .58), ang = Math.PI / 2 - i / n * TAU;
                const cy = Math.sin(ang) * ringR * .82 + (REDUCED ? 0 : Math.sin(time * 1.3 + i) * 3);
                cr.m.position.copy(open.centre).addScaledVector(open.t1, Math.cos(ang) * ringR).addScaledVector(open.t2, cy).addScaledVector(open.n, -HS * k * .1);
                cr.m.quaternion.copy(net.quaternion).invert();
                cr.m.rotateY(time * (it.on ? 1.4 : .4) + i);
                cr.m.scale.set(1, 1.5, 1).multiplyScalar(1 + cr.hl * .35);
                const col = it.on || cr.hl > .5 ? open.color : CORE_WHITE;
                cr.mat.uniforms.uColor.value.copy(col);
                cr.mat.uniforms.uStrength.value = cr.on * ((it.on ? 1.3 : .45) + cr.hl * .9);
                cr.g.material.color.copy(col); cr.g.material.opacity = cr.on * ((it.on ? .55 : .12) + cr.hl * .4);
            });

            cellLabels.forEach(l => {
                const c = l.cell;
                if (c === open) { l.el.style.opacity = 0; return; }
                tmp.copy(c.centre); if (f < .5) tmp.multiplyScalar(1.35);
                net.localToWorld(tmp); tmp.project(camera);
                if (tmp.z > 1) { l.el.style.opacity = 0; return; }
                l.el.style.opacity = open ? .55 : .9;
                l.el.style.transform = `translate(${((tmp.x * .5 + .5) * W).toFixed(1)}px, ${((-tmp.y * .5 + .5) * H).toFixed(1)}px) translate(-50%, -50%)`;
            });
            composer.render();
        }

        function reset() { resetAll(); }

        function destroy() {
            clearTimeout(bpTimer);
            cleanups.forEach(fn => fn());
            ro.disconnect();
            controls.dispose();
            scene.traverse(obj => {
                if (obj.geometry) obj.geometry.dispose();
                if (obj.material) (Array.isArray(obj.material) ? obj.material : [obj.material]).forEach(m => m.dispose());
            });
            glowTex.dispose();
            if (composer.renderTarget1) composer.renderTarget1.dispose();
            if (composer.renderTarget2) composer.renderTarget2.dispose();
            renderer.dispose();
            if (renderer.forceContextLoss) renderer.forceContextLoss();
            renderer.domElement.remove();
            uiNodes.forEach(n => n.remove());
        }

        // ================= start (with optional test preview) =================
        const preview = qs.get('te-preview');
        if (preview === 'fill') {
            sel = { reality: ['virtual', 'biological'], sensory: ['visual', 'auditory', 'tactile'], presence: ['embodied'], states: ['somatic', 'emotional'], traits: ['somatic', 'relational'],
                meaning: { world: 'body', story: { from: 'numbness', toward: 'aliveness' }, magic: 'breath' } };
            wasAll = true; mode = 'blueprint';
        } else if (preview && dimById(preview)) {
            mode = 'dim'; current = preview;
            if (preview === 'meaning') { sel.meaning.world = 'body'; mStep = 2; }
        }
        render();
        resize();
        if (INSTANT && mode === 'dim') { foldT = 1; faceCamera(dimCells[current], net.quaternion); dimCells[current].open = 1; }
        return { frame, resize, reset, destroy };
    }

    // ------------------------------------------------------------------
    // ENGINE DEFINITION
    // ------------------------------------------------------------------
    window.SimulationEngines['TesseractExplorer'] = {
        name: 'Tesseract Explorer',
        showPlaybackControls: false,
        defaults: {},

        // The engine draws its own controls, so the host builds none.
        config: [],

        init: function (container, params, host) {
            this.host = host;
            this._destroyed = false;
            this._explorer = null;

            container.querySelectorAll(':scope > .te3d').forEach(n => n.remove());
            const root = el('div', 'te3d');
            root.setAttribute('role', 'region');
            root.setAttribute('aria-label', 'Tesseract Explorer: design the six dimensions of a cyberdelic experience');
            const status = el('div', 'te3d-status', 'Loading the tesseract…');
            root.appendChild(status);
            container.appendChild(root);
            if (getComputedStyle(container).position === 'static') container.style.position = 'relative';
            this._root = root;

            const DATA = (params && params.data && params.data.dimensions) ? params.data : window.TesseractExplorerData;
            if (!DATA) {
                console.error('[TesseractExplorer] TesseractExplorerData not found.');
                status.textContent = 'The explorer data could not be loaded.';
                status.classList.add('error');
                return;
            }
            const lite = (window.matchMedia('(pointer: coarse)').matches && Math.min(window.innerWidth, window.innerHeight) < 600);
            loadDeps().then(() => {
                if (this._destroyed) return;
                status.remove();
                this._explorer = createExplorer(root, DATA, { lite });
                console.log('[TesseractExplorer] 3D Unfolding Net initialized');
            }).catch(err => {
                console.error('[TesseractExplorer] Could not load three.js add-ons', err);
                status.textContent = 'The 3D view could not load. Check your connection and reload the page.';
                status.classList.add('error');
            });
        },

        // Host calls this every frame (dt in seconds)
        update: function (dt) {
            if (this._explorer) this._explorer.frame(dt);
        },

        resize: function () {
            if (this._explorer) this._explorer.resize();
        },

        reset: function () {
            if (this._explorer) this._explorer.reset();
        },

        destroy: function () {
            this._destroyed = true;
            if (this._explorer) this._explorer.destroy();
            if (this._root) this._root.remove();
            this._explorer = null;
            this._root = null;
        }
    };
})();
