/**
 * Presence & Embodiment - Simulation Engine
 */
(function () {
    'use strict';

    window.SimulationEngines = window.SimulationEngines || {};

    const SLIDER_INFO = {
        s1: { name: "Body-Environment Synchrony", text: "How accurately and immediately the virtual environment responds to the client's physical movements. High synchrony means when they turn their head, the world turns with them instantly. Low synchrony creates a lag — the nervous system detects the mismatch and resists accepting the environment as real." },
        s2: { name: "Environmental Responsiveness", text: "Whether the virtual environment reacts to the client's presence and actions, or simply plays on around them. A static environment is experienced passively, like watching a film. A participatory environment responds — objects react, the space acknowledges the client is there." },
        s3: { name: "Avatar Type", text: "The kind of body representation the client has inside the experience. At one end: no visible body, purely a floating viewpoint. At the other: a full synchronized avatar that mirrors the client's actual movements. The avatar is the primary driver of Body Ownership Illusion — the felt sense that the virtual body is one's own." },
        s4: { name: "Multi-Sensory Coherence", text: "How well the different sensory channels — visual, spatial audio, movement, haptic — reinforce the same reality rather than conflicting. When sensory channels conflict, the nervous system detects inconsistency and reduces its acceptance of both the body and the environment as real." },
        s5: { name: "Pre-Session Preparation", text: "The quality of practitioner-client work before the headset goes on. Thorough preparation improves both presence and embodiment — not by changing the technology, but by reducing the cognitive and emotional resistance that prevents the nervous system from accepting the session as real." }
    };

    const PROFILES = [
        { id: 0, name: "Adrift", pLo: 0, pHi: 35, eLo: 0, eHi: 35, pdot: 'low', edot: 'low', quote: '"I felt like I was watching a screen. Nothing landed. I kept noticing the headset."' },
        { id: 1, name: "The Open Field", pLo: 65, pHi: 100, eLo: 0, eHi: 35, pdot: 'high', edot: 'low', quote: '"I was completely transported — but there was no me there. Just the space. I floated through it."' },
        { id: 2, name: "Stage Set", pLo: 0, pHi: 35, eLo: 65, eHi: 100, pdot: 'low', edot: 'high', quote: '"The body felt real but the world kept reminding me it wasn\'t. Like being a character on a set."' },
        { id: 3, name: "Full Immersion", pLo: 65, pHi: 100, eLo: 65, eHi: 100, pdot: 'high', edot: 'high', quote: '"I was completely there. That was my body. The space responded to me. I stopped thinking about the headset."' },
        { id: 4, name: "Floating Through", pLo: 65, pHi: 100, eLo: 36, eHi: 64, pdot: 'high', edot: 'mid', quote: '"I was in the space but only loosely in my body. Like drifting through it — present but weightless."' },
        { id: 5, name: "Inhabited Stage", pLo: 36, pHi: 64, eLo: 65, eHi: 100, pdot: 'mid', edot: 'high', quote: '"The body felt very real — but the environment kept flickering. Present in my body, but not quite in a place."' }
    ];

    window.SimulationEngines['PresenceEmbodimentSim'] = {
        name: 'Presence Embodiment Sim',
        showPlaybackControls: false,
        config: [], // Empty to prevent default controls

        init: function (container, params, host) {
            if (typeof THREE === 'undefined') {
                console.error('[PresenceEmbodimentSim] THREE.js is required but not loaded.');
                return;
            }

            this.container = container.closest('.interactive-simulation-container') || container;
            this.host = host;
            this.container.innerHTML = '';

            this.state = {
                pNow: 0, eNow: 0,
                pTarget: 0, eTarget: 0,
                activeProfile: -1,
                firstFrame: true,
                clock: new THREE.Clock(),
                orbitAngle: 0,
                SLIDERS: { s1: { type: 'p', w: 0.45 }, s2: { type: 'p', w: 0.40 }, s3: { type: 'e', w: 0.50 }, s4: { type: 'e', w: 0.38 }, s5: { type: 'b', w: 0.22 } }
            };

            this._buildLayout();
            this._setupThreeJS();
            this._bindEvents();
            this.recalc();
            this.resize(this.container.clientWidth, this.container.clientHeight);
            
            const s1El = this.container.querySelector('#s1');
            if (s1El) this.onSliderInput(s1El);
            
            console.log('[PresenceEmbodimentSim] Initialized');
        },

        _buildLayout: function () {
            const wrapper = document.createElement('div');
            wrapper.className = 'pes-app';
            wrapper.style.flex = '1'; // Ensure it takes available space in the new flex column
            wrapper.innerHTML = `
                    <div class="hdr">
                        <span class="hdr-label">Module 3.2</span>
                        <h1>Presence &amp; Embodiment Explorer</h1>
                        <p class="hdr-sub">Adjust session parameters and observe how the client's state shifts across two independent axes.</p>
                    </div>

                    <div class="pes-grid">
                        <div class="left-col" style="display: flex; flex-direction: column; gap: 20px; min-width: 0;">
                            <div class="viewer">
                                <div class="viewer-bar">
                                    <span class="viewer-bar-label">Session View</span>
                                    <div class="viewer-meters">
                                        <div class="v-meter pres">
                                            <div class="v-meter-dot"></div>
                                            <div class="v-meter-track"><div class="v-meter-fill" id="pm" style="width:0%"></div></div>
                                            <span class="v-meter-num" id="pn">0%</span>
                                        </div>
                                        <div class="v-meter emb">
                                            <div class="v-meter-dot"></div>
                                            <div class="v-meter-track"><div class="v-meter-fill" id="em" style="width:0%"></div></div>
                                            <span class="v-meter-num" id="en">0%</span>
                                        </div>
                                    </div>
                                </div>

                                <div class="canvas-wrap" id="canvasWrap">
                                    <div class="load-overlay" id="loadOverlay">
                                        <div class="load-dots">
                                            <div class="load-dot"></div><div class="load-dot"></div><div class="load-dot"></div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div class="stages-frame">
                                <div class="profile-strip" id="pstrip">
                                    <div class="profile-pip"></div>
                                    <div class="profile-text">
                                        <div class="profile-idle" id="pidle">Adjust parameters to discover session states...</div>
                                        <div class="profile-name" id="pname"></div>
                                        <div class="profile-quote" id="pquote"></div>
                                    </div>
                                </div>

                                <div class="profiles-grid">
                                    <div class="profiles-grid-hdr">Six States to Discover</div>
                                    <div class="pg-items" id="pgrid"></div>
                                </div>
                            </div>

                            <div class="slider-desc-panel" id="descPanel">
                                <div class="slider-desc-idle" id="descIdle">Touch a slider to learn what it controls...</div>
                                <div class="slider-desc-name" id="descName"></div>
                                <div class="slider-desc-text" id="descText"></div>
                            </div>
                        </div>

                        <div class="controls">
                            <div class="ctrl-section pres">
                                <div class="ctrl-section-hdr">
                                    <div class="ctrl-section-pip"></div>
                                    <span class="ctrl-section-label">Presence — The Space</span>
                                </div>
                                <div class="slider-row">
                                    <div class="slider-top"><span class="slider-name">Body-Environment Synchrony</span></div>
                                    <div class="slider-ends"><span>Sluggish</span><span>Instantaneous</span></div>
                                    <input type="range" class="p-range" id="s1" min="0" max="100" value="75" style="--v:75">
                                </div>
                                <div class="slider-row">
                                    <div class="slider-top"><span class="slider-name">Environmental Responsiveness</span></div>
                                    <div class="slider-ends"><span>Static</span><span>Participatory</span></div>
                                    <input type="range" class="p-range" id="s2" min="0" max="100" value="20" style="--v:20">
                                </div>
                            </div>

                            <div class="ctrl-section emb">
                                <div class="ctrl-section-hdr">
                                    <div class="ctrl-section-pip"></div>
                                    <span class="ctrl-section-label">Embodiment — The Body</span>
                                </div>
                                <div class="slider-row">
                                    <div class="slider-top"><span class="slider-name">Avatar Type</span></div>
                                    <div class="slider-ends"><span>No Body</span><span>Synchronized</span></div>
                                    <input type="range" class="e-range" id="s3" min="0" max="100" value="15" style="--v:15">
                                </div>
                                <div class="slider-row">
                                    <div class="slider-top"><span class="slider-name">Multi-Sensory Coherence</span></div>
                                    <div class="slider-ends"><span>Fragmented</span><span>Unified</span></div>
                                    <input type="range" class="e-range" id="s4" min="0" max="100" value="15" style="--v:15">
                                </div>
                            </div>

                            <div class="ctrl-section both">
                                <div class="ctrl-section-hdr">
                                    <div class="ctrl-section-pip"></div>
                                    <span class="ctrl-section-label">Affects Both</span>
                                </div>
                                <div class="slider-row">
                                    <div class="slider-top"><span class="slider-name">Pre-Session Preparation</span></div>
                                    <div class="slider-ends"><span>None</span><span>Thorough</span></div>
                                    <input type="range" class="b-range" id="s5" min="0" max="100" value="15" style="--v:15">
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            this.container.appendChild(wrapper);

            // Build profile grid
            const pgrid = wrapper.querySelector('#pgrid');
            PROFILES.forEach(pr => {
                const pd = v => v === 'high' ? 'var(--p-mid)' : v === 'mid' ? 'rgba(167,139,250,0.45)' : 'rgba(167,139,250,0.15)';
                const ed = v => v === 'high' ? 'var(--e-mid)' : v === 'mid' ? 'rgba(45,212,191,0.45)' : 'rgba(45,212,191,0.15)';
                pgrid.innerHTML += `<div class="pg-item" id="pg${pr.id}">
                    <div class="pg-dots">
                        <div class="pg-dot" style="background:${pd(pr.pdot)}"></div>
                        <div class="pg-dot" style="background:${ed(pr.edot)}"></div>
                    </div>
                    <div class="pg-item-name">${pr.name}</div>
                </div>`;
            });
        },

        _setupThreeJS: function () {
            const wrap = this.container.querySelector('#canvasWrap');
            if (!wrap) return;

            this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
            this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
            this.renderer.setClearColor(0x060810, 1);
            wrap.appendChild(this.renderer.domElement);

            this.scene = new THREE.Scene();
            this.camera = new THREE.PerspectiveCamera(55, 1, 0.1, 200);
            this.camera.position.set(0, 2.5, 9);
            this.camera.lookAt(0, 1, 0);

            // Lighting
            this.ambientLight = new THREE.AmbientLight(0x1a0a2e, 1.0);
            this.scene.add(this.ambientLight);

            this.presenceLight = new THREE.PointLight(0x7c3aed, 0, 30);
            this.presenceLight.position.set(0, 3, 4);
            this.scene.add(this.presenceLight);

            this.embodimentLight = new THREE.PointLight(0x0d9488, 0, 20);
            this.embodimentLight.position.set(0, 2, 0);
            this.scene.add(this.embodimentLight);

            const rimLight = new THREE.DirectionalLight(0x4a1d8c, 0.3);
            rimLight.position.set(-5, 5, -3);
            this.scene.add(rimLight);

            // Body Particles
            const bodyPositions = this._buildBodyPositions(3200);
            this.actualCount = bodyPositions.length / 3;

            this.bodyGeo = new THREE.BufferGeometry();
            const bodyPos = new Float32Array(bodyPositions);
            this.bodyRest = new Float32Array(bodyPositions);
            const bodyColors = new Float32Array(this.actualCount * 3);
            this.bodyScatter = new Float32Array(this.actualCount * 3);

            for (let i = 0; i < this.actualCount; i++) {
                this.bodyScatter[i * 3] = (Math.random() - 0.5) * 4;
                this.bodyScatter[i * 3 + 1] = (Math.random() - 0.5) * 4;
                this.bodyScatter[i * 3 + 2] = (Math.random() - 0.5) * 4;
                bodyColors[i * 3] = 0.1; bodyColors[i * 3 + 1] = 0.6; bodyColors[i * 3 + 2] = 0.65;
            }

            this.bodyGeo.setAttribute('position', new THREE.BufferAttribute(bodyPos, 3));
            this.bodyGeo.setAttribute('color', new THREE.BufferAttribute(bodyColors, 3));

            this.bodyMat = new THREE.PointsMaterial({
                size: 0.045, vertexColors: true, transparent: true, opacity: 0.15,
                depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true
            });

            const bodyParticles = new THREE.Points(this.bodyGeo, this.bodyMat);
            bodyParticles.position.y = -1.2;
            this.scene.add(bodyParticles);

            // Environment Particles
            this.ENV_COUNT = 1800;
            this.envGeo = new THREE.BufferGeometry();
            const envPos = new Float32Array(this.ENV_COUNT * 3);
            const envColors = new Float32Array(this.ENV_COUNT * 3);
            this.envSpeeds = new Float32Array(this.ENV_COUNT);
            this.envPhases = new Float32Array(this.ENV_COUNT);

            for (let i = 0; i < this.ENV_COUNT; i++) {
                const r = 3.5 + Math.random() * 5;
                const theta = Math.random() * Math.PI * 2;
                const phi = Math.acos(2 * Math.random() - 1);
                envPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
                envPos[i * 3 + 1] = (Math.random() - 0.3) * 8;
                envPos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
                envColors[i * 3] = 0.35; envColors[i * 3 + 1] = 0.15; envColors[i * 3 + 2] = 0.75;
                this.envSpeeds[i] = 0.2 + Math.random() * 0.4;
                this.envPhases[i] = Math.random() * Math.PI * 2;
            }

            this.envGeo.setAttribute('position', new THREE.BufferAttribute(envPos, 3));
            this.envGeo.setAttribute('color', new THREE.BufferAttribute(envColors, 3));

            this.envMat = new THREE.PointsMaterial({
                size: 0.035, vertexColors: true, transparent: true, opacity: 0.0,
                depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true
            });

            const envParticles = new THREE.Points(this.envGeo, this.envMat);
            this.scene.add(envParticles);

            // Floor Grid
            this.gridHelper = new THREE.GridHelper(24, 24, 0x3d1f8a, 0x1e0f45);
            this.gridHelper.position.y = -2.5;
            this.gridHelper.material.transparent = true;
            this.gridHelper.material.opacity = 0.0;
            this.scene.add(this.gridHelper);

            // Merkaba (Star Tetrahedron)
            this.merkabaGroup = new THREE.Group();
            // Position slightly lower to better frame the head and feet
            this.merkabaGroup.position.y = 1.05;

            // Sized perfectly to place head near top point and feet near bottom point
            const tetRadius = 3.5;
            const tetGeo1 = new THREE.TetrahedronGeometry(tetRadius);
            const tetGeo2 = new THREE.TetrahedronGeometry(tetRadius);

            // 1. Make tetGeo2 the exact dual of tetGeo1 (creates perfect Star Tetrahedron)
            tetGeo2.rotateX(Math.PI / 2);

            // 2. Rotate both so that one point focuses perfectly UP (on Y axis) and one perfectly DOWN
            const rotY = Math.PI / 4;
            const rotZ = Math.atan(Math.sqrt(2));
            tetGeo1.rotateY(rotY);
            tetGeo1.rotateZ(rotZ);
            tetGeo2.rotateY(rotY);
            tetGeo2.rotateZ(rotZ);

            const edges1 = new THREE.EdgesGeometry(tetGeo1);
            const edges2 = new THREE.EdgesGeometry(tetGeo2);

            this.merkabaMat = new THREE.LineBasicMaterial({
                color: 0xa78bfa,
                transparent: true,
                opacity: 0,
                blending: THREE.AdditiveBlending
            });

            const tet1 = new THREE.LineSegments(edges1, this.merkabaMat);
            const tet2 = new THREE.LineSegments(edges2, this.merkabaMat);

            this.merkabaGroup.add(tet1);
            this.merkabaGroup.add(tet2);
            this.scene.add(this.merkabaGroup);

            // Background Trees for Space
            this.treeGeo = new THREE.BufferGeometry();
            const treePts = [];

            for (let t = 0; t < 60; t++) { // Increased tree count from 30 to 60
                const tx = (Math.random() - 0.5) * 45;
                const tz = (Math.random() - 0.5) * 45;
                // Avoid placing trees too close to the avatar
                if (Math.abs(tx) < 4.5 && Math.abs(tz) < 4.5) continue;

                const height = 3.5 + Math.random() * 4.5;
                const bRadius = 1.2 + Math.random() * 0.8;

                for (let p = 0; p < 240; p++) { // Increased particle count per tree from 120 to 240
                    const h = Math.random() * height;
                    const r = (1 - h / height) * bRadius;
                    const ang = Math.random() * Math.PI * 2;
                    // Slightly randomize particle placement for organic feel
                    treePts.push(
                        tx + Math.cos(ang) * r + (Math.random() - 0.5) * 0.3,
                        -2.5 + h,
                        tz + Math.sin(ang) * r + (Math.random() - 0.5) * 0.3
                    );
                }
            }
            this.treeGeo.setAttribute('position', new THREE.Float32BufferAttribute(treePts, 3));

            this.treeMat = new THREE.PointsMaterial({
                size: 0.1, color: 0x5eead4, transparent: true, opacity: 0, // Brighter color and larger size
                depthWrite: false, blending: THREE.AdditiveBlending
            });
            this.treeGroup = new THREE.Points(this.treeGeo, this.treeMat);
            this.scene.add(this.treeGroup);

            // Grass Particles for Space
            this.grassGeo = new THREE.BufferGeometry();
            const grassPts = [];
            for (let g = 0; g < 4000; g++) {
                const gx = (Math.random() - 0.5) * 50;
                const gz = (Math.random() - 0.5) * 50;
                if (Math.abs(gx) < 2.5 && Math.abs(gz) < 2.5) continue; // Keep avatar stand clear

                grassPts.push(gx, -2.5 + Math.random() * 0.15, gz);
            }
            this.grassGeo.setAttribute('position', new THREE.Float32BufferAttribute(grassPts, 3));

            this.grassMat = new THREE.PointsMaterial({
                size: 0.05, color: 0x2dd4bf, transparent: true, opacity: 0,
                depthWrite: false, blending: THREE.AdditiveBlending
            });
            this.grassGroup = new THREE.Points(this.grassGeo, this.grassMat);
            this.scene.add(this.grassGroup);

            // Chakras
            this.chakras = [];
            const chakraColors = [
                0xff0000, // Root
                0xff7f00, // Sacral
                0xffff00, // Solar Plexus
                0x00ff00, // Heart
                0x00ddff, // Throat
                0x4b0082, // Third Eye
                0x8a2be2  // Crown
            ];
            // Y positions matched to body particle map
            const chakraYPositions = [0.2, 0.8, 1.4, 2.1, 2.8, 3.5, 3.8];

            const chakraGeo = new THREE.BufferGeometry();
            const chPts = [];
            for (let i = 0; i < 120; i++) {
                const r = Math.cbrt(Math.random()) * 0.12;
                const theta = Math.random() * 2 * Math.PI;
                const phi = Math.acos(2 * Math.random() - 1);
                chPts.push(r * Math.sin(phi) * Math.cos(theta), r * Math.sin(phi) * Math.sin(theta), r * Math.cos(phi));
            }
            chakraGeo.setAttribute('position', new THREE.Float32BufferAttribute(chPts, 3));

            this.chakrasGroup = new THREE.Group();
            this.chakrasGroup.position.y = -1.2;

            chakraColors.forEach((colorHex, idx) => {
                const mat = new THREE.PointsMaterial({
                    size: 0.05, color: new THREE.Color(colorHex), transparent: true, opacity: 0,
                    depthWrite: false, blending: THREE.AdditiveBlending
                });
                const pts = new THREE.Points(chakraGeo, mat);
                pts.position.y = chakraYPositions[idx];
                this.chakras.push({ mesh: pts, baseMat: mat });
                this.chakrasGroup.add(pts);
            });
            this.scene.add(this.chakrasGroup);

            this.scene.fog = new THREE.FogExp2(0x060810, 0.045);
            this.resizeRenderer();
        },

        _buildBodyPositions: function (count) {
            const pts = [];
            function addEllipsoid(cx, cy, cz, rx, ry, rz, n, scatter) {
                for (let i = 0; i < n; i++) {
                    const u = Math.random() * Math.PI * 2;
                    const v = Math.acos(2 * Math.random() - 1);
                    const r = 0.7 + Math.random() * 0.3;
                    const nx = cx + rx * r * Math.sin(v) * Math.cos(u) + (Math.random() - 0.5) * scatter;
                    const ny = cy + ry * r * Math.sin(v) * Math.sin(u) + (Math.random() - 0.5) * scatter;
                    const nz = cz + rz * r * Math.cos(v) + (Math.random() - 0.5) * scatter;
                    pts.push(nx, ny, nz);
                }
            }
            function addCylinder(cx, cy, cz, rx, rz, h, n, scatter) {
                for (let i = 0; i < n; i++) {
                    const a = Math.random() * Math.PI * 2;
                    const yr = (Math.random() - 0.5) * h;
                    const xr = (0.6 + Math.random() * 0.4) * rx;
                    const zr = (0.6 + Math.random() * 0.4) * rz;
                    pts.push(cx + xr * Math.cos(a) + (Math.random() - 0.5) * scatter, cy + yr, cz + zr * Math.sin(a) + (Math.random() - 0.5) * scatter);
                }
            }
            const sc = 0.08;
            addEllipsoid(0, 3.5, 0, 0.55, 0.62, 0.5, Math.floor(count * 0.12), sc); // Head
            addCylinder(0, 2.82, 0, 0.18, 0.18, 0.35, Math.floor(count * 0.03), sc * 0.5); // Neck
            addEllipsoid(0, 2.1, 0, 0.7, 0.75, 0.42, Math.floor(count * 0.18), sc); // Torso upper
            addEllipsoid(0, 1.3, 0, 0.62, 0.55, 0.38, Math.floor(count * 0.12), sc); // Torso lower
            addEllipsoid(0, 0.7, 0, 0.68, 0.35, 0.4, Math.floor(count * 0.08), sc); // Hips

            // Shoulders (rounded ellipsoids instead of harsh cylinders)
            addEllipsoid(-0.9, 2.35, 0, 0.28, 0.28, 0.3, Math.floor(count * 0.04), sc);
            addEllipsoid(0.9, 2.35, 0, 0.28, 0.28, 0.3, Math.floor(count * 0.04), sc);

            // Arms
            addCylinder(-1.1, 1.8, 0, 0.2, 0.2, 0.6, Math.floor(count * 0.04), sc);
            addCylinder(-1.2, 1.3, 0, 0.18, 0.16, 0.6, Math.floor(count * 0.04), sc);
            addCylinder(1.1, 1.8, 0, 0.2, 0.2, 0.6, Math.floor(count * 0.04), sc);
            addCylinder(1.2, 1.3, 0, 0.18, 0.16, 0.6, Math.floor(count * 0.04), sc);

            // Legs
            addCylinder(-0.38, 0.0, 0, 0.28, 0.24, 0.7, Math.floor(count * 0.06), sc);
            addCylinder(0.38, 0.0, 0, 0.28, 0.24, 0.7, Math.floor(count * 0.06), sc);
            addCylinder(-0.4, -0.78, 0, 0.2, 0.18, 0.7, Math.floor(count * 0.05), sc);
            addCylinder(0.4, -0.78, 0, 0.2, 0.18, 0.7, Math.floor(count * 0.05), sc);
            addEllipsoid(-0.38, -1.28, 0.1, 0.2, 0.12, 0.38, Math.floor(count * 0.03), sc * 0.5);
            addEllipsoid(0.38, -1.28, 0.1, 0.2, 0.12, 0.38, Math.floor(count * 0.03), sc * 0.5);
            return pts;
        },

        _bindEvents: function () {
            Object.keys(this.state.SLIDERS).forEach(id => {
                const el = this.container.querySelector('#' + id);
                if (el) {
                    el.addEventListener('input', () => this.onSliderInput(el));
                }
            });
        },

        onSliderInput: function (el) {
            el.style.setProperty('--v', el.value);
            const info = SLIDER_INFO[el.id];
            if (info) {
                const panel = this.container.querySelector('#descPanel');
                if (panel) panel.classList.add('has-content');
                const idle = this.container.querySelector('#descIdle');
                if (idle) idle.style.display = 'none';

                const name = this.container.querySelector('#descName');
                const text = this.container.querySelector('#descText');
                if (name) name.textContent = info.name;
                if (text) text.textContent = info.text;
            }
            this.recalc();
        },

        recalc: function () {
            let pS = 0, pW = 0, eS = 0, eW = 0;
            for (const [id, cfg] of Object.entries(this.state.SLIDERS)) {
                const el = this.container.querySelector('#' + id);
                if (!el) continue;
                const v = +el.value;
                if (cfg.type === 'p' || cfg.type === 'b') { pS += v * cfg.w; pW += cfg.w; }
                if (cfg.type === 'e' || cfg.type === 'b') { eS += v * cfg.w; eW += cfg.w; }
            }
            this.state.pTarget = Math.min(100, Math.round(pS / pW));
            this.state.eTarget = Math.min(100, Math.round(eS / eW));
            this.detectProfile();
        },

        detectProfile: function () {
            let found = -1;
            for (const pr of PROFILES) {
                if (this.state.pTarget >= pr.pLo && this.state.pTarget <= pr.pHi && this.state.eTarget >= pr.eLo && this.state.eTarget <= pr.eHi) { found = pr.id; break; }
            }
            if (found === this.state.activeProfile) return;
            this.state.activeProfile = found;

            const strip = this.container.querySelector('#pstrip');
            const idle = this.container.querySelector('#pidle');
            const pname = this.container.querySelector('#pname');
            const pquote = this.container.querySelector('#pquote');

            if (found >= 0) {
                const pr = PROFILES[found];
                if (strip) strip.classList.add('active');
                if (idle) idle.style.display = 'none';
                if (pname) pname.textContent = pr.name;
                if (pquote) pquote.textContent = pr.quote;
            } else {
                if (strip) strip.classList.remove('active');
                if (idle) idle.style.display = '';
                if (pname) pname.textContent = '';
                if (pquote) pquote.textContent = '';
            }

            PROFILES.forEach(pr => {
                const el = this.container.querySelector('#pg' + pr.id);
                if (el) el.classList.toggle('lit', pr.id === found);
            });
        },

        resizeRenderer: function () {
            const wrap = this.container.querySelector('#canvasWrap');
            if (!wrap || !this.renderer) return;
            const r = wrap.getBoundingClientRect();
            if (r.width === 0 || r.height === 0) return;
            this.renderer.setSize(r.width, r.height, false);
            this.camera.aspect = r.width / r.height;
            this.camera.updateProjectionMatrix();
        },

        // Framework hook
        resize: function (width, height) {
            this.resizeRenderer();
        },

        // Framework hook - replaces internal requestAnimationFrame
        draw: function (dt, params) {
            if (!this.renderer || !this.scene || !this.camera) return;

            const delta = this.state.clock.getDelta();
            const elapsed = this.state.clock.getElapsedTime();

            // Smooth state
            const lerp = (a, b, t) => a + (b - a) * t;
            this.state.pNow = lerp(this.state.pNow, this.state.pTarget, 0.035);
            this.state.eNow = lerp(this.state.eNow, this.state.eTarget, 0.035);
            const pN = this.state.pNow / 100;
            const eN = this.state.eNow / 100;

            this.state.orbitAngle += delta * 0.12;
            const orbitR = 8.5;
            const orbitH = 2.0 + Math.sin(elapsed * 0.07) * 0.4;
            this.camera.position.x = Math.sin(this.state.orbitAngle) * orbitR;
            this.camera.position.z = Math.cos(this.state.orbitAngle) * orbitR;
            this.camera.position.y = orbitH;
            this.camera.lookAt(0, 1.2, 0);

            // Body Particles
            const positions = this.bodyGeo.attributes.position.array;
            const colors = this.bodyGeo.attributes.color.array;

            for (let i = 0; i < this.actualCount; i++) {
                const i3 = i * 3;
                const scatter = 1.0 - eN;
                const noiseT = elapsed * 0.5;
                const nx = this.bodyRest[i3] + this.bodyScatter[i3] * scatter * (0.6 + 0.4 * Math.sin(noiseT + i * 0.1));
                const ny = this.bodyRest[i3 + 1] + this.bodyScatter[i3 + 1] * scatter * (0.6 + 0.4 * Math.cos(noiseT + i * 0.13));
                const nz = this.bodyRest[i3 + 2] + this.bodyScatter[i3 + 2] * scatter * (0.6 + 0.4 * Math.sin(noiseT + i * 0.17));
                positions[i3] = lerp(positions[i3], nx, 0.06);
                positions[i3 + 1] = lerp(positions[i3 + 1], ny, 0.06);
                positions[i3 + 2] = lerp(positions[i3 + 2], nz, 0.06);

                colors[i3] = lerp(0.25, 0.0, eN);
                colors[i3 + 1] = lerp(0.18, 0.82, eN);
                colors[i3 + 2] = lerp(0.55, 0.72, eN);
            }
            this.bodyGeo.attributes.position.needsUpdate = true;
            this.bodyGeo.attributes.color.needsUpdate = true;

            this.bodyMat.opacity = 0.08 + eN * 0.78;
            this.bodyMat.size = 0.028 + eN * 0.038;

            // Environment Particles
            const ep = this.envGeo.attributes.position.array;
            const ec = this.envGeo.attributes.color.array;
            for (let i = 0; i < this.ENV_COUNT; i++) {
                const i3 = i * 3;
                ep[i3 + 1] += Math.sin(elapsed * this.envSpeeds[i] + this.envPhases[i]) * 0.002 * (1 + pN * 2);
                if (ep[i3 + 1] > 5) ep[i3 + 1] = -5;
                if (ep[i3 + 1] < -5) ep[i3 + 1] = 5;
                ec[i3] = lerp(0.2, 0.55, pN);
                ec[i3 + 1] = lerp(0.08, 0.2, pN);
                ec[i3 + 2] = lerp(0.45, 1.0, pN);
            }
            this.envGeo.attributes.position.needsUpdate = true;
            this.envGeo.attributes.color.needsUpdate = true;
            this.envMat.opacity = pN * 0.65;
            this.envMat.size = 0.022 + pN * 0.03;

            // Floor Grid
            this.gridHelper.material.opacity = pN * 0.55;
            this.gridHelper.position.y = -2.5 + Math.sin(elapsed * 0.3) * 0.04 * pN;

            // Grass Particle Animation
            if (this.grassGeo && this.grassMat) {
                const gp = this.grassGeo.attributes.position.array;
                for (let i = 0; i < 4000; i++) {
                    const i3 = i * 3;
                    gp[i3 + 1] = -2.5 + Math.sin(elapsed * 1.5 + gp[i3] * 2.0 + gp[i3 + 2] * 2.0) * 0.08 * pN;
                }
                this.grassGeo.attributes.position.needsUpdate = true;
            }

            // Fog
            this.scene.fog.density = lerp(0.09, 0.022, pN);

            // Lighting
            this.presenceLight.intensity = pN * 2.2;
            this.embodimentLight.intensity = eN * 3.0;
            this.ambientLight.intensity = 0.6 + pN * 0.4 + eN * 0.3;
            this.presenceLight.color.setRGB(lerp(0.3, 0.55, pN), lerp(0.1, 0.22, pN), lerp(0.7, 1.0, pN));
            this.embodimentLight.color.setRGB(lerp(0.0, 0.05, eN), lerp(0.4, 0.82, eN), lerp(0.5, 0.7, eN));

            // Merkaba & Chakras (Full immersion state)
            const immersionThreshold = 0.65;
            const immersionFactor = Math.max(0, Math.min(pN, eN) - immersionThreshold) / (1.0 - immersionThreshold);

            if (this.merkabaGroup && this.merkabaMat) {
                // Rotate the entire star tetrahedron group slowly along Y axis
                this.merkabaGroup.rotation.y = elapsed * 0.25;

                this.merkabaMat.opacity = immersionFactor * 0.65;
                const pulse = 1 + Math.sin(elapsed * 2) * 0.04 * immersionFactor;
                this.merkabaGroup.scale.setScalar(pulse);
            }

            if (this.treeMat) {
                // Trees appear as Presence (pN) increases
                const treeOpacity = Math.max(0, (pN - 0.3) / 0.7);
                this.treeMat.opacity = treeOpacity * 0.5;
                this.treeMat.size = 0.02 + pN * 0.04;
            }

            if (this.chakras) {
                this.chakras.forEach((ch, idx) => {
                    ch.baseMat.opacity = immersionFactor * (0.5 + 0.4 * Math.sin(elapsed * 2 + idx));
                    ch.mesh.rotation.y = elapsed * (1.0 + idx * 0.2);
                    ch.mesh.scale.setScalar(1 + 0.2 * Math.sin(elapsed * 4 + idx));
                });
            }

            // UI Meters
            const pm = this.container.querySelector('#pm');
            const em = this.container.querySelector('#em');
            const pn = this.container.querySelector('#pn');
            const en = this.container.querySelector('#en');
            if (pm) pm.style.width = this.state.pNow + '%';
            if (em) em.style.width = this.state.eNow + '%';
            if (pn) pn.textContent = Math.round(this.state.pNow) + '%';
            if (en) en.textContent = Math.round(this.state.eNow) + '%';

            this.renderer.render(this.scene, this.camera);

            if (this.state.firstFrame) {
                this.state.firstFrame = false;
                setTimeout(() => {
                    const l = this.container.querySelector('#loadOverlay');
                    if (l) l.classList.add('hidden');
                }, 400);
            }
        },

        // Clean up when simulation module is unmounted
        destroy: function () {
            if (this.renderer) {
                this.renderer.dispose();
                if (this.renderer.domElement && this.renderer.domElement.parentNode) {
                    this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
                }
            }
            this.scene = null;
            this.camera = null;
            this.renderer = null;
        }
    };
})();
