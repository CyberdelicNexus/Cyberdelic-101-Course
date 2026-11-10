/**
 * Cyberdelic Convergence - Simulation Engine (3D "Convergence Nebula")
 * Registers itself to window.SimulationEngines['CyberdelicConvergence'].
 *
 * Six fields (orbs) drift together into one discipline (the core) as the year
 * moves 2015 → 2025. Built with plain three.js r128; see 3D-REVAMP-PLAN.md.
 *
 * - Content comes from cyberdelic-data.js (window.CyberdelicData).
 * - The engine draws its own timeline dock, so `config` is empty and the host
 *   builds no slider. A manifest can still set the start year: content.params.year.
 * - three.js add-ons (OrbitControls, bloom) are loaded on demand, so host pages only
 *   need three.min.js (and work without it too: three is loaded if missing).
 * - The previous SVG version lives in cyberdelic-convergence-2d.js.
 */
(function () {
    'use strict';

    window.SimulationEngines = window.SimulationEngines || {};

    const START = 2015, END = 2025;
    const RING_R = 230, ORB_R = 24, CORE_MIN = 9, CORE_MAX = 40;
    const NS_SVG = 'http://www.w3.org/2000/svg';

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
        if (window.__cnConvergenceDeps) return window.__cnConvergenceDeps;
        window.__cnConvergenceDeps = (async () => {
            if (!window.THREE) await loadScript(THREE_CDN);
            for (const [name, path] of DEPS) {
                if (!window.THREE[name]) await loadScript(EXAMPLES + path);
            }
        })();
        return window.__cnConvergenceDeps;
    }

    // ------------------------------------------------------------------
    // Shaders
    // ------------------------------------------------------------------
    const NOISE = `
        float hash(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
        float noise(vec3 x){
            vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
            return mix(mix(mix(hash(i + vec3(0,0,0)), hash(i + vec3(1,0,0)), f.x),
                           mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
                       mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x),
                           mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z);
        }
        float fbm(vec3 p){ float v = 0.0; float a = 0.5; for (int i = 0; i < 5; i++){ v += a * noise(p); p *= 2.03; a *= 0.5; } return v; }
    `;
    // Brand ramp cyan → violet → magenta → cyan
    const BRAND = `
        vec3 brand(float t){
            vec3 c1 = vec3(0.298, 0.863, 0.937); vec3 c2 = vec3(0.706, 0.608, 0.973); vec3 c3 = vec3(0.898, 0.384, 0.643);
            float k = fract(t) * 3.0;
            if (k < 1.0) return mix(c1, c2, k);
            if (k < 2.0) return mix(c2, c3, k - 1.0);
            return mix(c3, c1, k - 2.0);
        }
    `;
    const FRESNEL_V = `
        varying vec3 vNormal; varying vec3 vViewDir; varying vec3 vObj;
        void main(){
            vObj = position;
            vNormal = normalize(normalMatrix * normal);
            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            vViewDir = -mv.xyz;
            gl_Position = projectionMatrix * mv;
        }
    `;
    const UV_V = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

    // ------------------------------------------------------------------
    // Data helpers
    // ------------------------------------------------------------------
    function strengthAt(conn, y) {
        if (y < conn.yearAppears) return 0;
        if (conn.strengthByYear[y] !== undefined) return conn.strengthByYear[y];
        const years = Object.keys(conn.strengthByYear).map(Number).sort((a, b) => a - b);
        const lower = years.filter(v => v <= y).pop() || years[0];
        const upper = years.find(v => v >= y) || years[years.length - 1];
        if (lower === upper) return conn.strengthByYear[lower];
        const r = (y - lower) / (upper - lower);
        return conn.strengthByYear[lower] + (conn.strengthByYear[upper] - conn.strengthByYear[lower]) * r;
    }
    function strength(conn, yf) {
        const y0 = Math.floor(yf), f = yf - y0;
        return strengthAt(conn, y0) * (1 - f) + strengthAt(conn, Math.min(END, y0 + 1)) * f;
    }
    function snapshotFor(data, domainId, year) {
        const details = data.domainDetails && data.domainDetails[domainId];
        if (!details) return null;
        if (!details.contentByYear) return { year: null, years: [], data: details };
        const years = Object.keys(details.contentByYear).map(Number).sort((a, b) => a - b);
        const pick = years.filter(y => y <= year).pop();
        return { year: pick !== undefined ? pick : null, years, data: pick !== undefined ? details.contentByYear[pick] : null };
    }

    const el = (tag, cls, text) => {
        const n = document.createElement(tag);
        if (cls) n.className = cls;
        if (text !== undefined) n.textContent = text;
        return n;
    };

    const underbar = () => {
        const u = el('span', 'cn3d-underbar');
        u.setAttribute('aria-hidden', 'true');
        return u;
    };

    const ICON_PLAY = 'M7 4.5v15l13-7.5z';
    const ICON_PAUSE = 'M6 4.5h4.5v15H6zM13.5 4.5H18v15h-4.5z';

    // ------------------------------------------------------------------
    // DOM shell (overlay UI around the canvas). Text is set with textContent.
    // ------------------------------------------------------------------
    function buildShell() {
        const root = el('div', 'cn3d');
        root.tabIndex = -1;

        const head = el('header', 'cn3d-head');
        head.append(
            el('span', 'cn3d-eyebrow', 'Interactive simulation'),
            el('h2', 'cn3d-title', 'Cyberdelic convergence'),
            underbar(),
            el('p', 'cn3d-sub', 'Six fields drift together into one discipline. Drag to orbit, click a field to open it.')
        );

        const top = el('div', 'cn3d-top');
        const reset = el('button', 'cn3d-pill cn3d-reset', 'Reset view');
        reset.type = 'button';
        const helpBtn = el('button', 'cn3d-pill cn3d-help-btn');
        helpBtn.type = 'button';
        helpBtn.title = 'Press H for controls';
        helpBtn.append('Controls ', el('span', 'cn3d-key', 'H'));
        top.append(reset, helpBtn);

        const labels = el('div', 'cn3d-labels');
        // Wordmark attached to the core
        const coreLabel = el('div', 'cn3d-core-label', 'Cyberdelics');
        coreLabel.setAttribute('aria-hidden', 'true');
        labels.appendChild(coreLabel);
        const anchors = el('div', 'cn3d-anchors');
        anchors.setAttribute('aria-hidden', 'true');

        const panel = el('aside', 'cn3d-panel');
        panel.setAttribute('aria-hidden', 'true');
        const back = el('button', 'cn3d-back', '← Back to the nebula');
        back.type = 'button';
        const pEyebrow = el('span', 'cn3d-eyebrow');
        const pTitle = el('h3', 'cn3d-panel-title');
        const pSnaps = el('div', 'cn3d-snapshots');
        pSnaps.setAttribute('aria-label', 'Snapshot years');
        const pBody = el('div', 'cn3d-panel-body');
        panel.append(back, pEyebrow, pTitle, underbar(), pSnaps, pBody);

        const dock = el('div', 'cn3d-dock');
        dock.setAttribute('role', 'group');
        dock.setAttribute('aria-label', 'Timeline');
        const play = el('button', 'cn3d-play');
        play.type = 'button';
        play.setAttribute('aria-label', 'Play timeline');
        const playSvg = document.createElementNS(NS_SVG, 'svg');
        playSvg.setAttribute('viewBox', '0 0 24 24');
        playSvg.setAttribute('aria-hidden', 'true');
        const playPath = document.createElementNS(NS_SVG, 'path');
        playPath.setAttribute('d', ICON_PLAY);
        playSvg.appendChild(playPath);
        play.appendChild(playSvg);
        const yearBox = el('div', 'cn3d-year');
        const yearOut = el('output', null, String(START));
        yearBox.append(el('span', 'cn3d-eyebrow', 'Year'), yearOut);
        const track = el('div', 'cn3d-track');
        const range = el('input');
        Object.assign(range, { type: 'range', min: START, max: END, step: 1, value: START });
        range.setAttribute('aria-label', 'Year');
        const ticks = el('div', 'cn3d-ticks');
        for (let y = START; y <= END; y++) {
            const t = el('span', null, "'" + String(y).slice(2));
            t.dataset.y = y;
            ticks.appendChild(t);
        }
        track.append(range, ticks);
        dock.append(play, yearBox, track);

        const help = el('div', 'cn3d-help');
        help.setAttribute('role', 'dialog');
        help.setAttribute('aria-label', 'Controls');
        help.setAttribute('aria-hidden', 'true');
        const rows = [
            ['Orbit the nebula', ['Drag']],
            ['Zoom', ['Scroll']],
            ['Open a field', ['Click']],
            ['Change the year', ['←', '→']],
            ['Play the timeline', ['Space']],
            ['Back / zoom out', ['Esc']],
            ['Toggle this help', ['H']]
        ];
        const helpTitle = el('h3', 'cn3d-panel-title', 'Controls');
        help.append(el('span', 'cn3d-eyebrow', 'Cyberdelic convergence'), helpTitle,
            underbar());
        let zoomKeys = null;
        rows.forEach(([label, keys]) => {
            const row = el('div', 'cn3d-help-row');
            const k = el('span');
            keys.forEach(key => k.appendChild(el('span', 'cn3d-key', key)));
            row.append(el('span', null, label), k);
            if (label === 'Zoom') zoomKeys = k;
            help.appendChild(row);
        });
        const actions = el('div', 'cn3d-help-actions');
        const restart = el('button', 'cn3d-btn-ghost', 'Restart tutorial');
        restart.type = 'button';
        const close = el('button', 'cn3d-btn-primary', 'Close');
        close.type = 'button';
        actions.append(restart, close);
        help.appendChild(actions);

        const status = el('div', 'cn3d-status', 'Loading the nebula…');

        root.append(labels, anchors, head, top, panel, dock, help, status);
        return {
            root, head, labels, coreLabel, anchors, reset, helpBtn, panel, back, pEyebrow, pTitle, pSnaps, pBody,
            dock, play, playPath, yearOut, range, ticks, help, zoomKeys, restart, close, status
        };
    }

    // ------------------------------------------------------------------
    // The scene. Returns { frame(dt), resize(), setYear(y), back(), reset(), destroy() }
    // ------------------------------------------------------------------
    function createNebula(container, ui, DATA, opts) {
        const THREE = window.THREE;
        const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        const lite = opts.lite;
        const cleanups = [];
        const on = (target, type, fn, o) => { target.addEventListener(type, fn, o); cleanups.push(() => target.removeEventListener(type, fn, o)); };
        const randDir = v => {
            const u = Math.random() * 2 - 1, th = Math.random() * Math.PI * 2, r = Math.sqrt(1 - u * u);
            return v.set(r * Math.cos(th), u, r * Math.sin(th));
        };

        // Renderer, camera, controls, bloom
        const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, lite ? 1.5 : 2));
        renderer.setClearColor(0x000000, 1);
        renderer.domElement.className = 'cn3d-canvas';
        ui.root.prepend(renderer.domElement);

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(42, 1, 1, 9000);
        const HOME_POS = new THREE.Vector3(0, 270, 620);
        const HOME_TARGET = new THREE.Vector3(0, -10, 0);
        camera.position.copy(HOME_POS);

        const controls = new THREE.OrbitControls(camera, renderer.domElement);
        controls.target.copy(HOME_TARGET);
        controls.enableDamping = true;
        controls.dampingFactor = 0.06;
        controls.enablePan = false;
        controls.minDistance = 60;
        controls.maxDistance = 1200;
        controls.maxPolarAngle = Math.PI * 0.85;
        controls.rotateSpeed = 0.5;
        controls.zoomSpeed = 0.7;
        let userInteracting = false;
        controls.addEventListener('start', () => { userInteracting = true; });
        controls.addEventListener('end', () => { userInteracting = false; });

        // Inside a scrolling lesson page, plain wheel scrolls the page and Ctrl/⌘ + wheel zooms.
        // On a full-screen page (nothing to scroll), plain wheel zooms.
        const pageScrolls = () => {
            const se = document.scrollingElement || document.documentElement;
            return se.scrollHeight > window.innerHeight + 4;
        };
        on(renderer.domElement, 'wheel', e => {
            controls.enableZoom = !pageScrolls() || e.ctrlKey || e.metaKey;
        }, { capture: true, passive: true });
        const updateZoomHint = () => {
            if (!ui.zoomKeys) return;
            ui.zoomKeys.replaceChildren();
            (pageScrolls() ? ['Ctrl', 'Scroll'] : ['Scroll']).forEach(k => ui.zoomKeys.appendChild(el('span', 'cn3d-key', k)));
        };

        const composer = new THREE.EffectComposer(renderer);
        composer.addPass(new THREE.RenderPass(scene, camera));
        const BLOOM_BASE = 0.7;
        const bloom = new THREE.UnrealBloomPass(new THREE.Vector2(256, 256), BLOOM_BASE, 0.55, 0.32);
        if (!lite) composer.addPass(bloom);

        // Soft radial texture for halos and the streak
        const glowTex = (() => {
            const c = document.createElement('canvas');
            c.width = c.height = 256;
            const g = c.getContext('2d');
            const gr = g.createRadialGradient(128, 128, 0, 128, 128, 128);
            gr.addColorStop(0, 'rgba(255,255,255,1)');
            gr.addColorStop(0.22, 'rgba(255,255,255,0.45)');
            gr.addColorStop(0.55, 'rgba(255,255,255,0.1)');
            gr.addColorStop(1, 'rgba(255,255,255,0)');
            g.fillStyle = gr;
            g.fillRect(0, 0, 256, 256);
            return new THREE.CanvasTexture(c);
        })();

        // Backdrop: nebula sphere + stars
        const nebulaMat = new THREE.ShaderMaterial({
            side: THREE.BackSide, depthWrite: false,
            uniforms: { uTime: { value: 0 }, uWarm: { value: 0 } },
            vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
            fragmentShader: `
                uniform float uTime; uniform float uWarm; varying vec3 vDir;
                ${NOISE}
                void main(){
                    vec3 d = normalize(vDir);
                    float t = uTime * 0.012;
                    float n = fbm(d * 2.2 + vec3(t, -t * 0.6, t * 0.4));
                    float wisps = smoothstep(0.42, 0.88, fbm(d * 4.2 + n * 1.6 + vec3(-t, 0.0, t)));
                    vec3 violet = vec3(0.29, 0.17, 0.58);
                    vec3 magenta = vec3(0.36, 0.16, 0.43);
                    vec3 blue = vec3(0.106, 0.227, 0.47);
                    float b1 = pow(max(dot(d, normalize(vec3(-0.6, 0.35, -0.7))), 0.0), 2.5);
                    float b2 = pow(max(dot(d, normalize(vec3(0.75, -0.2, -0.6))), 0.0), 2.5);
                    float b3 = pow(max(dot(d, normalize(vec3(0.0, -0.85, -0.4))), 0.0), 2.0);
                    vec3 col = violet * b1 * mix(0.55, 1.1, uWarm)
                             + magenta * b2 * mix(0.25, 1.15, uWarm)
                             + blue * b3 * mix(1.2, 0.55, uWarm);
                    col += mix(blue * 1.1, mix(violet, magenta, 0.5) * 1.2, uWarm) * wisps * 0.32;
                    col *= 0.5 + 0.9 * n;
                    gl_FragColor = vec4(col * 0.42, 1.0);
                }
            `
        });
        scene.add(new THREE.Mesh(new THREE.SphereGeometry(4000, 48, 32), nebulaMat));

        {
            const n = lite ? 900 : 2200;
            const pos = new Float32Array(n * 3);
            const v = new THREE.Vector3();
            for (let i = 0; i < n; i++) {
                randDir(v).multiplyScalar(1800 + Math.random() * 1600);
                pos[i * 3] = v.x; pos[i * 3 + 1] = v.y; pos[i * 3 + 2] = v.z;
            }
            const geo = new THREE.BufferGeometry();
            geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
            scene.add(new THREE.Points(geo, new THREE.PointsMaterial({
                size: 1.5, sizeAttenuation: false, color: 0xd8d0ff, transparent: true, opacity: 0.7, depthWrite: false
            })));
        }

        // The system: domains, core, connections, on a slowly turning group
        const sys = new THREE.Group();
        sys.rotation.z = 0.06;
        scene.add(sys);

        const orbGeo = new THREE.SphereGeometry(1, 64, 48);
        const domains = DATA.domains.map((d, i) => {
            const color = new THREE.Color(d.color);
            const mat = new THREE.ShaderMaterial({
                uniforms: { uColor: { value: color }, uTime: { value: i * 7.3 }, uDim: { value: 1 }, uHover: { value: 0 } },
                vertexShader: FRESNEL_V,
                fragmentShader: `
                    uniform vec3 uColor; uniform float uTime; uniform float uDim; uniform float uHover;
                    varying vec3 vNormal; varying vec3 vViewDir; varying vec3 vObj;
                    ${NOISE}
                    void main(){
                        float f = pow(1.0 - max(dot(normalize(vNormal), normalize(vViewDir)), 0.0), 2.4);
                        float n = noise(vObj * 3.0 + vec3(0.0, uTime * 0.35, uTime * 0.2));
                        float n2 = noise(vObj * 6.5 - vec3(uTime * 0.25));
                        float plasma = smoothstep(0.4, 0.95, n * 0.65 + n2 * 0.45);
                        vec3 col = vec3(0.035, 0.025, 0.07);
                        col += uColor * plasma * 0.32 * (1.0 - f);
                        col += uColor * f * (1.45 + uHover * 0.9);
                        col += vec3(1.0) * pow(f, 6.0) * 0.25;
                        col *= mix(0.2, 1.0, uDim);
                        gl_FragColor = vec4(col, 1.0);
                    }
                `
            });
            const mesh = new THREE.Mesh(orbGeo, mat);
            mesh.scale.setScalar(ORB_R);
            mesh.userData.domainIndex = i;

            const halo = new THREE.Sprite(new THREE.SpriteMaterial({
                map: glowTex, color, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false
            }));
            halo.scale.setScalar(ORB_R * 4.6);

            const ring = new THREE.Mesh(
                new THREE.TorusGeometry(ORB_R * 1.5, 0.3, 8, 160),
                new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false })
            );
            ring.rotation.set(Math.PI / 2 + 0.35 * Math.sin(i * 1.7), 0.3 * Math.cos(i * 2.3), 0);

            const node = new THREE.Group();
            node.add(halo, mesh, ring);
            sys.add(node);

            // HTML label (sharp at any zoom)
            const label = el('button', 'cn3d-label', d.name);
            label.type = 'button';
            label.style.setProperty('--c', d.color);
            ui.labels.appendChild(label);

            // Invisible anchor over the orb: keeps `.domain-node[data-id] .node-circle`
            // working for the tutorial spotlight
            const anchor = el('div', 'domain-node');
            anchor.dataset.id = d.id;
            const circle = el('div', 'node-circle');
            anchor.appendChild(circle);
            ui.anchors.appendChild(anchor);

            return {
                ...d, index: i, color, mat, mesh, halo, ring, node, label, anchor, circle,
                angleRad: d.angle * Math.PI / 180,
                dim: 1, dimTarget: 1, hover: 0, hoverTarget: 0
            };
        });
        domains.forEach((d, i) => on(d.label, 'click', () => zoomTo(i)));

        function placeDomain(dom, p, out) {
            const r = RING_R * (1 - 0.14 * p);
            return out.set(Math.cos(dom.angleRad) * r, Math.sin(dom.angleRad * 2) * 18, Math.sin(dom.angleRad) * r);
        }

        // Core: dark icosahedron with a brand-lit rim, wireframe shell, accretion ring, halo, streak
        const core = new THREE.Group();
        sys.add(core);
        const coreMat = new THREE.ShaderMaterial({
            uniforms: { uTime: { value: 0 }, uEnergy: { value: 0 } },
            vertexShader: FRESNEL_V,
            fragmentShader: `
                uniform float uTime; uniform float uEnergy;
                varying vec3 vNormal; varying vec3 vViewDir; varying vec3 vObj;
                ${BRAND}
                void main(){
                    float f = pow(1.0 - max(dot(normalize(vNormal), normalize(vViewDir)), 0.0), 2.0);
                    float ang = atan(vObj.z, vObj.x) / 6.2831853 + 0.5 + uTime * 0.05 + vObj.y * 0.15;
                    float pulse = 0.5 + 0.5 * sin(uTime * 2.2);
                    vec3 inner = vec3(0.02, 0.012, 0.05) + vec3(0.486, 0.31, 0.94) * (0.06 + 0.14 * pulse) * uEnergy;
                    gl_FragColor = vec4(inner + brand(ang) * f * (0.7 + 1.5 * uEnergy), 1.0);
                }
            `
        });
        const coreMesh = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 2), coreMat);
        core.add(coreMesh);
        const shell = new THREE.LineSegments(
            new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(1.5, 1)),
            new THREE.LineBasicMaterial({ color: 0xB49BF8, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false })
        );
        core.add(shell);
        const accretionMat = new THREE.ShaderMaterial({
            transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
            uniforms: { uTime: { value: 0 }, uOpacity: { value: 0.6 } },
            vertexShader: UV_V,
            fragmentShader: `uniform float uTime; uniform float uOpacity; varying vec2 vUv; ${BRAND}
                void main(){ gl_FragColor = vec4(brand(vUv.x + uTime * 0.04) * uOpacity, 1.0); }`
        });
        const accretion = new THREE.Mesh(new THREE.TorusGeometry(1, 0.018, 12, 240), accretionMat);
        accretion.rotation.x = Math.PI / 2 - 0.22;
        core.add(accretion);
        const coreHalo = new THREE.Sprite(new THREE.SpriteMaterial({
            map: glowTex, color: 0xB964F5, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false
        }));
        core.add(coreHalo);
        const streak = new THREE.Sprite(new THREE.SpriteMaterial({
            map: glowTex, color: 0xC9B8FF, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false
        }));
        core.add(streak);

        // Paths: quadratic beziers p0 → p1 (control) → p2
        const paths = [];
        const tubeMat = (a, b, glow) => new THREE.ShaderMaterial({
            transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
            uniforms: { uA: { value: a }, uB: { value: b }, uOpacity: { value: 0 }, uTime: { value: 0 }, uGlow: { value: glow ? 1 : 0 } },
            vertexShader: UV_V,
            fragmentShader: `
                uniform vec3 uA; uniform vec3 uB; uniform float uOpacity; uniform float uTime; uniform float uGlow; varying vec2 vUv;
                void main(){
                    vec3 col = mix(uA, uB, vUv.x);
                    float flow = 0.65 + 0.35 * sin(vUv.x * 18.0 - uTime * 2.4);
                    float ends = smoothstep(0.0, 0.08, vUv.x) * smoothstep(1.0, 0.92, vUv.x);
                    gl_FragColor = vec4(col * uOpacity * mix(flow, 1.0, uGlow) * ends, 1.0);
                }
            `
        });
        DATA.connections.forEach(c => {
            const a = domains.find(d => d.id === c.source);
            const b = domains.find(d => d.id === c.target);
            if (!a || !b) return;
            let diff = Math.abs(a.angle - b.angle);
            if (diff > 180) diff = 360 - diff;
            const coreTube = new THREE.Mesh(new THREE.BufferGeometry(), tubeMat(a.color, b.color, false));
            const glowTube = new THREE.Mesh(new THREE.BufferGeometry(), tubeMat(a.color, b.color, true));
            sys.add(glowTube, coreTube);
            paths.push({ kind: 'conn', conn: c, a, b, diff, coreTube, glowTube,
                p0: new THREE.Vector3(), p1: new THREE.Vector3(), p2: new THREE.Vector3(), strength: 0 });
        });
        domains.forEach(d => {
            const geo = new THREE.BufferGeometry();
            geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(41 * 3), 3));
            const line = new THREE.Line(geo, new THREE.LineBasicMaterial({
                color: d.color, transparent: true, opacity: 0.2, blending: THREE.AdditiveBlending, depthWrite: false
            }));
            sys.add(line);
            paths.push({ kind: 'spoke', a: d, line,
                p0: new THREE.Vector3(), p1: new THREE.Vector3(), p2: new THREE.Vector3(), strength: 0 });
        });
        const spokePaths = paths.filter(p => p.kind === 'spoke');
        const connPaths = paths.filter(p => p.kind === 'conn');

        function bezier(path, t, out) {
            const u = 1 - t;
            return out.set(
                u * u * path.p0.x + 2 * u * t * path.p1.x + t * t * path.p2.x,
                u * u * path.p0.y + 2 * u * t * path.p1.y + t * t * path.p2.y,
                u * u * path.p0.z + 2 * u * t * path.p1.z + t * t * path.p2.z
            );
        }

        // Particles: one Points buffer for every stream
        const P_COUNT = lite ? 500 : 1600;
        const pPos = new Float32Array(P_COUNT * 3);
        const pCol = new Float32Array(P_COUNT * 3);
        const pAlpha = new Float32Array(P_COUNT);
        const pSize = new Float32Array(P_COUNT);
        const particles = [];
        for (let i = 0; i < P_COUNT; i++) {
            const list = Math.random() < 0.5 ? spokePaths : connPaths;
            particles.push({
                path: list[Math.floor(Math.random() * list.length)],
                t: Math.random(),
                speed: 0.08 + Math.random() * 0.14,
                gate: Math.random(),
                jitter: randDir(new THREE.Vector3()).multiplyScalar(Math.random() * 3)
            });
            pSize[i] = 3 + Math.random() * 5;
        }
        const pGeo = new THREE.BufferGeometry();
        pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
        pGeo.setAttribute('aColor', new THREE.BufferAttribute(pCol, 3));
        pGeo.setAttribute('aAlpha', new THREE.BufferAttribute(pAlpha, 1));
        pGeo.setAttribute('aSize', new THREE.BufferAttribute(pSize, 1));
        const pMat = new THREE.ShaderMaterial({
            transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
            uniforms: { uScale: { value: 1 } },
            vertexShader: `
                attribute vec3 aColor; attribute float aAlpha; attribute float aSize; uniform float uScale;
                varying vec3 vColor; varying float vAlpha;
                void main(){
                    vColor = aColor; vAlpha = aAlpha;
                    vec4 mv = modelViewMatrix * vec4(position, 1.0);
                    gl_PointSize = aSize * uScale * (320.0 / -mv.z);
                    gl_Position = projectionMatrix * mv;
                }
            `,
            fragmentShader: `
                varying vec3 vColor; varying float vAlpha;
                void main(){
                    float d = length(gl_PointCoord - 0.5);
                    float a = smoothstep(0.5, 0.0, d);
                    float hot = smoothstep(0.16, 0.0, d);
                    gl_FragColor = vec4(mix(vColor, vec3(1.0), hot * 0.75) * a * vAlpha, 1.0);
                }
            `
        });
        const points = new THREE.Points(pGeo, pMat);
        points.frustumCulled = false;
        sys.add(points);

        // ---------------- state ----------------
        const startYear = Math.max(START, Math.min(END, Math.round(opts.startYear || START)));
        const state = {
            targetYear: startYear, year: startYear, builtYear: -1,
            selected: null, offset: 0, flare: 0, flared: startYear >= END,
            playing: false, playTimer: 0, coreSize: CORE_MIN
        };
        const tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3();
        const violet = new THREE.Color(0xB49BF8);
        const colA = new THREE.Color();

        function rebuild() {
            const y = state.year;
            const p = (y - START) / (END - START);
            state.builtYear = y;
            domains.forEach(d => placeDomain(d, p, d.node.position));

            connPaths.forEach(path => { path.strength = strength(path.conn, y); });
            spokePaths.forEach(path => {
                let m = 0;
                connPaths.forEach(c => { if (c.a === path.a || c.b === path.a) m = Math.max(m, c.strength); });
                path.strength = 0.18 + 0.82 * m;
            });

            connPaths.forEach(path => {
                const A = path.a.node.position, B = path.b.node.position;
                const k = path.diff / 180;
                path.p0.copy(A);
                path.p2.copy(B);
                path.p1.copy(A).add(B).multiplyScalar(0.5 * (0.55 + 0.3 * (1 - k)));
                path.p1.y += 25 + 150 * k; // opposite fields arc high over the core
                const s = path.strength;
                [path.coreTube, path.glowTube].forEach((mesh, gi) => {
                    mesh.visible = s > 0.005;
                    if (!mesh.visible) return;
                    mesh.geometry.dispose();
                    const curve = new THREE.QuadraticBezierCurve3(path.p0, path.p1, path.p2);
                    mesh.geometry = new THREE.TubeGeometry(curve, 64, gi === 0 ? 0.3 + 1.1 * s : 1.8 + 3.5 * s, 10, false);
                    mesh.material.uniforms.uOpacity.value = gi === 0 ? 0.18 + 0.5 * s : 0.06 * s;
                });
            });

            spokePaths.forEach(path => {
                path.p0.copy(path.a.node.position);
                path.p2.set(0, 0, 0);
                path.p1.copy(path.p0).multiplyScalar(0.5);
                path.p1.y -= 30;
                const attr = path.line.geometry.attributes.position;
                for (let i = 0; i <= 40; i++) {
                    bezier(path, i / 40, tmp);
                    attr.array[i * 3] = tmp.x; attr.array[i * 3 + 1] = tmp.y; attr.array[i * 3 + 2] = tmp.z;
                }
                attr.needsUpdate = true;
                path.line.geometry.computeBoundingSphere();
                path.line.material.opacity = 0.08 + 0.22 * path.strength;
            });

            state.coreSize = CORE_MIN + (CORE_MAX - CORE_MIN) * p;
            coreMat.uniforms.uEnergy.value = p;
            nebulaMat.uniforms.uWarm.value = p;
            streak.material.opacity = 0.18 + 0.45 * p;
            shell.material.opacity = 0.2 + 0.3 * p;
        }

        // ---------------- timeline ----------------
        function setYear(y, fromInput) {
            y = Math.max(START, Math.min(END, Math.round(y)));
            state.targetYear = y;
            ui.yearOut.textContent = y;
            if (!fromInput) ui.range.value = y;
            ui.ticks.querySelectorAll('span').forEach(s => s.classList.toggle('on', Number(s.dataset.y) === y));
            if (state.selected !== null) renderPanel(domains[state.selected]);
            if (opts.onYear) opts.onYear(y);
        }
        function startPlay() {
            if (state.targetYear >= END) setYear(START);
            state.playing = true;
            state.playTimer = 0;
            ui.play.setAttribute('aria-label', 'Pause timeline');
            ui.playPath.setAttribute('d', ICON_PAUSE);
        }
        function stopPlay() {
            state.playing = false;
            ui.play.setAttribute('aria-label', 'Play timeline');
            ui.playPath.setAttribute('d', ICON_PLAY);
        }
        on(ui.range, 'input', () => { stopPlay(); setYear(Number(ui.range.value), true); });
        on(ui.play, 'click', () => (state.playing ? stopPlay() : startPlay()));

        // ---------------- panel ----------------
        function section(title, child) {
            const s = el('section');
            s.append(el('h4', null, title), child);
            return s;
        }
        function renderPanel(d) {
            const snap = snapshotFor(DATA, d.id, state.targetYear);
            ui.panel.style.setProperty('--c', d.color.getStyle());
            ui.pEyebrow.textContent = snap && snap.year ? `Field · snapshot ${snap.year}` : 'Field';
            ui.pTitle.textContent = d.name.replace('\n', ' ');

            ui.pSnaps.replaceChildren();
            ((snap && snap.years) || []).forEach(y => {
                const b = el('button', null, String(y));
                b.type = 'button';
                b.setAttribute('aria-current', String(snap.year === y));
                b.addEventListener('click', () => { stopPlay(); setYear(y); });
                ui.pSnaps.appendChild(b);
            });

            ui.pBody.replaceChildren();
            const data = snap && snap.data;
            if (!data) {
                ui.pBody.appendChild(el('p', 'cn3d-empty', 'No snapshot before this year. Move the timeline forward.'));
                return;
            }
            if (data.contributions) {
                const ul = el('ul', 'cn3d-list');
                data.contributions.forEach(c => ul.appendChild(el('li', null, c)));
                ui.pBody.appendChild(section('Contributions', ul));
            }
            if (data.keyPeople) {
                const ul = el('ul', 'cn3d-people');
                data.keyPeople.forEach(p => {
                    const li = el('li');
                    li.appendChild(el('strong', null, typeof p === 'string' ? p : p.name));
                    if (p && p.role) li.appendChild(el('span', null, p.role));
                    ul.appendChild(li);
                });
                ui.pBody.appendChild(section('Key people', ul));
            }
            if (data.technologies) {
                const ul = el('ul', 'cn3d-chips');
                data.technologies.forEach(t => ul.appendChild(el('li', null, t)));
                ui.pBody.appendChild(section('Technologies', ul));
            }
            if (data.examples) {
                const box = el('div', 'cn3d-examples');
                data.examples.forEach(ex => {
                    const card = el(ex.url ? 'a' : 'div', 'cn3d-example');
                    if (ex.url) { card.href = ex.url; card.target = '_blank'; card.rel = 'noopener noreferrer'; }
                    card.appendChild(el('strong', null, ex.name));
                    if (ex.type || ex.description) card.appendChild(el('span', null, ex.type || ex.description));
                    if (ex.url) {
                        const svg = document.createElementNS(NS_SVG, 'svg');
                        svg.setAttribute('viewBox', '0 0 24 24');
                        svg.setAttribute('aria-hidden', 'true');
                        const path = document.createElementNS(NS_SVG, 'path');
                        path.setAttribute('d', 'M7 17L17 7M8 7h9v9');
                        svg.appendChild(path);
                        card.appendChild(svg);
                    }
                    box.appendChild(card);
                });
                ui.pBody.appendChild(section('Examples', box));
            }
        }

        // ---------------- camera flights ----------------
        let fly = null;
        const ease = t => 1 - Math.pow(1 - t, 4); // close to cubic-bezier(.16,1,.3,1)
        function flyTo(pos, target, dur) {
            fly = {
                fromP: camera.position.clone(), toP: pos.clone(),
                fromT: controls.target.clone(), toT: target.clone(),
                t: 0, dur: reduceMotion ? 0.001 : dur
            };
            controls.enabled = false;
        }
        const lastOrb = new THREE.Vector3();
        function zoomTo(i) {
            if (state.selected === i) { back(); return; }
            state.selected = i;
            const d = domains[i];
            d.node.getWorldPosition(tmp);
            lastOrb.copy(tmp);
            const out = tmp2.set(tmp.x, 0, tmp.z).normalize();
            const pos = tmp.clone().addScaledVector(out, 120).add(new THREE.Vector3(0, 48, 0));
            flyTo(pos, tmp, 1.3);
            domains.forEach((o, j) => { o.dimTarget = j === i ? 1 : 0.16; });
            renderPanel(d);
            ui.panel.classList.add('open');
            ui.panel.setAttribute('aria-hidden', 'false');
            ui.root.classList.add('cn3d--zoomed');
        }
        function back() {
            const wasOpen = state.selected !== null;
            state.selected = null;
            flyTo(HOME_POS, HOME_TARGET, 1.1);
            if (!wasOpen) return;
            domains.forEach(o => { o.dimTarget = 1; });
            ui.panel.classList.remove('open');
            ui.panel.setAttribute('aria-hidden', 'true');
            ui.root.classList.remove('cn3d--zoomed');
        }
        on(ui.back, 'click', back);
        on(ui.reset, 'click', back);

        // ---------------- picking ----------------
        const raycaster = new THREE.Raycaster();
        const ndc = new THREE.Vector2();
        const orbMeshes = domains.map(d => d.mesh);
        function pick(ev) {
            const r = renderer.domElement.getBoundingClientRect();
            ndc.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
            raycaster.setFromCamera(ndc, camera);
            const hit = raycaster.intersectObjects(orbMeshes, false)[0];
            return hit ? hit.object.userData.domainIndex : null;
        }
        let downAt = null;
        on(renderer.domElement, 'pointerdown', ev => { downAt = { x: ev.clientX, y: ev.clientY }; ui.root.focus({ preventScroll: true }); });
        on(renderer.domElement, 'pointerup', ev => {
            if (!downAt) return;
            const moved = Math.hypot(ev.clientX - downAt.x, ev.clientY - downAt.y);
            downAt = null;
            if (moved > 5) return;
            const i = pick(ev);
            if (i !== null) zoomTo(i);
            else if (state.selected !== null) back();
        });
        let hoverEv = null;
        on(renderer.domElement, 'pointermove', ev => { hoverEv = ev; });
        on(renderer.domElement, 'pointerleave', () => {
            hoverEv = null;
            domains.forEach(d => { d.hoverTarget = 0; d.label.classList.remove('hover'); });
            ui.root.classList.remove('cn3d--hovering');
        });

        // ---------------- sizing & visibility ----------------
        let W = 1, H = 1;
        function applyViewOffset() {
            const o = state.offset;
            if (o < 0.001) camera.clearViewOffset();
            else if (W > 760) camera.setViewOffset(W, H, W * 0.16 * o, 0, W, H);
            else camera.setViewOffset(W, H, 0, H * 0.22 * o, W, H);
            camera.updateProjectionMatrix();
        }
        function resize() {
            W = Math.max(1, ui.root.clientWidth);
            H = Math.max(1, ui.root.clientHeight);
            renderer.setSize(W, H, false);
            composer.setSize(W, H);
            camera.aspect = W / H;
            applyViewOffset();
            pMat.uniforms.uScale.value = Math.min(window.devicePixelRatio || 1, 2) * (H / 900);
            ui.root.classList.toggle('cn3d--compact', W <= 760);
            updateZoomHint();
        }
        const ro = new ResizeObserver(resize);
        ro.observe(ui.root);
        cleanups.push(() => ro.disconnect());
        let visible = true;
        if ('IntersectionObserver' in window) {
            const io = new IntersectionObserver(entries => { visible = entries[0].isIntersecting; });
            io.observe(ui.root);
            cleanups.push(() => io.disconnect());
        }
        resize();

        // ---------------- frame ----------------
        let time = 0;
        const projected = new THREE.Vector3();
        const fovK = () => 1 / Math.tan((camera.fov * Math.PI / 180) / 2);

        function frame(dt) {
            dt = Math.min(Math.max(dt || 0, 0), 0.05);
            if (!visible || document.hidden) return;
            time += dt;

            if (state.playing) {
                state.playTimer += dt;
                if (state.playTimer > 1.15) {
                    state.playTimer = 0;
                    if (state.targetYear >= END) stopPlay(); else setYear(state.targetYear + 1);
                }
            }

            state.year += (state.targetYear - state.year) * Math.min(1, dt * (reduceMotion ? 20 : 3.2));
            if (Math.abs(state.targetYear - state.year) < 0.001) state.year = state.targetYear;
            if (Math.abs(state.year - state.builtYear) > 0.002) rebuild();

            // the 2025 flare
            if (state.year > END - 0.08 && !state.flared) { state.flared = true; state.flare = reduceMotion ? 0 : 1; }
            if (state.year < END - 0.6) state.flared = false;
            state.flare *= Math.exp(-dt * 1.1);
            bloom.strength = BLOOM_BASE + state.flare * 1.6;

            if (state.selected === null && !reduceMotion && !userInteracting && !fly) sys.rotation.y += dt * 0.03;

            coreMat.uniforms.uTime.value = time;
            accretionMat.uniforms.uTime.value = time;
            nebulaMat.uniforms.uTime.value = time;
            connPaths.forEach(p => { p.coreTube.material.uniforms.uTime.value = time; });

            const breathe = 1 + 0.04 * Math.sin(time * 1.6) + 0.3 * state.flare;
            coreMesh.scale.setScalar(state.coreSize * breathe);
            coreMesh.rotation.y += dt * 0.12;
            shell.scale.setScalar(state.coreSize * (1 + 0.06 * Math.sin(time * 0.9)));
            shell.rotation.y -= dt * 0.08;
            shell.rotation.x += dt * 0.05;
            accretion.scale.setScalar(state.coreSize * 2.1);
            accretion.rotation.z += dt * 0.15;
            coreHalo.scale.setScalar(state.coreSize * (5 + 3 * state.flare));
            coreHalo.material.opacity = 0.35 + 0.35 * coreMat.uniforms.uEnergy.value + 0.4 * state.flare;
            streak.scale.set(state.coreSize * 14 + 120, state.coreSize * 1.6 + 14, 1);

            if (hoverEv && !fly) {
                const h = pick(hoverEv);
                domains.forEach((d, i) => { d.hoverTarget = i === h ? 1 : 0; d.label.classList.toggle('hover', i === h); });
                ui.root.classList.toggle('cn3d--hovering', h !== null);
            }

            domains.forEach((d, i) => {
                d.dim += (d.dimTarget - d.dim) * Math.min(1, dt * 4);
                d.hover += (d.hoverTarget - d.hover) * Math.min(1, dt * 8);
                d.mat.uniforms.uDim.value = d.dim;
                d.mat.uniforms.uHover.value = d.hover;
                d.mat.uniforms.uTime.value = time + i * 7.3;
                d.halo.material.opacity = (0.32 + 0.3 * d.hover) * (0.15 + 0.85 * d.dim);
                d.ring.material.opacity = 0.4 * (0.1 + 0.9 * d.dim);
                d.ring.rotation.z += dt * (0.2 + i * 0.03);
            });

            const sel = state.selected !== null ? domains[state.selected] : null;
            for (let i = 0; i < P_COUNT; i++) {
                const pt = particles[i];
                const path = pt.path;
                pt.t += dt * pt.speed * (reduceMotion ? 0.4 : 1);
                if (pt.t > 1) pt.t -= 1;
                bezier(path, pt.t, tmp).add(pt.jitter);
                pPos[i * 3] = tmp.x; pPos[i * 3 + 1] = tmp.y; pPos[i * 3 + 2] = tmp.z;
                const lit = Math.min(1, Math.max(0, (path.strength - pt.gate) * 6));
                const dimF = sel ? ((path.a === sel || path.b === sel) ? 1 : 0.15) : 1;
                pAlpha[i] = lit * Math.sin(Math.PI * pt.t) * dimF * (path.kind === 'spoke' ? 0.8 : 1);
                if (path.kind === 'conn') colA.copy(path.a.color).lerp(path.b.color, pt.t);
                else colA.copy(path.a.color).lerp(violet, pt.t * 0.6);
                pCol[i * 3] = colA.r; pCol[i * 3 + 1] = colA.g; pCol[i * 3 + 2] = colA.b;
            }
            pGeo.attributes.position.needsUpdate = true;
            pGeo.attributes.aAlpha.needsUpdate = true;
            pGeo.attributes.aColor.needsUpdate = true;

            if (fly) {
                fly.t += dt / fly.dur;
                const k = ease(Math.min(1, fly.t));
                camera.position.lerpVectors(fly.fromP, fly.toP, k);
                controls.target.lerpVectors(fly.fromT, fly.toT, k);
                if (fly.t >= 1) { fly = null; controls.enabled = true; }
            } else if (sel) {
                // follow the open orb as it drifts with the year
                sel.node.getWorldPosition(tmp);
                tmp2.subVectors(tmp, lastOrb);
                camera.position.add(tmp2);
                controls.target.add(tmp2);
                lastOrb.copy(tmp);
            }
            controls.update();

            const offTarget = sel ? 1 : 0;
            const prev = state.offset;
            state.offset += (offTarget - state.offset) * Math.min(1, dt * 3.5);
            if (state.offset < 0.001) state.offset = 0;
            if (state.offset !== prev) applyViewOffset();

            layoutLabels(sel, breathe);

            if (lite) renderer.render(scene, camera); else composer.render();
        }

        // ---------------- HTML labels with depth occlusion ----------------
        // Labels are HTML (sharp text), so they would always draw over the canvas. Each frame
        // every label gets a mask with a soft hole wherever an orb or the core is closer to the
        // camera than the label's own object, so text hides behind planets like the 3D does.
        const screenObjs = domains.map(() => ({ x: 0, y: 0, r: 0, dist: 0, visible: false }));
        const coreScreen = { x: 0, y: 0, r: 0, dist: 0, visible: false };

        function toScreen(worldPos, radius, out, k) {
            projected.copy(worldPos).project(camera);
            out.visible = projected.z <= 1;
            out.dist = worldPos.distanceTo(camera.position);
            out.x = (projected.x * 0.5 + 0.5) * W;
            out.y = (-projected.y * 0.5 + 0.5) * H;
            out.r = (radius / out.dist) * k * (H / 2);
            return out;
        }

        function occlusionMask(left, top, w, h, depth, self) {
            const holes = [];
            const test = (o) => {
                if (o === self || !o.visible || o.dist >= depth - 1) return;
                const r = o.r * 1.02;
                // skip occluders whose disc does not touch the label box
                if (o.x + r < left || o.x - r > left + w || o.y + r < top || o.y - r > top + h) return;
                const lx = (o.x - left).toFixed(1), ly = (o.y - top).toFixed(1);
                holes.push(`radial-gradient(circle ${r.toFixed(1)}px at ${lx}px ${ly}px, transparent ${(r - 1).toFixed(1)}px, #000 ${(r + 2).toFixed(1)}px)`);
            };
            screenObjs.forEach(test);
            test(coreScreen);
            return holes.length ? holes.join(', ') : 'none';
        }

        function setMask(node, mask) {
            if (node._mask === mask) return;
            node._mask = mask;
            node.style.webkitMaskImage = mask;
            node.style.maskImage = mask;
        }

        function layoutLabels(sel, breathe) {
            camera.updateMatrixWorld();
            const k = fovK();

            // 1. project everything (no DOM writes yet)
            domains.forEach((d, i) => {
                d.node.getWorldPosition(tmp);
                toScreen(tmp, ORB_R, screenObjs[i], k);
            });
            toScreen(tmp.set(0, 0, 0), state.coreSize * breathe, coreScreen, k);
            const energy = coreMat.uniforms.uEnergy.value;
            const coreFont = 24 + 10 * energy + 4 * state.flare;
            ui.coreLabel.style.fontSize = coreFont.toFixed(1) + 'px';

            // 2. read label sizes once
            const sizes = domains.map(d => [d.label.offsetWidth, d.label.offsetHeight]);
            const coreSize = [ui.coreLabel.offsetWidth, ui.coreLabel.offsetHeight];

            // 3. write positions, opacity and occlusion masks
            domains.forEach((d, i) => {
                const s = screenObjs[i];
                if (!s.visible) { d.label.style.opacity = 0; return; }
                const [w, h] = sizes[i];
                const left = s.x - w / 2;
                const top = s.y + s.r * 1.25 + 10;
                d.label.style.transform = `translate(${left.toFixed(1)}px, ${top.toFixed(1)}px)`;
                d.label.style.opacity = (0.2 + 0.8 * d.dim).toFixed(3);
                setMask(d.label, occlusionMask(left, top, w, h, s.dist, s));
                d.anchor.style.transform = `translate(${(s.x - s.r).toFixed(1)}px, ${(s.y - s.r).toFixed(1)}px)`;
                d.circle.style.width = d.circle.style.height = (s.r * 2).toFixed(1) + 'px';
            });

            // "Cyberdelics" wordmark under the core: grows with the year, steps back when a field is open
            if (!coreScreen.visible) {
                ui.coreLabel.style.opacity = 0;
            } else {
                const [w, h] = coreSize;
                const left = coreScreen.x - w / 2;
                const top = coreScreen.y + (coreScreen.r / breathe) * 1.6 + 12;
                ui.coreLabel.style.transform = `translate(${left.toFixed(1)}px, ${top.toFixed(1)}px)`;
                ui.coreLabel.style.opacity = (sel ? 0.3 : 0.75 + 0.25 * energy).toFixed(3);
                setMask(ui.coreLabel, occlusionMask(left, top, w, h, coreScreen.dist, coreScreen));
            }
        }

        state.year = state.targetYear;
        setYear(state.targetYear);

        function destroy() {
            cleanups.forEach(fn => fn());
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
        }

        return {
            frame, resize, setYear, back, destroy,
            togglePlay: () => (state.playing ? stopPlay() : startPlay()),
            stopPlay,
            step: dir => { stopPlay(); setYear(state.targetYear + dir); },
            isOpen: () => state.selected !== null,
            zoomTo: id => { const i = domains.findIndex(d => d.id === id); if (i >= 0) zoomTo(i); },
            reset: () => { stopPlay(); back(); setYear(opts.startYear || START); }
        };
    }

    // ------------------------------------------------------------------
    // ENGINE DEFINITION
    // ------------------------------------------------------------------
    window.SimulationEngines['CyberdelicConvergence'] = {
        name: 'Cyberdelic Convergence',
        showPlaybackControls: false,

        defaults: { year: START },

        // The engine draws its own timeline dock, so the host builds no slider.
        config: [],

        init: function (container, params) {
            this._data = (params && params.data && params.data.domains) ? params.data : window.CyberdelicData;
            if (!this._data) {
                console.error('[CyberdelicConvergence] CyberdelicData not loaded!');
                return;
            }
            this._container = container;
            this._destroyed = false;
            this._nebula = null;
            this._startYear = (params && Number(params.year)) || START;

            container.querySelectorAll(':scope > .cn3d').forEach(n => n.remove());
            this._ui = buildShell();
            container.appendChild(this._ui.root);
            if (getComputedStyle(container).position === 'static') container.style.position = 'relative';

            const qs = new URLSearchParams(location.search);
            if (Number(qs.get('year'))) this._startYear = Number(qs.get('year'));
            const lite = qs.has('lite') ||
                (window.matchMedia('(pointer: coarse)').matches && Math.min(window.innerWidth, window.innerHeight) < 600);

            this._bindUi();

            loadDeps().then(() => {
                if (this._destroyed) return;
                this._nebula = createNebula(container, this._ui, this._data, { lite, startYear: this._startYear });
                this._ui.status.remove();
                const open = qs.get('open');
                if (open) setTimeout(() => this._nebula && this._nebula.zoomTo(open), 300);
                this.initTutorial();
                console.log('[CyberdelicConvergence] 3D nebula initialized');
            }).catch(err => {
                console.error('[CyberdelicConvergence] Could not load three.js add-ons', err);
                this._ui.status.textContent = 'The 3D view could not load. Check your connection and reload the page.';
                this._ui.status.classList.add('error');
            });
        },

        // Host calls this every frame (dt in seconds)
        update: function (dt) {
            if (this._nebula) this._nebula.frame(dt);
        },

        resize: function () {
            if (this._nebula) this._nebula.resize();
        },

        reset: function () {
            if (this._nebula) this._nebula.reset();
        },

        destroy: function () {
            this._destroyed = true;
            if (this._keyHandler) window.removeEventListener('keydown', this._keyHandler);
            if (this._nebula) this._nebula.destroy();
            if (this.tutorialOverlay && typeof this.tutorialOverlay.destroy === 'function') this.tutorialOverlay.destroy();
            if (this._ui) this._ui.root.remove();
            this._nebula = null;
        },

        // ========== UI WIRING (help, keys) ==========

        _bindUi: function () {
            const ui = this._ui;
            ui.helpBtn.addEventListener('click', () => this.toggleHelp());
            ui.close.addEventListener('click', () => this.toggleHelp(false));
            ui.restart.addEventListener('click', () => { this.toggleHelp(false); this.startTutorial(); });

            // Keys only act while the pointer is over the simulation or focus is inside it,
            // so arrow keys and Space keep working normally elsewhere on a lesson page.
            let pointerInside = false;
            ui.root.addEventListener('pointerenter', () => { pointerInside = true; });
            ui.root.addEventListener('pointerleave', () => { pointerInside = false; });

            this._keyHandler = (e) => {
                if (!this._nebula) return;
                if (!pointerInside && !ui.root.contains(document.activeElement)) return;
                const tag = e.target && e.target.tagName;
                if (tag === 'INPUT' && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) return;
                if (tag === 'TEXTAREA') return;
                switch (e.key) {
                    case 'ArrowLeft': e.preventDefault(); this._nebula.step(-1); break;
                    case 'ArrowRight': e.preventDefault(); this._nebula.step(1); break;
                    case ' ':
                        if (tag === 'BUTTON' || tag === 'A') return;
                        e.preventDefault();
                        this._nebula.togglePlay();
                        break;
                    case 'Escape':
                        if (ui.help.classList.contains('open')) this.toggleHelp(false);
                        else this._nebula.back();
                        break;
                    case 'h': case 'H': case '?':
                        this.toggleHelp();
                        break;
                }
            };
            window.addEventListener('keydown', this._keyHandler);
        },

        toggleHelp: function (force) {
            const help = this._ui && this._ui.help;
            if (!help) return;
            const open = force !== undefined ? force : !help.classList.contains('open');
            help.classList.toggle('open', open);
            help.setAttribute('aria-hidden', String(!open));
            if (open) this._ui.close.focus({ preventScroll: true });
        },

        // ========== TUTORIAL ==========

        tutorialOverlay: null,

        initTutorial: function () {
            if (typeof TutorialOverlay === 'undefined') return; // not every page loads tutorial-overlay.js
            if (!this.tutorialOverlay) this.tutorialOverlay = new TutorialOverlay(this._container);
            setTimeout(() => { if (!this._destroyed) this.startTutorial(); }, 1000);
        },

        startTutorial: function () {
            if (!this._data.tutorialSteps || !this.tutorialOverlay) return;
            const steps = this._data.tutorialSteps.map(step => {
                let target = step.target;
                if (typeof target === 'string') {
                    const found = this._ui.root.querySelector(target);
                    if (found) target = found;
                }
                return { ...step, target };
            });
            this.tutorialOverlay.start(steps);
        }
    };

})();
