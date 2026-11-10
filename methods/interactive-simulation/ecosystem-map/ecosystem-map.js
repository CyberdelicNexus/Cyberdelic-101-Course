/**
 * Ecosystem Map - Simulation Engine (3D "Woven Loom")
 * Registers itself to window.SimulationEngines['EcosystemMap'].
 *
 * A circular loom. Each of the 8 actors is a spool of coloured thread on the frame, its key
 * players are bobbins just outside, and every connection is a thread woven across the loom.
 * Each spool also feeds the woven sheet in the middle, with the word CYBERDELICS stitched in:
 * the shared field they make together.
 *   Opportunity ripples pull threads taut and gold; each actor reached grows its own weave
 *   pattern in its colour, and the word fills with those colours.
 *   Constraint ripples let threads go slack and fray; the sheet sags and tears in that actor's
 *   section and the word's stitches break.
 *
 * - Content comes from ecosystem-map-data.js (window.EcosystemMapData).
 * - The engine draws its own controls (ripple menu, step log, actor panel), so `config` is empty.
 * - A standalone simulation: no completion gate. The "x / 8 explored" pill is only a guide.
 * - three.js add-ons (OrbitControls, bloom) are loaded on demand.
 * - The previous 2D SVG version lives in ecosystem-map-2d.js.
 */
(function () {
    'use strict';

    window.SimulationEngines = window.SimulationEngines || {};

    // Actors mapped onto the Cyberdelic Nexus palette
    const COLORS = {
        tech: '#4CDCEF', knowledge: '#7E8BF5', clinical: '#B49BF8', facilitators: '#E562A4',
        users: '#DDB049', economic: '#F29B5C', regulatory: '#9FB4D9', educators: '#5FDFA6'
    };

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
        if (window.__cnEcoDeps) return window.__cnEcoDeps;
        window.__cnEcoDeps = (async () => {
            if (!window.THREE) await loadScript(THREE_CDN);
            for (const [name, path] of DEPS) {
                if (!window.THREE[name]) await loadScript(EXAMPLES + path);
            }
        })();
        window.__cnEcoDeps.catch(() => { window.__cnEcoDeps = null; });   // allow a retry on the next init
        return window.__cnEcoDeps;
    }

    const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text !== undefined) n.textContent = text; return n; };

    // ------------------------------------------------------------------
    // Stage: renderer, camera, bloom, backdrop, UI (ripple menu, step log, actor panel,
    // exploration tracker, labels) and the ripple sequencer
    // ------------------------------------------------------------------
    function createStage(stage, opts) {
        const THREE = window.THREE;
        const DATA = window.EcosystemMapData;
        const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        const INSTANT = reduceMotion;   // reduced motion: cut straight to each view
        const cleanups = [];
        const on = (target, type, fn, o) => { target.addEventListener(type, fn, o); cleanups.push(() => target.removeEventListener(type, fn, o)); };

        // ---------- renderer / camera / bloom ----------
        const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, opts.lite ? 1.5 : 2));
        renderer.setClearColor(0x000000, 1);
        renderer.domElement.className = 'em3d-canvas';
        stage.prepend(renderer.domElement);
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(40, 1, 1, 9000);
        const HOME_POS = new THREE.Vector3(...opts.home.pos), HOME_TARGET = new THREE.Vector3(...opts.home.target);
        camera.position.copy(HOME_POS);
        const controls = new THREE.OrbitControls(camera, renderer.domElement);
        controls.target.copy(HOME_TARGET);
        Object.assign(controls, { enableDamping: true, dampingFactor: .06, enablePan: false, minDistance: 60, maxDistance: 3600, rotateSpeed: .5, zoomSpeed: .7, maxPolarAngle: Math.PI * .47 });
        // Inside a scrolling lesson page, plain wheel scrolls the page and Ctrl/Cmd + wheel zooms.
        // On a full-screen page (nothing to scroll), plain wheel zooms.
        const pageScrolls = () => { const se = document.scrollingElement || document.documentElement; return se.scrollHeight > window.innerHeight + 4; };
        on(renderer.domElement, 'wheel', e => { controls.enableZoom = !pageScrolls() || e.ctrlKey || e.metaKey; }, { capture: true, passive: true });
        const composer = new THREE.EffectComposer(renderer);
        composer.addPass(new THREE.RenderPass(scene, camera));
        if (!opts.lite) composer.addPass(new THREE.UnrealBloomPass(new THREE.Vector2(256, 256), .8, .55, .28));

        // ---------- backdrop ----------
        scene.add(new THREE.Mesh(new THREE.SphereGeometry(4000, 32, 24), new THREE.ShaderMaterial({
            side: THREE.BackSide, depthWrite: false,
            vertexShader: 'varying vec3 d; void main(){ d = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
            fragmentShader: `varying vec3 d; void main(){ vec3 v = normalize(d);
                float a = pow(max(dot(v, normalize(vec3(-.6,.35,-.7))),0.),2.5);
                float b = pow(max(dot(v, normalize(vec3(.75,-.2,-.6))),0.),2.5);
                float c = pow(max(dot(v, normalize(vec3(0.,.9,-.3))),0.),2.);
                gl_FragColor = vec4((vec3(.29,.17,.58)*a + vec3(.36,.16,.43)*b + vec3(.106,.227,.47)*c)*.38, 1.); }`
        })));
        {
            const n = 1600, pos = new Float32Array(n * 3);
            for (let i = 0; i < n; i++) {
                const u = Math.random() * .95 + .05, th = Math.random() * 6.283, r = Math.sqrt(1 - u * u), R = 1800 + Math.random() * 1500;
                pos.set([r * Math.cos(th) * R, u * R, r * Math.sin(th) * R], i * 3);
            }
            const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
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
        const dotTex = (() => {
            const c = document.createElement('canvas'); c.width = c.height = 64;
            const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
            gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.35, 'rgba(255,255,255,.8)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
            g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
            return new THREE.CanvasTexture(c);
        })();
        const additive = { transparent: true, blending: THREE.AdditiveBlending, depthWrite: false };
        function glow(color, size, opacity = .5) {
            const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color, opacity, ...additive }));
            s.scale.setScalar(size); return s;
        }
        // Dark orb with a colour rim (fresnel): the house "obsidian plate" look
        function orbMaterial(color) {
            return new THREE.ShaderMaterial({
                uniforms: { uColor: { value: new THREE.Color(color) }, uBoost: { value: 0 } },
                vertexShader: 'varying vec3 n; varying vec3 v; void main(){ n = normalize(normalMatrix*normal); vec4 mv = modelViewMatrix*vec4(position,1.); v = -mv.xyz; gl_Position = projectionMatrix*mv; }',
                fragmentShader: `uniform vec3 uColor; uniform float uBoost; varying vec3 n; varying vec3 v;
                    void main(){ float f = pow(1. - abs(dot(normalize(n), normalize(v))), 2.2);
                    gl_FragColor = vec4(vec3(.035,.025,.07) + uColor * (f * (1.3 + uBoost * 1.5) + .06 + uBoost * .3), 1.); }`
            });
        }
        // See-through glowing glass (rim light only, additive)
        function glassMaterial(color, strength = 1) {
            return new THREE.ShaderMaterial({
                uniforms: { uColor: { value: new THREE.Color(color) }, uStrength: { value: strength } },
                vertexShader: 'varying vec3 n; varying vec3 v; void main(){ n = normalize(normalMatrix*normal); vec4 mv = modelViewMatrix*vec4(position,1.); v = -mv.xyz; gl_Position = projectionMatrix*mv; }',
                fragmentShader: `uniform vec3 uColor; uniform float uStrength; varying vec3 n; varying vec3 v;
                    void main(){ float f = pow(1. - abs(dot(normalize(n), normalize(v))), 2.6);
                    gl_FragColor = vec4(uColor * (f * .9 + .04) * uStrength, 1.); }`,
                side: THREE.DoubleSide, ...additive
            });
        }
        // A cloud of glowing dots (sparkles, spores, snow...)
        function points(n, color, size, opacity = .9) {
            const g = new THREE.BufferGeometry();
            g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
            const mat = new THREE.PointsMaterial({ size, color, map: dotTex, opacity, ...additive });
            const p = new THREE.Points(g, mat); p.frustumCulled = false;
            return p;
        }

        // ---------- UI ----------
        const head = el('header', 'head');
        head.append(el('span', 'eb', opts.eyebrow), el('h1', null, opts.title), el('span', 'bar'), el('p', null, opts.sub));
        const labels = el('div', 'labels');
        const explored = el('div', 'explored glass'), dots = el('div', 'dots'), expTxt = el('span');
        explored.append(dots, expTxt);
        const deck = el('aside', 'rmenu glass'), seg = el('div', 'seg'), chips = el('div', 'list'), nav = el('div', 'nav');
        deck.setAttribute('aria-label', 'Ripple scenarios');
        [['opp', 'Opportunity'], ['con', 'Constraint']].forEach(([k, t]) => {
            const b = el('button', null, t); b.type = 'button'; b.dataset.k = k;
            b.addEventListener('click', () => setDeck(k)); seg.appendChild(b);
        });
        const prevB = el('button', null, '← Prev'), nextB = el('button', null, 'Next →'), navTxt = el('span');
        prevB.type = nextB.type = 'button';
        prevB.addEventListener('click', () => stepChain(-1)); nextB.addEventListener('click', () => stepChain(1));
        nav.append(prevB, navTxt, nextB);
        // On tablet / phone the menu shrinks to a bar while a ripple plays, so the steps and the loom
        // both stay in view; "Show list" brings the menu back (and hides the steps until it shrinks again)
        const rhead = el('div', 'rhead'), curTitle = el('span', 'cur'), tog = el('button', 'tog', 'Show list');
        tog.type = 'button'; tog.setAttribute('aria-expanded', 'true');
        tog.addEventListener('click', () => {
            setMenuMin(!stage.classList.contains('em3d--menu-min'));
            if (state.open === null) flyTo(homePos(state.ripple ? 1.1 : 1), HOME_TARGET);   // reframe for the new layout
        });
        rhead.append(el('span', 'lbl', 'Ripples'), curTitle, tog);
        deck.append(rhead, seg, chips, nav);
        function setMenuMin(v) {
            stage.classList.toggle('em3d--menu-min', v);
            tog.setAttribute('aria-expanded', String(!v));
            tog.textContent = v ? 'Show list' : 'Hide list';
        }
        const caption = el('aside', 'steplog glass'), stepList = el('ol');
        caption.setAttribute('aria-label', 'Ripple steps'); caption.setAttribute('aria-live', 'polite');
        const panel = el('aside', 'panel');
        panel.setAttribute('aria-live', 'polite');
        stage.append(labels, head, explored, caption, deck, panel);
        // scroll a list so an item is visible, without scrolling the lesson page around it
        function reveal(list, item, smooth) {
            const top = item.offsetTop - list.offsetTop, bottom = top + item.offsetHeight;
            let to = null;
            if (top < list.scrollTop) to = top;
            else if (bottom > list.scrollTop + list.clientHeight) to = bottom - list.clientHeight;
            if (to !== null) list.scrollTo({ top: to, behavior: smooth && !INSTANT ? 'smooth' : 'auto' });
        }

        const NODES = DATA.nodes, byId = id => NODES.find(n => n.id === id);
        const nameOf = id => byId(id).label.replace(/\n/g, ' ').replace(/\b\w+/g, w => w[0] + w.slice(1).toLowerCase());
        const kindOf = chain => /constraint/.test(chain.id) ? 'con' : 'opp';
        const state = { open: null, visited: new Set(), deck: 'opp', ripple: null, time: 0 };
        const frameFns = [], pickables = [], actors = {};
        const KIND = { opp: '#5FDFA6', con: '#FF5C72' };

        NODES.forEach(n => { const d = el('i'); d.style.setProperty('--c', COLORS[n.id]); d.title = nameOf(n.id); dots.appendChild(d); });
        function updateExplored() {
            [...dots.children].forEach((d, i) => d.classList.toggle('on', state.visited.has(NODES[i].id)));
            const all = state.visited.size === NODES.length;
            expTxt.textContent = all ? 'All 8 explored ✓' : state.visited.size + ' / 8 explored';
            explored.classList.toggle('done', all);
        }
        updateExplored();

        // the ripple menu: one list per kind; the selected ripple shows its full description
        let sel = 0;
        const deckList = () => DATA.rippleChains.filter(c => kindOf(c) === state.deck);
        function setDeck(k) {
            state.deck = k; sel = 0;
            seg.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.k === k)));
            chips.replaceChildren(...deckList().map((c, i) => {
                const b = el('button', 'item'); b.type = 'button';
                const dot = el('i'); dot.style.setProperty('--c', COLORS[c.startNode]);
                b.append(dot, el('span', null, c.title), el('small', null, c.description));
                b.addEventListener('click', () => { sel = i; playChain(c); });
                return b;
            }));
            markSel();
        }
        function markSel() {
            const items = [...chips.children];
            items.forEach((b, i) => b.classList.toggle('on', i === sel));
            navTxt.textContent = (sel + 1) + ' / ' + items.length;
            if (items[sel]) reveal(chips, items[sel]);
        }
        function stepChain(d) {
            const list = deckList(); sel = (sel + d + list.length) % list.length;
            playChain(list[sel]);
        }
        setDeck('opp');

        // ---------- actor panel ----------
        function openActor(id, fly = true) {
            const n = byId(id), c = COLORS[id];
            state.open = id;
            state.visited.add(id); updateExplored();
            if (actors[id] && actors[id].label) actors[id].label.el.classList.add('visited');
            panel.style.setProperty('--c', c);
            const close = el('button', 'close', '✕'); close.type = 'button'; close.setAttribute('aria-label', 'Close'); close.addEventListener('click', home);
            const players = el('ul');
            n.keyPlayers.forEach(p => { const li = el('li'); li.append(el('b', null, p.name), document.createTextNode(p.detail)); players.appendChild(li); });
            const cc = el('div', 'cc'), ch = el('div', 'c'), op = el('div', 'o');
            ch.append(el('b', null, 'Challenge'), document.createTextNode(n.challenge));
            op.append(el('b', null, 'Opportunity'), document.createTextNode(n.opportunity));
            cc.append(ch, op);
            const links = el('div', 'links');
            n.connections.forEach(cid => {
                const b = el('button'); b.type = 'button'; const d = el('i'); d.style.setProperty('--c', COLORS[cid]);
                b.append(d, document.createTextNode(nameOf(cid)));
                const desc = DATA.connectionDescriptions[id + '→' + cid] || DATA.connectionDescriptions[cid + '→' + id];
                if (desc) b.title = desc;
                b.addEventListener('click', () => openActor(cid));
                links.appendChild(b);
            });
            const trace = el('div', 'trace');
            DATA.rippleChains.filter(ch2 => ch2.startNode === id).forEach(chain => {
                const b = el('button'); b.type = 'button'; const k = kindOf(chain);
                const sm = el('small', null, k === 'opp' ? 'Opportunity' : 'Constraint'); sm.style.color = KIND[k];
                b.append(document.createTextNode('▶ ' + chain.title), sm);
                b.addEventListener('click', () => playChain(chain));
                trace.appendChild(b);
            });
            panel.replaceChildren(close, el('span', 'eb', n.subtitle), el('h2', null, nameOf(id)), el('span', 'bar'), el('p', null, n.role),
                el('h3', null, 'Key players'), players, cc, el('p', 'rip', '⚡ ' + n.ripple), el('h3', null, 'Connected to'), links,
                el('h3', null, 'Trace a ripple from here'), trace, actorNav(id));
            panel.scrollTop = 0;
            panel.classList.add('open'); stage.classList.add('zoomed');
            if (fly) focusActor(id);
        }
        // previous / next actor, going round the ecosystem
        const ORDER = [...NODES].sort((a, b) => a.angle - b.angle).map(n => n.id);
        function actorNav(id) {
            const i = ORDER.indexOf(id), pv = ORDER[(i - 1 + ORDER.length) % ORDER.length], nx = ORDER[(i + 1) % ORDER.length];
            const row = el('div', 'pn'), b1 = el('button', null, '← ' + nameOf(pv)), b2 = el('button', null, nameOf(nx) + ' →');
            b1.type = b2.type = 'button';
            b1.addEventListener('click', () => openActor(pv)); b2.addEventListener('click', () => openActor(nx));
            row.append(b1, b2); return row;
        }
        function home() {
            state.open = null;
            panel.classList.remove('open'); stage.classList.remove('zoomed');
            flyTo(homePos(), HOME_TARGET);
        }
        // the home view, pulled back far enough that the whole loom fits the width (portrait phones)
        const HOME_FIT_W = 980;   // world width to keep in view: loom, bobbins and their labels
        const HOME_FIT_H = 880;   // world height to keep in view on phones: the loom ring and its bobbins
        // On narrow screens the panels stack top and bottom; this is the strip of screen left for the loom
        function freeBand() {
            if (!W || W >= 900) return { y0: 0, y1: H };
            const rippling = !!state.ripple, min = stage.classList.contains('em3d--menu-min');
            const y0 = rippling ? 12 : explored.offsetTop + explored.offsetHeight + 10;
            const y1 = (rippling && min ? caption.offsetTop : deck.offsetTop) - 10;
            return y1 - y0 > 120 ? { y0, y1 } : { y0: 0, y1: H };
        }
        function homePos(extra = 1) {
            const off = HOME_POS.clone().sub(HOME_TARGET), base = off.length(), tanV = Math.tan(camera.fov * Math.PI / 360);
            let need = 0;
            if (W && H) {
                const band = freeBand();
                need = Math.max((HOME_FIT_W / 2) / (tanV * (W / H)), W < 900 ? (HOME_FIT_H / 2) / tanV * (H / (band.y1 - band.y0)) : 0);
            }
            return HOME_TARGET.clone().add(off.setLength(Math.max(base, need) * extra));
        }

        // ---------- camera ----------
        let flight = null;
        function flyTo(pos, target, dur = 1.3) {
            if (INSTANT) dur = .001;
            flight = { p0: camera.position.clone(), p1: pos.clone(), t0: controls.target.clone(), t1: target.clone(), t: 0, dur };
        }
        // frame the actor in the space left of the panel, seen from the home direction
        function focusActor(id) {
            const a = actors[id]; if (!a) return;
            const dir = HOME_POS.clone().sub(HOME_TARGET).normalize();
            const right = new THREE.Vector3(0, 1, 0).cross(dir).normalize();
            const panelPx = W > 900 ? Math.min(380, W - 48) + 48 : 0;
            const upp = 2 * a.dist * Math.tan(camera.fov * Math.PI / 360) / H;
            const shift = right.multiplyScalar(panelPx / 2 * upp);
            const target = a.focus.clone().add(shift);
            flyTo(target.clone().add(dir.multiplyScalar(a.dist)), target);
        }

        // ---------- labels ----------
        const labelList = [];
        const tmp = new THREE.Vector3();
        function addLabel(obj, text, color, onClick, offsetPx = 18, cls = '') {
            const n = el('div', 'lab ' + cls, text);
            n.style.setProperty('--c', color || '#B49BF8');
            if (onClick) {
                n.addEventListener('click', onClick);
                n.setAttribute('role', 'button'); n.tabIndex = 0;
                n.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } });
            }
            labels.appendChild(n);
            const item = { obj, el: n, offsetPx, side: cls.includes('small') };
            labelList.push(item);
            return item;
        }

        // ---------- ripple sequencer ----------
        const comet = glow(0xffffff, 46, .95), trail = Array.from({ length: 18 }, (_, k) => glow(0xffffff, 28 * (1 - k / 18) + 6, .55 * (1 - k / 18)));
        [comet, ...trail].forEach(s => { s.visible = false; scene.add(s); });
        const STEP_T = 2.2, HOLD_T = 1.6;
        // the step log: the ripple's intro, then one card per step that stays so it can be read back
        function logStart(chain, kind) {
            caption.style.setProperty('--k', KIND[kind]);
            const x = el('button', 'x', '✕'); x.type = 'button'; x.setAttribute('aria-label', 'Clear ripple'); x.addEventListener('click', clearRipple);
            stepList.replaceChildren();
            caption.replaceChildren(x, el('span', 'eb', kind === 'opp' ? 'Opportunity ripple' : 'Constraint ripple'), el('h4', null, chain.title),
                el('div', 'route', 'Starts at ' + nameOf(chain.startNode) + '  ·  ' + chain.steps.length + ' steps'), el('p', 'desc', chain.description), stepList);
            caption.classList.add('show');
        }
        function logStep(i, s, total) {
            [...stepList.children].forEach(li => li.classList.remove('now'));
            const li = el('li', 'now'), n = el('span', 'n');
            n.append(el('span', null, 'Step ' + (i + 1)), el('span', null, (i + 1) + ' / ' + total));
            li.append(n, el('span', 'rt', nameOf(s.from) + ' → ' + nameOf(s.to)), el('p', null, s.label));
            stepList.appendChild(li);
            reveal(stepList, li, true);
        }
        function logDone(kind) {
            [...stepList.children].forEach(li => li.classList.remove('now'));
            const li = el('li', 'sum'), n = el('span', 'n');
            n.append(el('span', null, 'Result'));
            li.append(n, el('p', null, kind === 'opp' ? 'One change spread through the whole ecosystem.' : 'One weakness spread, and fed back on itself.'));
            stepList.appendChild(li);
            reveal(stepList, li, true);
        }
        function playChain(chain) {
            if (state.open !== null) { state.open = null; panel.classList.remove('open'); stage.classList.remove('zoomed'); }
            if (api.clearEffects) api.clearEffects();
            const kind = kindOf(chain);
            curTitle.textContent = chain.title;
            stage.classList.add('em3d--rippling');
            if (W < 1100) setMenuMin(true);
            if (state.deck !== kind) setDeck(kind);
            sel = Math.max(0, deckList().indexOf(chain)); markSel();
            state.ripple = { chain, kind, i: -1, phase: 'intro', t: 0, curve: null };
            if (api.affect) api.affect(chain.startNode, kind, 'source');
            logStart(chain, kind);
            flyTo(homePos(1.1), HOME_TARGET);   // step back a little to make room for the log
        }
        function clearRipple() {
            state.ripple = null;
            caption.classList.remove('show');
            [comet, ...trail].forEach(s => { s.visible = false; });
            stage.classList.remove('em3d--rippling');
            setMenuMin(false);
            if (state.open === null) flyTo(homePos(), HOME_TARGET);
            if (api.clearEffects) api.clearEffects();
        }
        const hist = [];
        function tickRipple(dt) {
            const r = state.ripple; if (!r) return;
            r.t += dt;
            const steps = r.chain.steps;
            if ((r.phase === 'intro' && r.t > 1.8) || (r.phase === 'hold' && r.t > HOLD_T)) {
                r.i++; r.t = 0;
                if (r.i >= steps.length) {
                    r.phase = 'done';
                    [comet, ...trail].forEach(s => { s.visible = false; });
                    logDone(r.kind);
                    return;
                }
                const s = steps[r.i];
                r.phase = 'travel'; r.curve = api.curveBetween(s.from, s.to); hist.length = 0;
                logStep(r.i, s, steps.length);
                const col = new THREE.Color(KIND[r.kind]);
                comet.material.color.set(0xffffff); trail.forEach(t => t.material.color.copy(col));
            }
            if (r.phase === 'travel') {
                const u = Math.min(1, r.t / STEP_T), e = u < .5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
                r.curve.getPointAt(e, comet.position); comet.visible = true;
                hist.unshift(comet.position.clone()); if (hist.length > trail.length * 2) hist.pop();
                trail.forEach((s, k) => { const h = hist[Math.min(hist.length - 1, k * 2)]; s.visible = !!h; if (h) s.position.copy(h); });
                if (api.travel) api.travel(steps[r.i].from, steps[r.i].to, e, r.kind);
                if (u >= 1) { r.phase = 'hold'; r.t = 0; if (api.affect) api.affect(steps[r.i].to, r.kind, 'hit'); }
            }
        }

        // ---------- picking ----------
        const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
        function pick(e) {
            const rc = renderer.domElement.getBoundingClientRect();
            ndc.set((e.clientX - rc.left) / rc.width * 2 - 1, -(e.clientY - rc.top) / rc.height * 2 + 1);
            ray.setFromCamera(ndc, camera);
            const hit = ray.intersectObjects(pickables.map(p => p.mesh), false)[0];
            return hit ? pickables.find(p => p.mesh === hit.object).id : null;
        }
        let down = null;
        on(renderer.domElement, 'pointerdown', e => { down = [e.clientX, e.clientY]; });
        on(renderer.domElement, 'pointerup', e => {
            if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 5) { down = null; return; }
            down = null;
            const id = pick(e);
            if (id) openActor(id); else if (state.open !== null) home();
        });
        on(renderer.domElement, 'pointermove', e => stage.classList.toggle('hovering', !!pick(e)));
        // Escape closes the panel (or clears a ripple), only while the pointer or focus is inside the simulation
        let pointerInside = false;
        on(stage, 'pointerenter', () => { pointerInside = true; });
        on(stage, 'pointerleave', () => { pointerInside = false; });
        on(window, 'keydown', e => {
            if (e.key !== 'Escape' || (!pointerInside && !stage.contains(document.activeElement))) return;
            if (state.open !== null) home(); else if (state.ripple) clearRipple();
        });

        // ---------- resize + loop ----------
        let W = 0, H = 0;
        function resize() {
            const w = stage.clientWidth, h = stage.clientHeight;
            if (!w || !h) return;   // hidden (e.g. lesson module not shown yet)
            const changed = w !== W || h !== H;
            W = w; H = h;
            renderer.setSize(W, H); composer.setSize(W, H);
            camera.aspect = W / H; camera.updateProjectionMatrix();
            stage.classList.toggle('em3d--compact', W < 1100);
            stage.classList.toggle('em3d--narrow', W < 900);
            stage.classList.toggle('em3d--phone', W < 600);
            if (changed && state.open !== null) focusActor(state.open);
            else if (changed && !flight) flyTo(homePos(state.ripple ? 1.1 : 1), HOME_TARGET, .001);   // keep the loom framed
            if (W >= 1100) setMenuMin(false);
        }
        // Slide the picture so the loom sits in the space the panels leave: right of the menu on wide
        // screens, in the band between the top and bottom panels on narrow ones
        let viewShift = 0, viewShiftY = 0;
        function applyShift(dt) {
            const want = W > 900 && state.open === null ? (state.ripple && W > 1100 ? 318 : 162) : 0;
            let wantY = 0;
            if (W < 900 && state.open === null) { const b = freeBand(); wantY = (b.y0 + b.y1) / 2 - H / 2; }
            const k = INSTANT ? 1 : Math.min(1, dt * 4);
            viewShift += (want - viewShift) * k; viewShiftY += (wantY - viewShiftY) * k;
            if (Math.abs(viewShift) < .5 && Math.abs(viewShiftY) < .5) { if (camera.view && camera.view.enabled) camera.clearViewOffset(); }
            else camera.setViewOffset(W, H, -viewShift, -viewShiftY, W, H);
        }
        const ro = new ResizeObserver(resize);
        ro.observe(stage);
        resize();
        function frame(dtIn) {
            if (!W || !H) { resize(); if (!W) return; }
            const dt = Math.min(Math.max(dtIn || 0, 0), .05);
            state.time += dt;
            tickRipple(dt);
            frameFns.forEach(fn => fn(dt, state.time));
            if (flight) {
                flight.t += dt / flight.dur;
                const k = 1 - Math.pow(1 - Math.min(1, flight.t), 4);
                camera.position.lerpVectors(flight.p0, flight.p1, k);
                controls.target.lerpVectors(flight.t0, flight.t1, k);
                if (flight.t >= 1) flight = null;
            }
            controls.update();
            applyShift(dt);
            // the open actor's name is in the panel; hide its 3D label so its key players can be read
            Object.entries(actors).forEach(([id, a]) => a.label.el.classList.toggle('gone', state.open === id));
            labelList.forEach(l => {
                l.obj.getWorldPosition(tmp); tmp.project(camera);
                if (tmp.z > 1) { l.el.style.visibility = 'hidden'; return; }
                l.el.style.visibility = '';
                const x = (tmp.x * .5 + .5) * W, y = (-tmp.y * .5 + .5) * H;
                l.el.style.transform = l.side ? (l.flip ? `translate(${(x - 12).toFixed(1)}px, ${(y - 10).toFixed(1)}px) translateX(-100%)` : `translate(${(x + 12).toFixed(1)}px, ${(y - 10).toFixed(1)}px)`)
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
                if (obj.material) (Array.isArray(obj.material) ? obj.material : [obj.material]).forEach(m => {
                    if (m.map) m.map.dispose();
                    if (m.uniforms) Object.values(m.uniforms).forEach(u => { if (u.value && u.value.isTexture) u.value.dispose(); });
                    m.dispose();
                });
            });
            glowTex.dispose(); dotTex.dispose();
            if (composer.renderTarget1) composer.renderTarget1.dispose();
            if (composer.renderTarget2) composer.renderTarget2.dispose();
            renderer.dispose();
            if (renderer.forceContextLoss) renderer.forceContextLoss();
            renderer.domElement.remove();
            [labels, head, explored, caption, deck, panel].forEach(n => n.remove());
        }

        const api = {
            THREE, scene, camera, controls, state, DATA, COLORS, KIND, NODES, byId, nameOf,
            glow, orbMaterial, glassMaterial, points, additive, dotTex, addLabel, openActor, home, playChain,
            onFrame: fn => frameFns.push(fn),
            frame, resize, destroy, clearRipple,
            // register an actor: anchor (label), focus point + distance (close-up), meshes that open it
            actor(id, a) {
                actors[id] = a;
                a.label = addLabel(a.anchor, byId(id).label, COLORS[id], () => openActor(id), 14);
                (a.picks || []).forEach(m => pickables.push({ mesh: m, id }));
            },
            start() { resize(); }
        };
        return api;
    }

    // ------------------------------------------------------------------
    // The woven loom, built on the stage
    // ------------------------------------------------------------------
    function buildLoom(M) {
        const { THREE, scene, COLORS, NODES } = M;
        M.KIND.opp = '#F7D774'; M.KIND.con = '#FF5C72';
        const C = h => new THREE.Color(h), TAU = Math.PI * 2, V = (x, y, z) => new THREE.Vector3(x, y, z), R = 330;
        const rnd = (a, b) => a + Math.random() * (b - a);
        const angOf = n => (n.angle + 22.5) * Math.PI / 180;
        const posOf = n => V(Math.cos(angOf(n)) * R, -Math.sin(angOf(n)) * R, 0);
        const GOLD = C('#F7D774'), FRAY = C('#FF5C72');

        // ================= the loom frame =================
        const frameMat = M.orbMaterial('#7C4FF0');
        scene.add(new THREE.Mesh(new THREE.TorusGeometry(R, 7, 16, 200), frameMat));
        const outer = new THREE.Mesh(new THREE.TorusGeometry(R + 26, 1.4, 8, 200), new THREE.MeshBasicMaterial({ color: 0xB49BF8, opacity: .35, ...M.additive }));
        scene.add(outer);
        {   // stand
            const leg = (s) => { const l = new THREE.Mesh(new THREE.CylinderGeometry(5, 7, 260, 10), frameMat); l.position.set(s * 150, -R - 60, -10); l.rotation.z = s * .35; scene.add(l); };
            leg(-1); leg(1);
            const foot = new THREE.Mesh(new THREE.BoxGeometry(520, 8, 60), frameMat); foot.position.set(0, -R - 185, -10); scene.add(foot);
        }
        const RS = 205;   // radius of the woven sheet in the middle
        {   // warp strings run from the frame in to the sheet's edge
            const warpMat = new THREE.LineBasicMaterial({ color: 0x9a86e0, opacity: .12, ...M.additive });
            for (let i = 0; i < 72; i++) { const a = i / 72 * TAU; scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([V(Math.cos(a) * (RS + 6), Math.sin(a) * (RS + 6), 0), V(Math.cos(a) * (R - 8), Math.sin(a) * (R - 8), 0)]), warpMat)); }
        }

        // ================= spools (actors) and bobbins (key players) =================
        // a spool lies along the frame (axis tangent to the ring), so you see its wound thread side-on
        function spool(color, r, len) {
            const g = new THREE.Group(), inner = new THREE.Group(); g.add(inner);
            const wound = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 28), M.orbMaterial(color)); inner.add(wound);
            const lineMat = new THREE.MeshBasicMaterial({ color, opacity: .55, ...M.additive });
            for (let i = 0; i < 8; i++) { const t = new THREE.Mesh(new THREE.TorusGeometry(r + .3, .35, 4, 32), lineMat); t.rotation.x = Math.PI / 2; t.position.y = -len / 2 + (i + .5) * len / 8; inner.add(t); }
            for (let i = 0; i < 6; i++) { const a = i / 6 * TAU, st = new THREE.Mesh(new THREE.BoxGeometry(1.2, len, 1.2), lineMat); st.position.set(Math.cos(a) * (r + .4), 0, Math.sin(a) * (r + .4)); inner.add(st); }   // stripes show the spin
            [-1, 1].forEach(s2 => { const f = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.45, r * 1.45, 3, 28), M.orbMaterial(color)); f.position.y = s2 * (len / 2 + 1.5); inner.add(f); });
            return { g, inner, wound };
        }
        const actors = {};
        NODES.forEach(n => {
            const color = COLORS[n.id], p = posOf(n), a = angOf(n), out = V(Math.cos(a), -Math.sin(a), 0);
            const root = new THREE.Group(); root.position.copy(p); scene.add(root);
            const sp = spool(color, 22, 40); sp.g.rotation.z = -a; root.add(sp.g);
            const halo = M.glow(color, 130, .3); root.add(halo);
            // bobbins hang just outside the frame
            const players = n.keyPlayers.map((kp, k) => {
                const da = (k - (n.keyPlayers.length - 1) / 2) * .13, ba = a + da;
                const bp = V(Math.cos(ba) * (R + 78), -Math.sin(ba) * (R + 78), 0).sub(p);
                const b = spool(color, 7, 16); b.g.position.copy(bp); b.g.rotation.z = -ba; root.add(b.g);
                root.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([V(0, 0, 0), bp]), new THREE.LineBasicMaterial({ color, opacity: .5, ...M.additive })));
                // name only, set out past the bobbin so it never sits on top of one (details live in the panel)
                const tag = new THREE.Object3D(); tag.position.copy(bp).add(out.clone().multiplyScalar(22)); root.add(tag);
                const lab = M.addLabel(tag, kp.name, color, null, 0, 'small gone');
                lab.flip = out.x < -.2;   // on the left of the loom the tag reads outward, to the left
                return { b, lab };
            });
            // the loose end that unravels under a constraint
            const loose = new THREE.Line(new THREE.BufferGeometry().setFromPoints(Array.from({ length: 24 }, () => V(0, 0, 0))), new THREE.LineBasicMaterial({ color: FRAY, opacity: .9, ...M.additive }));
            root.add(loose);
            const anchor = new THREE.Object3D(); anchor.position.copy(out.clone().multiplyScalar(-44)); root.add(anchor);
            const pick = new THREE.Mesh(new THREE.SphereGeometry(46, 12, 8), new THREE.MeshBasicMaterial({ visible: false })); root.add(pick);
            const fx = M.points(90, 0xffffff, 4, 0); fx.userData.v = []; root.add(fx);
            actors[n.id] = { n, root, sp, halo, players, loose, fx, p, out, spin: .3, boost: 0, slack: 0, state: null, fxT: 0, base: C(color) };
            M.actor(n.id, { anchor, focus: p.clone().multiplyScalar(1.1), dist: 420, picks: [pick] });
        });

        // ================= the woven sheet: "Cyberdelics", woven from every actor's thread =================
        // Each section of the sheet takes the colour of the spool that feeds it. Global tightness sets how
        // flat, dense and bright the weave is; each spool's slack makes its own section sag, fray and tear.
        const AL = Object.values(actors);
        const ANG = new Float32Array(8), COLS = new Float32Array(24), SLK = new Float32Array(8), BLM = new Float32Array(8);
        AL.forEach((a, i) => { ANG[i] = Math.atan2(a.p.y, a.p.x); COLS.set([a.base.r, a.base.g, a.base.b], i * 3); });
        // the word mask the sheet stitches in (drawn again once Poppins has loaded)
        const wordCv = document.createElement('canvas'); wordCv.width = 1024; wordCv.height = 256;
        const wordTex = new THREE.CanvasTexture(wordCv);
        function drawWord() {
            const g = wordCv.getContext('2d'); g.clearRect(0, 0, 1024, 256);
            g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle';
            g.font = '700 168px Poppins, sans-serif';
            const w = g.measureText('CYBERDELICS').width; if (w > 1000) g.font = `700 ${Math.floor(168 * 1000 / w)}px Poppins, sans-serif`;
            g.fillText('CYBERDELICS', 512, 136);
            wordTex.needsUpdate = true;
        }
        drawWord(); if (document.fonts) document.fonts.load('700 168px Poppins').then(drawWord, () => {});
        const ANGW = `float angW(float a, float b) { float d = abs(mod(a - b + 3.14159265, 6.2831853) - 3.14159265); return exp(-d * d / .2); }`;
        const sheetMat = new THREE.ShaderMaterial({
            uniforms: { uT: { value: 0 }, uLoose: { value: .88 }, uTight: { value: .12 }, uGlow: { value: 0 }, uRS: { value: RS }, uAng: { value: ANG }, uSlack: { value: SLK }, uBloom: { value: BLM }, uCol: { value: COLS },
                uWord: { value: wordTex }, uWordLit: { value: 0 }, uWordFray: { value: 0 }, uWordCol: { value: new THREE.Color('#DCD2FF') } },
            vertexShader: `
                uniform float uT, uLoose, uRS, uAng[8], uSlack[8];
                varying vec2 vP; varying float vFr;
                ${ANGW}
                void main() {
                    vec3 p = position; float r = min(length(p.xy) / uRS, 1.2), a = atan(p.y, p.x);
                    float fr = 0.; for (int i = 0; i < 8; i++) fr += uSlack[i] * angW(a, uAng[i]);
                    float inner = max(0., 1. - r * r), e = smoothstep(.15, 1., r);
                    // loose: the whole cloth billows and sags
                    p.z += uLoose * (sin(position.x * .03 + uT * 1.3) * cos(position.y * .025 + uT * .9) * 16. + 8.) * (.3 + inner * .7);
                    p.y -= uLoose * 30. * inner;
                    // a slack spool lets its own section droop and flap
                    p.y -= fr * 75. * e;
                    p.z += fr * sin(r * 8. + uT * 2.) * 16. * e;
                    p.x += fr * sin(position.y * .05 + uT * 1.7) * 6. * e;
                    vP = position.xy; vFr = fr * e;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.);
                }`,
            fragmentShader: `
                uniform float uT, uTight, uGlow, uRS, uAng[8], uBloom[8], uWordLit, uWordFray;
                uniform vec3 uCol[8], uWordCol;
                uniform sampler2D uWord;
                varying vec2 vP; varying float vFr;
                ${ANGW}
                float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
                // each actor's signature weave: 1 where the warp (its own colour) lies on top
                float motif(vec2 id, float k) {
                    float x = id.x, y = id.y;
                    if (k < .5) return step(2., mod(x + y, 4.));                                     // twill
                    if (k < 1.5) return mod(floor(x / 2.) + floor(y / 2.), 2.);                      // basket
                    if (k < 2.5) { vec2 m = abs(mod(id, 8.) - 3.5); return step(m.x + m.y, 3.5); }   // diamond
                    if (k < 3.5) { float s = mod(floor(x / 4.), 2.) * 2. - 1.; return step(2., mod(x * s + y, 4.)); }   // herringbone
                    if (k < 4.5) { float d = length(mod(id, 10.) - 4.5); return step(.5, fract(d / 3.)); }             // rings
                    if (k < 5.5) return step(2., mod(y + abs(mod(x, 8.) - 4.), 4.));                 // chevron
                    if (k < 6.5) return 1. - step(.5, mod(x * 2. + y, 5.));                           // satin floats
                    return mod(floor(x / 3.) + floor(y / 3.), 2.);                                    // block check
                }
                void main() {
                    float r = length(vP) / uRS, a = atan(vP.y, vP.x), fr = clamp(vFr, 0., 1.);
                    float rag = 1. - fr * (.2 + .1 * sin(a * 37. + uT * .7));   // a fraying section has a ragged edge
                    if (r > rag) discard;
                    vec3 sec = vec3(0.); float tot = 0.;
                    for (int i = 0; i < 8; i++) { float k = angW(a, uAng[i]); sec += uCol[i] * k; tot += k; }
                    sec = mix(vec3(.71, .61, .97), sec / max(tot, 1e-3), smoothstep(.05, .75, r));
                    float wob = (1. - uTight) * 2.;
                    vec2 q = vP + vec2(sin(vP.y * .07 + uT * .8), sin(vP.x * .06 - uT * .6)) * wob;
                    float hw0 = .36 * (1. - fr * .55);
                    // resting weave: fine plain weave, dim, faintly tinted by the spool feeding each section
                    vec2 g = q / 5., f = fract(g) - .5, id = floor(g);
                    float wa = smoothstep(hw0, hw0 - .12, abs(f.x)), we = smoothstep(hw0, hw0 - .12, abs(f.y)), ov = mod(id.x + id.y, 2.);
                    float bB = max(wa * mix(.45, 1., ov), we * mix(1., .45, ov));
                    vec3 cB = mix(vec3(.6, .55, .85), sec, .35) * (.32 + uTight * .2);
                    // opportunity motifs: larger weave in the actor's colour, growing inward from its feeder
                    vec2 g2 = q / 9., f2 = fract(g2) - .5, id2 = floor(g2);
                    float wm = 0., om = 0., front = 0.; vec3 cm = vec3(0.);
                    for (int i = 0; i < 8; i++) {
                        float aw = exp(-pow(abs(mod(a - uAng[i] + 3.14159265, 6.2831853) - 3.14159265), 2.) / .07);
                        float edge = 1. - uBloom[i] * 1.15;
                        float w = aw * smoothstep(edge, edge + .1, r) * step(.001, uBloom[i]);
                        wm += w; om += w * motif(id2, float(i)); cm += w * uCol[i];
                        front += aw * exp(-pow((r - edge - .05) / .025, 2.)) * step(.001, uBloom[i]) * (1. - smoothstep(.8, 1., uBloom[i]));
                    }
                    om /= max(wm, 1e-3); cm /= max(wm, 1e-3);
                    float mask = clamp(wm * 1.4, 0., 1.);
                    float hw1 = .42 * (1. - fr * .55);
                    float wa2 = smoothstep(hw1, hw1 - .1, abs(f2.x)), we2 = smoothstep(hw1, hw1 - .1, abs(f2.y));
                    float topWarp = step(.5, om);
                    vec3 weftCol = mix(cm, vec3(.95, .9, .8), .45);
                    float onWarp = wa2 * mix(.3, 1., topWarp), onWeft = we2 * mix(1., .3, topWarp);
                    float bM = max(onWarp, onWeft);
                    vec3 cM = (onWarp >= onWeft ? cm : weftCol * .75) * (.6 + uTight * .15);
                    float band = (1. - smoothstep(.2, .28, abs(vP.y) / uRS)) * (1. - smoothstep(.9, .98, abs(vP.x) / uRS));
                    float b = mix(bB, bM, mask) * mix(1., .5, band);   // quieter weave behind the word so it reads
                    vec3 c = mix(cB, cM, mask);
                    b *= step(max(0., fr - .2) * .75, hash(mask > .5 ? id2 : id));   // broken threads only where it is really fraying
                    // the word, stitched in floats on its own fine grid: it fills with colour as opportunities land
                    // and unravels (broken stitches, sagging, red) under constraint
                    vec2 gw = q / 2.8, idw = floor(gw), fw = fract(gw) - .5, cw = (idw + .5) * 2.8;
                    cw.y += uWordFray * (sin(cw.x * .035 + uT * 1.2) * 5. + 4.);
                    vec2 wu = vec2(cw.x / (uRS * 1.8) + .5, cw.y / (uRS * .52) + .5);
                    float inW = step(0., wu.x) * step(wu.x, 1.) * step(0., wu.y) * step(wu.y, 1.);
                    float wmask = inW * step(.5, texture2D(uWord, wu).a) * step(uWordFray * .6, hash(idw + 7.3));
                    float stitch = wmask * smoothstep(.46, .3, abs(fw.y)) * (.7 + .3 * cos(fw.x * 3.14159));
                    float lit = 1. - smoothstep(uWordLit * 1.12 - .1, uWordLit * 1.12, wu.x);
                    vec3 wc = mix(vec3(.86, .82, 1.) * (.62 + uTight * .25), uWordCol * 1.15 + vec3(1., .9, .6) * uGlow * .25, lit);
                    wc = mix(wc, vec3(1., .36, .45) * .85, uWordFray * .75);
                    c = mix(c, wc, stitch); b = max(b, stitch);
                    c += vec3(1., .9, .6) * front * .5;                             // a soft gold seam where the motif is spreading
                    c *= 1. + uGlow * .2;
                    c = mix(c, vec3(1., .36, .45) * .7, fr * .7);
                    float fade = 1. - smoothstep(rag - .05, rag, r);
                    float al = (max(b * mix(.38, .55, mask), stitch * .9) + .03 + front * .25) * fade;
                    gl_FragColor = vec4(c, al);
                }`,
            transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide
        });
        const sheet = new THREE.Mesh(new THREE.PlaneGeometry(RS * 2, RS * 2, 96, 96), sheetMat); scene.add(sheet);
        const sheetGlow = M.glow('#B49BF8', 640, .1); scene.add(sheetGlow);
        const weaveTag = (() => { const o = new THREE.Object3D(); o.position.set(0, -RS - 26, 0); scene.add(o); return M.addLabel(o, 'weave · loose', '#9a86e0', null, 0, ''); })();
        const BASE_T = .12;
        let tight = BASE_T, tightWant = BASE_T, glowPulse = 0, weaveWord = '';
        const angW = (a, b) => { const d = Math.abs(((a - b + Math.PI) % TAU + TAU) % TAU - Math.PI); return Math.exp(-d * d / .2); };
        // where the sheet's edge sits right now (mirrors the vertex shader at r = 1)
        function sheetEdge(ang, t, out) {
            const x = Math.cos(ang) * RS, y = Math.sin(ang) * RS, loose = 1 - tight;
            let fr = 0; for (let j = 0; j < 8; j++) fr += SLK[j] * angW(ang, ANG[j]);
            return out.set(x + fr * Math.sin(y * .05 + t * 1.7) * 6, y - fr * 75,
                loose * (Math.sin(x * .03 + t * 1.3) * Math.cos(y * .025 + t * .9) * 16 + 8) * .3 + fr * Math.sin(8 + t * 2) * 16);
        }
        // three feeder strands per spool carry its thread into the sheet
        const feeders = [];
        AL.forEach((a, i) => [-1, 0, 1].forEach(s => {
            const mesh = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({ color: a.base, opacity: .7, ...M.additive }));
            scene.add(mesh); feeders.push({ a, i, off: s * .075, mesh });
        }));
        const fs = V(0, 0, 0), fe = V(0, 0, 0);
        function feederPoints(fd, t) {
            const a = fd.a, sag = a.slack + (1 - tight) * .12;
            fs.copy(a.p).multiplyScalar(.93); sheetEdge(ANG[fd.i] + fd.off, t, fe);
            const pts = [];
            for (let k = 0; k <= 20; k++) {
                const u = k / 20, s = Math.sin(Math.PI * u), p = fs.clone().lerp(fe, u);
                p.y -= sag * 55 * s; p.x += a.slack * Math.sin(u * 9 + t * 2 + fd.off * 40) * 7 * s; p.z += Math.sin(u * Math.PI * 6 + fd.off * 30) * 3 + a.slack * Math.cos(u * 7 + t * 1.5) * 9 * s;
                pts.push(p);
            }
            return pts;
        }

        // ================= threads: one per connection, woven over-under across the loom =================
        const threads = {};
        const key = (a, b) => [a, b].sort().join('|');
        function threadPoints(a, b, slack, t) {
            const pa = actors[a].p.clone().multiplyScalar(.93), pb = actors[b].p.clone().multiplyScalar(.93), ctrl = pa.clone().add(pb).multiplyScalar(.18);
            const q = new THREE.QuadraticBezierCurve3(pa, ctrl, pb), pts = [], seed = (a.length * 3 + b.length) % 7;
            for (let i = 0; i <= 60; i++) {
                const u = i / 60, p = q.getPoint(u), s = Math.sin(u * Math.PI);
                p.z = Math.sin(u * Math.PI * 18 + seed) * 5;   // over-under
                if (slack) { p.y -= slack * 70 * s; p.x += slack * Math.sin(u * 23 + t * 2) * 8 * s; p.z += slack * Math.cos(u * 17 + t * 1.5) * 10 * s; }
                pts.push(p);
            }
            return pts;
        }
        function addThread(a, b) {
            const k = key(a, b); if (threads[k]) return threads[k];
            const col = C(COLORS[a]).lerp(C(COLORS[b]), .5);
            const curve = new THREE.CatmullRomCurve3(threadPoints(a, b, 0, 0));
            const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 120, 1.6, 6), new THREE.MeshBasicMaterial({ color: col, opacity: .6, ...M.additive }));
            scene.add(mesh);
            threads[k] = { a, b, curve, mesh, col, slack: 0, want: 0, tension: 0, state: null };
            return threads[k];
        }
        NODES.forEach(n => n.connections.forEach(c => addThread(n.id, c)));
        const TL = Object.values(threads);
        const shuttle = M.points(TL.length, 0xffffff, 6, .85), shU = Float32Array.from({ length: TL.length }, () => Math.random());
        { const sc = new Float32Array(TL.length * 3); TL.forEach((th, i) => sc.set([th.col.r, th.col.g, th.col.b], i * 3)); shuttle.geometry.setAttribute('color', new THREE.BufferAttribute(sc, 3)); shuttle.material.vertexColors = true; }
        scene.add(shuttle);

        M.curveBetween = (a, b) => {
            const th = addThread(a, b);
            return th.a === a ? th.curve : new THREE.CatmullRomCurve3(th.curve.points.slice().reverse());
        };
        M.travel = (a, b, u, kind) => {
            const th = threads[key(a, b)]; th.state = kind;
            if (kind === 'opp') { th.tension = u; th.mesh.material.color.copy(th.col).lerp(GOLD, u * .9); th.mesh.material.opacity = .6 + u * .35; }
            else if (u >= 1) th.want = 1;   // the thread goes slack once the fray has passed along it
            else th.mesh.material.color.copy(th.col).lerp(FRAY, u * .9);
        };
        M.affect = (id, kind) => {
            const a = actors[id]; if (a) { a.state = kind; a.fxT = 0; a.fx.userData.v.length = 0; }
            if (kind === 'opp') { tightWant = Math.min(1, tightWant + .3); glowPulse = 1; }   // each opportunity pulls the weave tighter
            else tightWant = Math.max(0, tightWant - .1);                                      // each constraint lets it go
        };
        M.clearEffects = () => {
            Object.values(actors).forEach(a => { a.state = null; });
            TL.forEach(th => { th.state = null; th.want = 0; th.tension = 0; th.mesh.material.color.copy(th.col); th.mesh.material.opacity = .6; });
            tightWant = BASE_T; glowPulse = 0;
        };

        // ================= per frame =================
        const tv = V(0, 0, 0), tc = new THREE.Color(), wcol = new THREE.Color(), WORD_BASE = C('#DCD2FF');
        M.onFrame((dt, t) => {
            // slack threads sag and sway (rebuilt only while they move)
            TL.forEach(th => {
                const prev = th.slack;
                th.slack += (th.want - th.slack) * Math.min(1, dt * 1.5);
                if (th.slack > .01 || prev > .01) {
                    th.curve = new THREE.CatmullRomCurve3(threadPoints(th.a, th.b, th.slack, t));
                    th.mesh.geometry.dispose(); th.mesh.geometry = new THREE.TubeGeometry(th.curve, 120, 1.6 - th.slack * .5, 6);
                    if (th.state === 'con') { th.mesh.material.color.copy(th.col).lerp(FRAY, .9); th.mesh.material.opacity = .6 - th.slack * .25; }
                }
            });
            const sa = shuttle.geometry.attributes.position.array;
            TL.forEach((th, i) => { shU[i] = (shU[i] + dt * (th.state === 'con' ? 0 : .07 + th.tension * .2)) % 1; th.curve.getPointAt(shU[i], tv); sa.set([tv.x, tv.y, tv.z + 2], i * 3); });
            shuttle.geometry.attributes.position.needsUpdate = true;
            // the sheet: tightness eases toward its target, each spool's slack frays its own section
            tight += (tightWant - tight) * Math.min(1, dt * 1.2);
            glowPulse = Math.max(0, glowPulse - dt * .5);
            AL.forEach((a, i) => {
                if (!a.state && a.slack < .02) a.slack = 0;   // settle fully, so no torn threads linger after a reset
                SLK[i] = a.slack;
                // an opportunity grows this actor's motif inward at a steady pace; a constraint unpicks it
                const want = a.state === 'opp' ? 1 : 0;
                BLM[i] = want > BLM[i] ? Math.min(1, BLM[i] + dt * .45) : Math.max(0, BLM[i] - dt * .6);
            });
            const glowAmt = Math.max(0, (tight - .35) / .65) * .6 + glowPulse * .3;
            const su = sheetMat.uniforms; su.uT.value = t; su.uTight.value = tight; su.uLoose.value = 1 - tight; su.uGlow.value = glowAmt;
            // the word: fills left to right with the colours of the actors whose motifs have bloomed; unravels with slack
            let bSum = 0, slSum = 0; wcol.setRGB(0, 0, 0);
            AL.forEach((a, i) => { bSum += BLM[i]; slSum += SLK[i]; wcol.r += a.base.r * BLM[i]; wcol.g += a.base.g * BLM[i]; wcol.b += a.base.b * BLM[i]; });
            if (bSum > .01) wcol.multiplyScalar(1 / bSum).lerp(WORD_BASE, .15); else wcol.copy(WORD_BASE);
            su.uWordCol.value.lerp(wcol, Math.min(1, dt * 2));
            su.uWordLit.value += (Math.min(1, bSum / 2.5) - su.uWordLit.value) * Math.min(1, dt * 1.5);
            su.uWordFray.value += (Math.min(1, slSum / 1.6) - su.uWordFray.value) * Math.min(1, dt * 1.5);
            if (su.uWordFray.value < .01) su.uWordFray.value = 0;
            sheetGlow.material.color.set('#B49BF8').lerp(GOLD, Math.min(1, glowAmt) * .6);
            sheetGlow.material.opacity = .05 + tight * .07 + glowPulse * .05;
            const maxSlack = Math.max(...SLK);
            const word = maxSlack > .3 ? 'fraying' : tight > .75 ? 'taut · glowing' : tight > .4 ? 'tightening' : 'loose';
            if (word !== weaveWord) { weaveWord = word; weaveTag.el.textContent = 'weave · ' + word; weaveTag.el.style.setProperty('--c', word === 'fraying' ? '#FF5C72' : word === 'loose' ? '#9a86e0' : '#F7D774'); }
            feeders.forEach(fd => {
                const curve = new THREE.CatmullRomCurve3(feederPoints(fd, t));
                fd.mesh.geometry.dispose(); fd.mesh.geometry = new THREE.TubeGeometry(curve, 30, 1.1 - fd.a.slack * .4, 5);
                fd.mesh.material.color.copy(fd.a.base).lerp(GOLD, fd.a.state === 'opp' ? .7 : glowAmt * .4).lerp(FRAY, fd.a.slack * .85);
                fd.mesh.material.opacity = .45 + tight * .35 - fd.a.slack * .2;
            });
            // spools
            Object.values(actors).forEach((a, i) => {
                a.fxT += dt;
                a.spin += ((a.state === 'opp' ? 4 : a.state === 'con' ? 0 : .3) - a.spin) * Math.min(1, dt * 2);
                a.boost += ((a.state === 'opp' ? 1 : a.state === 'con' ? -.2 : 0) - a.boost) * Math.min(1, dt * 2.5);
                a.slack += ((a.state === 'con' ? 1 : 0) - a.slack) * Math.min(1, dt * .8);
                a.sp.inner.rotation.y += dt * a.spin;
                a.sp.wound.material.uniforms.uBoost.value = Math.max(0, a.boost) + (M.state.open === a.n.id ? .45 : 0);
                a.sp.wound.material.uniforms.uColor.value.copy(a.base).lerp(FRAY, a.slack * .55);
                a.sp.g.scale.setScalar(1 + Math.max(0, a.boost) * .12);
                a.halo.material.opacity = .3 + Math.max(0, a.boost) * .3 - a.slack * .15;
                a.players.forEach(pl => { pl.b.inner.rotation.y += dt * a.spin * 1.5; pl.lab.el.classList.toggle('gone', M.state.open !== a.n.id); });
                // a loose thread unravels downward from the spool
                const la = a.loose.geometry.attributes.position.array;
                for (let k = 0; k < 24; k++) { const s = k / 23 * a.slack; la.set([Math.sin(s * 9 + t * 2) * 10 * s, -s * 110, Math.cos(s * 7 + t) * 6 * s], k * 3); }
                a.loose.geometry.attributes.position.needsUpdate = true;
                a.loose.visible = a.slack > .02;
                // gold glints (opportunity) or drifting frayed fibres (constraint)
                const v = a.fx.userData.v, pa = a.fx.geometry.attributes.position.array;
                if (a.state && !v.length) {
                    a.fx.material.color.set(a.state === 'opp' ? '#FFE9A8' : '#FF8A9A');
                    for (let k = 0; k < 90; k++) v.push(a.state === 'opp' ? [0, 0, 0, rnd(-60, 60), rnd(-60, 60), rnd(-20, 40)] : [rnd(-20, 20), rnd(-20, 20), rnd(-5, 5), rnd(-12, 12), -rnd(10, 30), rnd(-6, 6)]);
                }
                if (v.length) {
                    v.forEach((q, k) => { q[0] += q[3] * dt; q[1] += q[4] * dt; q[2] += q[5] * dt; if (a.state === 'con' && q[1] < -160) { q[0] = rnd(-20, 20); q[1] = rnd(-10, 10); } pa.set([q[0], q[1], q[2]], k * 3); });
                    a.fx.material.opacity = a.state === 'opp' ? Math.max(0, 1 - a.fxT / 2.5) : a.state === 'con' ? .7 : 0;
                    a.fx.geometry.attributes.position.needsUpdate = true;
                    if (!a.state) v.length = 0;
                }
            });
        });
    }

    // ------------------------------------------------------------------
    // ENGINE DEFINITION
    // ------------------------------------------------------------------
    window.SimulationEngines['EcosystemMap'] = {
        name: 'Ecosystem Map',
        showPlaybackControls: false,
        defaults: {},

        // The engine draws its own controls, so the host builds no slider.
        config: [],

        init: function (container, params, host) {
            if (!window.EcosystemMapData || !window.EcosystemMapData.nodes) {
                console.error('[EcosystemMap] EcosystemMapData not found or malformed.');
                return;
            }
            this.host = host;
            this._container = container;
            this._destroyed = false;
            this._stage = null;

            container.querySelectorAll(':scope > .em3d').forEach(n => n.remove());
            const root = el('div', 'em3d');
            root.setAttribute('role', 'region');
            root.setAttribute('aria-label', 'The Cyberdelic Ecosystem: interactive 3D map');
            const status = el('div', 'em3d-status', 'Loading the 3D ecosystem…');
            root.appendChild(status);
            container.appendChild(root);
            if (getComputedStyle(container).position === 'static') container.style.position = 'relative';
            this._root = root;

            const lite = (window.matchMedia('(pointer: coarse)').matches && Math.min(window.innerWidth, window.innerHeight) < 600);
            loadDeps().then(() => {
                if (this._destroyed) return;
                this._stage = createStage(root, {
                    lite,
                    eyebrow: 'Who shapes the field',
                    title: 'The Cyberdelic Ecosystem',
                    sub: 'Every actor feeds thread into one shared weave. Click a spool to explore it, or play a ripple to see the weave pull tight and glow, or come loose.',
                    home: { pos: [0, 70, 1420], target: [0, -20, 0] }
                });
                buildLoom(this._stage);
                this._stage.start();
                status.remove();
                console.log('[EcosystemMap] 3D loom initialized');
            }).catch(err => {
                console.error('[EcosystemMap] Could not load three.js add-ons', err);
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
            if (!this._stage) return;
            this._stage.clearRipple();
            this._stage.home();
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
