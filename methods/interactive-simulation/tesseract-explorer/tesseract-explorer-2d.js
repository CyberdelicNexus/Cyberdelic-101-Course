/**
 * Tesseract Explorer - Interactive Simulation Engine
 * Phase 1: 2D Functional Version (kept for reference; not loaded anywhere — tesseract-explorer.js replaces it)
 */

(function () {
    'use strict';

    window.SimulationEngines = window.SimulationEngines || {};

    // Get reference to external data
    const DATA = window.TesseractExplorerData;

    window.SimulationEngines['TesseractExplorer'] = {
        name: 'Tesseract Explorer',
        showPlaybackControls: false,

        // Engine default parameters
        defaults: {
            // Store selections for each dimension
            selections: {
                reality: [],
                sensory: [],
                presence: [],
                states: [],
                traits: [],
                meaning: { world: null, story: { from: null, toward: null }, magic: null }
            }
        },

        config: [], // Handled by custom UI

        // Instance State
        elements: {},
        activeDimension: null,
        isCompleted: false,

        // Lifecycle: Init
        init: function (container, params, host) {
            if (!DATA) {
                console.error('[TesseractExplorer] TesseractExplorerData not found.');
                container.innerHTML = '<div style="color:red; padding: 20px;">Error: Data logic missing.</div>';
                return;
            }

            this.params = params;
            this.host = host;

            // Generate Layout
            this._buildLayout(container);

            this._ensureThreeJS(() => {
                // Initialize 3D Scene
                this._init3DVisualization();

                // Setup Listeners
                this._bindEvents();

                // Set initial state
                this._selectDimension(DATA.dimensions[0].id);

                console.log('[TesseractExplorer] Initialized Phase 2 (3D)');
            });
        },

        _ensureThreeJS: function (callback) {
            if (window.THREE) {
                callback();
                return;
            }
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
            script.onload = callback;
            document.head.appendChild(script);
        },

        // Lifecycle: Update
        update: function (dt, params) {
            if (this.tesseractGroup) {
                if (this.isAnimatingCompletion) {
                    this.tesseractGroup.rotation.x += 0.01 * dt;
                    this.tesseractGroup.rotation.y += 0.015 * dt;
                    if (this.innerCube) {
                        const s = 1.0 + Math.sin(Date.now() * 0.005) * 0.2;
                        this.innerCube.scale.set(s, s, s);
                        // Fade in pulse aura
                        this.innerCube.material.opacity = Math.min(0.35, this.innerCube.material.opacity + 0.01 * dt);
                        this.innerCube.material.emissiveIntensity = Math.min(0.5, this.innerCube.material.emissiveIntensity + 0.02 * dt);
                    }
                    if (this.innerSphere) {
                        const s = 1.0 + Math.sin(Date.now() * 0.005) * 0.1;
                        this.innerSphere.scale.set(s, s, s);
                        this.innerSphere.material.opacity = Math.min(0.9, this.innerSphere.material.opacity + 0.01 * dt);
                        this.innerSphere.material.emissiveIntensity = Math.min(0.8, this.innerSphere.material.emissiveIntensity + 0.02 * dt);
                    }
                } else if (this.targetRotation) {
                    this.tesseractGroup.quaternion.slerp(this.targetRotation, 0.05);
                    // Clear target rotation if we are close enough, to resume ambient Y rotation
                    if (this.tesseractGroup.quaternion.angleTo(this.targetRotation) < 0.01) {
                        this.tesseractGroup.quaternion.copy(this.targetRotation);
                        this.targetRotation = null;
                    }
                } else {
                    // Gentle ambient rotation
                    // Keep Y rotating constantly
                    this.tesseractGroup.rotation.y += 0.01 * dt;
                    // Move in 2 axis at the same time when completed
                    if (this.isCompleted) {
                        this.tesseractGroup.rotation.x += 0.003 * dt;
                        this.tesseractGroup.rotation.z += 0.003 * dt;
                    } else {
                        // Only rotate X if not completed, keeps it more readable
                        this.tesseractGroup.rotation.x += 0.0005 * dt;
                    }
                }

                // Keep glowing if completed
                if (this.isCompleted && !this.isAnimatingCompletion) {
                    if (this.innerCube) {
                        const s = 1.0 + Math.sin(Date.now() * 0.003) * 0.1;
                        this.innerCube.scale.set(s, s, s);
                        this.innerCube.material.opacity = 0.35;
                        this.innerCube.material.emissiveIntensity = 0.5;
                    }
                    if (this.innerSphere) {
                        const s = 1.0 + Math.sin(Date.now() * 0.003) * 0.05;
                        this.innerSphere.scale.set(s, s, s);
                        this.innerSphere.material.opacity = 0.9;
                        this.innerSphere.material.emissiveIntensity = 0.8;
                    }
                }
            }
            if (this.particles) {
                this.particles.rotation.y -= 0.0002 * dt;
                if (this.isAnimatingCompletion) {
                    this.particles.rotation.y -= 0.005 * dt;
                }
            }
        },

        // Lifecycle: Draw
        draw: function (dt, params) {
            if (this.renderer && this.scene && this.camera) {
                this.renderer.render(this.scene, this.camera);
            }
        },

        // Lifecycle: Resize
        resize: function (width, height) {
            if (this.camera && this.renderer && this.elements.centerPanel) {
                const w = this.elements.centerPanel.clientWidth;
                const h = this.elements.centerPanel.clientHeight;
                if (w > 0 && h > 0) {
                    this.camera.aspect = w / h;
                    this.camera.updateProjectionMatrix();
                    this.renderer.setSize(w, h);
                }
            }
        },

        // Lifecycle: Reset
        reset: function () {
            this.params.selections = {
                reality: [],
                sensory: [],
                presence: [],
                states: [],
                traits: [],
                meaning: { world: null, story: { from: null, toward: null }, magic: null }
            };
            this.isCompleted = false;

            // Clear UI
            this._updateNavState();

            // Hide summary
            if (this.elements.summarySidebar) {
                this.elements.summarySidebar.classList.remove('visible');
            }
            if (this.innerCube) {
                this.innerCube.material.opacity = 0;
                this.innerCube.material.emissiveIntensity = 0;
                this.innerCube.scale.set(1, 1, 1);
            }
            if (this.innerSphere) {
                this.innerSphere.material.opacity = 0;
                this.innerSphere.material.emissiveIntensity = 0;
                this.innerSphere.scale.set(1, 1, 1);
            }

            this._selectDimension(DATA.dimensions[0].id);
        },

        // Lifecycle: Destroy
        destroy: function () {
            if (this.renderer) {
                this.renderer.dispose();
            }
            // Remove listeners in standard cleanup
        },

        // ==========================================
        // LAYOUT BUILDING
        // ==========================================

        _buildLayout: function (container) {
            // Clear existing
            container.innerHTML = '';
            container.setAttribute('data-engine', 'TesseractExplorer');

            // Left: Nav Panel
            const navPanel = document.createElement('div');
            navPanel.className = 'te-nav-panel';

            const navHeader = document.createElement('div');
            navHeader.className = 'te-nav-header';
            navHeader.innerHTML = '<h3>DIMENSIONS</h3>';

            const navTabs = document.createElement('div');
            navTabs.className = 'te-nav-tabs';

            DATA.dimensions.forEach(dim => {
                const tab = document.createElement('div');
                tab.className = 'te-tab';
                tab.dataset.id = dim.id;
                tab.innerHTML = `
                    <div class="te-tab-icon" style="color: ${dim.color}">${dim.icon}</div>
                    <div class="te-tab-label">${dim.name}</div>
                    <div class="te-tab-status" style="color: ${dim.color}"></div>
                `;
                tab.onclick = () => this._selectDimension(dim.id);
                navTabs.appendChild(tab);
            });

            navPanel.appendChild(navHeader);
            navPanel.appendChild(navTabs);
            this.elements.navTabs = navTabs;

            // Center: Visualizer Panel
            const centerPanel = document.createElement('div');
            centerPanel.className = 'te-center-panel';
            this.elements.centerPanel = centerPanel;

            // Right: Workspace Panel
            const workspacePanel = document.createElement('div');
            workspacePanel.className = 'te-workspace-panel';

            const wsHeader = document.createElement('div');
            wsHeader.className = 'te-workspace-header';
            this.elements.wsHeader = wsHeader;

            const wsContent = document.createElement('div');
            wsContent.className = 'te-workspace-content';
            this.elements.wsContent = wsContent;

            workspacePanel.appendChild(wsHeader);
            workspacePanel.appendChild(wsContent);
            this.elements.workspacePanel = workspacePanel;

            // Summary Sidebar (sliding from left)
            const summarySidebar = document.createElement('div');
            summarySidebar.className = 'te-summary-sidebar';
            summarySidebar.innerHTML = `
                <div class="te-summary-label">Experience Blueprint</div>
                <h2 class="te-summary-title" id="te-sum-title">Name</h2>
                <div class="te-summary-text" id="te-sum-text"></div>
                <div class="te-summary-coherence" id="te-sum-coherence"></div>
                <div class="te-summary-actions">
                    <button class="te-btn primary" id="te-btn-finish">Complete Simulation</button>
                    <button class="te-btn" id="te-btn-restart">Build Another</button>
                </div>
            `;
            this.elements.summarySidebar = summarySidebar;

            // Append all
            container.appendChild(navPanel);
            container.appendChild(centerPanel);
            container.appendChild(summarySidebar);
            container.appendChild(workspacePanel);

            // Bind summary buttons
            container.querySelector('#te-btn-restart').onclick = () => this.reset();
            container.querySelector('#te-btn-finish').onclick = () => {
                if (this.host && this.host.markComplete) {
                    this.host.markComplete();
                }
            };
        },

        _init3DVisualization: function () {
            const container = this.elements.centerPanel;
            container.innerHTML = '';

            // Setup Scene
            this.scene = new window.THREE.Scene();

            // Camera
            const w = container.clientWidth || 800;
            const h = container.clientHeight || 600;
            this.camera = new window.THREE.PerspectiveCamera(60, w / h, 0.1, 1000);
            this.camera.position.z = 5;

            // Renderer
            this.renderer = new window.THREE.WebGLRenderer({ antialias: true, alpha: true });
            this.renderer.setSize(w, h);
            this.renderer.setPixelRatio(window.devicePixelRatio);
            container.appendChild(this.renderer.domElement);

            // Lights
            const ambient = new window.THREE.AmbientLight(0xffffff, 0.4);
            this.scene.add(ambient);
            const pointLight = new window.THREE.PointLight(0xffffff, 1);
            pointLight.position.set(10, 10, 10);
            this.scene.add(pointLight);

            // Tesseract Group
            this.tesseractGroup = new window.THREE.Group();
            this.scene.add(this.tesseractGroup);

            // Build geometry
            this._buildTesseractGeometry();

            // Add particles
            this._buildParticles();

            // Resize handler binding
            window.addEventListener('resize', this.resize.bind(this));
        },

        _buildTesseractGeometry: function () {
            this.faces = {};

            // Outer cube size
            const oSize = 2;
            const iSize = 0.8;

            const faceConfigs = [
                { pos: [0, 0, oSize / 2], rot: [0, 0, 0], id: DATA.dimensions[0].id, color: DATA.dimensions[0].color },
                { pos: [0, 0, -oSize / 2], rot: [0, Math.PI, 0], id: DATA.dimensions[1].id, color: DATA.dimensions[1].color },
                { pos: [0, oSize / 2, 0], rot: [-Math.PI / 2, 0, 0], id: DATA.dimensions[2].id, color: DATA.dimensions[2].color },
                { pos: [0, -oSize / 2, 0], rot: [Math.PI / 2, 0, 0], id: DATA.dimensions[3].id, color: DATA.dimensions[3].color },
                { pos: [-oSize / 2, 0, 0], rot: [0, -Math.PI / 2, 0], id: DATA.dimensions[4].id, color: DATA.dimensions[4].color },
                { pos: [oSize / 2, 0, 0], rot: [0, Math.PI / 2, 0], id: DATA.dimensions[5].id, color: DATA.dimensions[5].color }
            ];

            const planeGeo = new window.THREE.PlaneGeometry(oSize, oSize);

            faceConfigs.forEach(config => {
                const mat = new window.THREE.MeshPhysicalMaterial({
                    color: new window.THREE.Color(config.color),
                    transparent: true,
                    opacity: 0.1,
                    roughness: 0.1,
                    transmission: 0.9,
                    thickness: 0.5,
                    side: window.THREE.DoubleSide,
                    emissive: new window.THREE.Color(config.color),
                    emissiveIntensity: 0.1,
                    depthWrite: false
                });
                const mesh = new window.THREE.Mesh(planeGeo, mat);
                mesh.position.set(...config.pos);
                mesh.rotation.set(...config.rot);
                mesh.userData = { id: config.id, baseColor: config.color };

                // Edges helper for plane
                const edgesGeo = new window.THREE.EdgesGeometry(planeGeo);
                const edgesMat = new window.THREE.LineBasicMaterial({ color: config.color, transparent: true, opacity: 0.3 });
                const edges = new window.THREE.LineSegments(edgesGeo, edgesMat);
                mesh.add(edges);

                this.tesseractGroup.add(mesh);
                this.faces[config.id] = mesh;
            });

            // Inner cube
            const innerGeo = new window.THREE.BoxGeometry(iSize, iSize, iSize);
            const innerMat = new window.THREE.MeshStandardMaterial({
                color: 0xffffff,
                transparent: true,
                opacity: 0.0,
                emissive: 0x7b5cff,
                emissiveIntensity: 0.0,
                depthWrite: false
            });
            this.innerCube = new window.THREE.Mesh(innerGeo, innerMat);
            this.tesseractGroup.add(this.innerCube);

            // Inner Sphere (Only appears on completion)
            const sphereGeo = new window.THREE.SphereGeometry(iSize * 0.4, 32, 32);
            const sphereMat = new window.THREE.MeshStandardMaterial({
                color: 0xff8800,
                emissive: 0xff8800,
                emissiveIntensity: 0.0,
                transparent: true,
                opacity: 0.0,
                depthWrite: false
            });
            this.innerSphere = new window.THREE.Mesh(sphereGeo, sphereMat);
            this.tesseractGroup.add(this.innerSphere);

            // Wireframe inner
            const innerEdgesGeo = new window.THREE.EdgesGeometry(innerGeo);
            const innerEdgesMat = new window.THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.3 });
            const innerEdges = new window.THREE.LineSegments(innerEdgesGeo, innerEdgesMat);
            this.innerCube.add(innerEdges);

            // Connect outer corners to inner corners
            const corners = [
                [1, 1, 1], [1, 1, -1], [1, -1, 1], [1, -1, -1],
                [-1, 1, 1], [-1, 1, -1], [-1, -1, 1], [-1, -1, -1]
            ];
            const lineMat = new window.THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.15 });
            corners.forEach(c => {
                const points = [];
                points.push(new window.THREE.Vector3(c[0] * oSize / 2, c[1] * oSize / 2, c[2] * oSize / 2));
                points.push(new window.THREE.Vector3(c[0] * iSize / 2, c[1] * iSize / 2, c[2] * iSize / 2));
                const geo = new window.THREE.BufferGeometry().setFromPoints(points);
                const line = new window.THREE.Line(geo, lineMat);
                this.tesseractGroup.add(line);
            });
        },

        _buildParticles: function () {
            const geo = new window.THREE.BufferGeometry();
            const count = 500;
            const positions = new Float32Array(count * 3);
            for (let i = 0; i < count * 3; i++) {
                positions[i] = (Math.random() - 0.5) * 15;
            }
            geo.setAttribute('position', new window.THREE.BufferAttribute(positions, 3));
            const mat = new window.THREE.PointsMaterial({
                color: 0x7b5cff,
                size: 0.05,
                transparent: true,
                opacity: 0.4
            });
            this.particles = new window.THREE.Points(geo, mat);
            this.scene.add(this.particles);
        },

        _bindEvents: function () {
            // Setup raycaster for 3D interactions
            this.raycaster = new window.THREE.Raycaster();
            this.mouse = new window.THREE.Vector2();

            const container = this.elements.centerPanel;

            // We use pointerup to avoid drags counting as clicks
            container.addEventListener('pointerup', (e) => {
                if (!this.camera || !this.scene || !this.faces) return;

                const rect = container.getBoundingClientRect();
                this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
                this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

                this.raycaster.setFromCamera(this.mouse, this.camera);

                // Get array of face meshes
                const faceMeshes = Object.values(this.faces);
                const intersects = this.raycaster.intersectObjects(faceMeshes);

                if (intersects.length > 0) {
                    const hit = intersects[0].object;
                    if (hit.userData && hit.userData.id) {
                        this._selectDimension(hit.userData.id);
                    }
                }
            });
        },

        // ==========================================
        // INTERACTION LOGIC
        // ==========================================

        _selectDimension: function (dimId) {
            // Set target rotation for 3D Tesseract to face the selected dimension
            if (this.tesseractGroup && this.faces && this.faces[dimId]) {
                const face = this.faces[dimId];

                // We want the face's normal to point towards the camera (+Z).
                // The face's local position gives us an outward vector from the center.
                const localPos = face.position.clone().normalize();

                // We want this local outward vector to become the world +Z vector (0, 0, 1)
                const targetNormal = new window.THREE.Vector3(0, 0, 1);

                // Create a quaternion that rotates from the local normal to the target normal
                const targetQuat = new window.THREE.Quaternion().setFromUnitVectors(localPos, targetNormal);

                this.targetRotation = targetQuat;
            }

            // If we are completed, we ONLY rotate the tesseract, we do not open the dimension workspace again
            if (this.isCompleted) {
                this.activeDimension = dimId;
                this._updateNavState();
                return;
            }

            // Animate transition (dummy for now)
            this.elements.workspacePanel.classList.add('hidden');

            setTimeout(() => {
                this.activeDimension = dimId;
                const dimData = DATA.dimensions.find(d => d.id === dimId);

                this._updateNavState();
                this._buildWorkspace(dimData);

                this.elements.workspacePanel.classList.remove('hidden');
            }, 150);
        },

        _updateNavState: function () {
            // Update Tabs
            const tabs = this.elements.navTabs.querySelectorAll('.te-tab');
            tabs.forEach(tab => {
                const id = tab.dataset.id;
                tab.classList.remove('active');
                if (id === this.activeDimension) tab.classList.add('active');

                // Check completion
                if (this._isDimensionComplete(id)) {
                    tab.classList.add('completed');
                } else {
                    tab.classList.remove('completed');
                }
            });

            // Update 3D Faces
            if (this.faces) {
                Object.keys(this.faces).forEach(id => {
                    const face = this.faces[id];
                    const isComplete = this._isDimensionComplete(id);
                    const isActive = (id === this.activeDimension);

                    if (isActive) {
                        face.material.opacity = 0.5;
                        face.material.emissiveIntensity = 0.6;
                    } else if (isComplete) {
                        face.material.opacity = 0.3;
                        face.material.emissiveIntensity = 0.4;
                    } else {
                        face.material.opacity = 0.1;
                        face.material.emissiveIntensity = 0.1;
                    }
                });
            }
        },

        _isDimensionComplete: function (dimId) {
            const sels = this.params.selections[dimId];
            if (dimId === 'meaning') {
                return sels.world && sels.story.from && sels.story.toward && sels.magic;
            }
            return sels && sels.length > 0;
        },

        _buildWorkspace: function (dimData) {
            // Header
            this.elements.wsHeader.innerHTML = `
                <h2 class="te-workspace-title">
                    <span style="color:${dimData.color}">${dimData.icon}</span> ${dimData.name}
                </h2>
                <p class="te-workspace-desc">${dimData.description}</p>
                <div class="te-workspace-question">${dimData.question}</div>
            `;

            // Content
            const content = this.elements.wsContent;
            content.innerHTML = '';

            if (dimData.id === 'meaning') {
                this._buildMeaningOptions(content, dimData);
            } else {
                this._buildStandardOptions(content, dimData);
            }
        },

        _buildStandardOptions: function (container, dimData) {
            const selections = this.params.selections[dimData.id];

            dimData.options.forEach(opt => {
                const el = document.createElement('div');
                const isSelected = selections.includes(opt.id);

                el.className = `te-option ${dimData.type === 'single' ? 'single' : 'multi'}`;
                if (isSelected) el.classList.add('selected');
                el.style.color = dimData.color; // For the indicator border

                el.innerHTML = `
                    <div class="te-option-title">
                        ${opt.title}
                        <div class="te-indicator"></div>
                    </div>
                    <p class="te-option-desc">${opt.description}</p>
                `;

                el.onclick = () => {
                    if (dimData.type === 'single') {
                        this.params.selections[dimData.id] = [opt.id];
                    } else {
                        // Multi or Multi-limit
                        const idx = selections.indexOf(opt.id);
                        if (idx > -1) {
                            selections.splice(idx, 1); // remove
                        } else {
                            if (dimData.limit && selections.length >= dimData.limit) {
                                // shift oldest
                                selections.shift();
                            }
                            selections.push(opt.id);
                        }
                    }
                    this._buildWorkspace(dimData); // Re-render this panel
                    this._checkGlobalCompletion();
                };

                container.appendChild(el);
            });
        },

        _buildMeaningOptions: function (container, dimData) {
            const sels = this.params.selections.meaning;
            const mData = DATA.meaningData;

            // State to track which step is currently expanded (1: World, 2: Story, 3: Magic)
            // Default to the first incomplete step, or 0 if all are done
            let activeStep = 1;
            if (sels.world) activeStep = 2;
            if (sels.world && sels.story.from && sels.story.toward) activeStep = 3;
            if (sels.world && sels.story.from && sels.story.toward && sels.magic) activeStep = 0;

            // Allow override if user explicitly clicked 'edit' (0 is a valid value for "all collapsed")
            if (this._meaningActiveStep !== undefined && this._meaningActiveStep !== null) {
                activeStep = this._meaningActiveStep;
            } else {
                this._meaningActiveStep = activeStep;
            }

            const createCollapsedHeader = (stepNum, title, selectionText) => {
                const header = document.createElement('div');
                header.className = 'te-meaning-step-collapsed';
                header.style.display = 'flex';
                header.style.justifyContent = 'space-between';
                header.style.alignItems = 'center';
                header.style.padding = '15px';
                header.style.backgroundColor = 'rgba(25, 25, 30, 0.4)';
                header.style.border = '1px solid rgba(255, 255, 255, 0.05)';
                header.style.borderRadius = '6px';
                header.style.marginBottom = '10px';
                header.style.cursor = 'pointer';

                header.innerHTML = `
                    <div>
                        <div style="font-size: 10px; color: rgba(255,255,255,0.5); text-transform: uppercase;">Step ${stepNum}: ${title}</div>
                        <div style="font-size: 14px; color: white; margin-top: 4px; font-weight: 500;">${selectionText}</div>
                    </div>
                    <div style="color: ${dimData.color}; font-size: 18px;">↓</div>
                `;

                header.onclick = () => {
                    this._meaningActiveStep = stepNum;
                    this._buildWorkspace(dimData);
                };

                return header;
            };

            // Step 1: World
            if (activeStep !== 1 && sels.world) {
                const selectedWorld = mData.world.options.find(o => o.id === sels.world)?.title || 'Selected';
                container.appendChild(createCollapsedHeader(1, 'The World', selectedWorld));
            } else {
                const wStep = document.createElement('div');
                wStep.className = 'te-meaning-step active';
                wStep.style.marginBottom = '20px';
                wStep.innerHTML = `
                    <div style="font-size: 11px; color: ${dimData.color}; text-transform: uppercase; margin-bottom: 10px; display: flex; justify-content: space-between;">
                        <span>Step 1: The World</span>
                        ${sels.world && activeStep === 1 && (sels.story.from || sels.magic) ? `<span style="cursor:pointer; opacity: 0.7;" onclick="document.querySelector('.te-engine-trigger-collapse-1').click()">↑</span>` : ''}
                    </div>
                    <p style="font-size: 13px; color: rgba(255,255,255,0.7); margin-bottom: 15px;">${mData.world.question}</p>
                    <div class="te-engine-trigger-collapse-1" style="display:none;"></div>
                `;

                wStep.querySelector('.te-engine-trigger-collapse-1').onclick = () => {
                    this._meaningActiveStep = 2; // jump to next
                    this._buildWorkspace(dimData);
                };

                mData.world.options.forEach(w => {
                    const o = document.createElement('div');
                    o.className = `te-option single ${sels.world === w.id ? 'selected' : ''}`;
                    o.style.color = dimData.color;
                    o.innerHTML = `<div class="te-option-title">${w.title}<div class="te-indicator"></div></div><p class="te-option-desc">${w.description}</p>`;
                    o.onclick = () => {
                        this.params.selections.meaning.world = w.id;
                        this._meaningActiveStep = 2; // Auto-advance
                        this._buildWorkspace(dimData);
                    };
                    wStep.appendChild(o);
                    o.style.marginBottom = '8px';
                });
                container.appendChild(wStep);
            }

            // Step 2: Story (Only show if World is selected)
            if (sels.world) {
                if (activeStep !== 2 && sels.story.from && sels.story.toward) {
                    container.appendChild(createCollapsedHeader(2, 'The Story', `${sels.story.from} → ${sels.story.toward}`));
                } else if (activeStep === 2) {
                    const sStep = document.createElement('div');
                    sStep.className = 'te-meaning-step active';
                    sStep.style.marginBottom = '20px';
                    sStep.innerHTML = `
                        <div style="font-size: 11px; color: ${dimData.color}; text-transform: uppercase; margin-bottom: 10px; display: flex; justify-content: space-between;">
                            <span>Step 2: The Story</span>
                            ${sels.story.from && sels.story.toward ? `<span style="cursor:pointer; opacity: 0.7;" onclick="document.querySelector('.te-engine-trigger-collapse-2').click()">↑</span>` : ''}
                        </div>
                        <p style="font-size: 13px; color: rgba(255,255,255,0.7); margin-bottom: 15px;">${mData.story.question}</p>
                        <div class="te-story-selects">
                            <div class="te-select-group">
                                <label>Moving FROM...</label>
                                <select id="te-sel-from" class="te-select">
                                    <option value="" disabled ${!sels.story.from ? 'selected' : ''}>Select starting state...</option>
                                    ${mData.story.fromOptions.map(f => `<option value="${f}" ${sels.story.from === f ? 'selected' : ''}>${f}</option>`).join('')}
                                </select>
                            </div>
                            <div class="te-select-group">
                                <label>Moving TOWARD...</label>
                                <select id="te-sel-toward" class="te-select">
                                    <option value="" disabled ${!sels.story.toward ? 'selected' : ''}>Select destination state...</option>
                                    ${mData.story.towardOptions.map(t => `<option value="${t}" ${sels.story.toward === t ? 'selected' : ''}>${t}</option>`).join('')}
                                </select>
                            </div>
                        </div>
                        <div class="te-engine-trigger-collapse-2" style="display:none;"></div>
                    `;
                    container.appendChild(sStep);

                    sStep.querySelector('.te-engine-trigger-collapse-2').onclick = () => {
                        this._meaningActiveStep = 3; // jump to next
                        this._buildWorkspace(dimData);
                    };

                    setTimeout(() => {
                        const sf = container.querySelector('#te-sel-from');
                        const st = container.querySelector('#te-sel-toward');

                        const updateStory = () => {
                            this.params.selections.meaning.story.from = sf.value;
                            this.params.selections.meaning.story.toward = st.value;
                            if (sf.value && st.value) {
                                this._meaningActiveStep = 3; // Auto-advance
                                this._buildWorkspace(dimData);
                            }
                        };

                        sf.onchange = updateStory;
                        st.onchange = updateStory;
                    }, 10);
                }
            }

            // Step 3: Magic (Only show if Story is complete)
            if (sels.world && sels.story.from && sels.story.toward) {
                if (activeStep !== 3 && sels.magic) {
                    const selectedMagic = mData.magic.options.find(o => o.id === sels.magic)?.title || 'Selected';
                    container.appendChild(createCollapsedHeader(3, 'The Magic', selectedMagic));
                } else if (activeStep === 3) {
                    const mStep = document.createElement('div');
                    mStep.className = 'te-meaning-step active';
                    mStep.innerHTML = `
                        <div style="font-size: 11px; color: ${dimData.color}; text-transform: uppercase; margin-bottom: 10px; display: flex; justify-content: space-between;">
                            <span>Step 3: The Magic</span>
                            ${sels.magic ? `<span style="cursor:pointer; opacity: 0.7;" onclick="document.querySelector('.te-engine-trigger-collapse-3').click()">↑</span>` : ''}
                        </div>
                        <p style="font-size: 13px; color: rgba(255,255,255,0.7); margin-bottom: 15px;">${mData.magic.question}</p>
                        <div class="te-engine-trigger-collapse-3" style="display:none;"></div>
                    `;

                    mStep.querySelector('.te-engine-trigger-collapse-3').onclick = () => {
                        // All done, just re-render to collapse
                        this._meaningActiveStep = 0;
                        this._buildWorkspace(dimData);
                    };

                    mData.magic.options.forEach(m => {
                        const o = document.createElement('div');
                        o.className = `te-option single ${sels.magic === m.id ? 'selected' : ''}`;
                        o.style.color = dimData.color;
                        o.innerHTML = `<div class="te-option-title">${m.title}<div class="te-indicator"></div></div><p class="te-option-desc">${m.description}</p>`;
                        o.onclick = () => {
                            this.params.selections.meaning.magic = m.id;
                            this._meaningActiveStep = null; // Reset forced step so it naturally collapses if checked
                            this._buildWorkspace(dimData);
                            this._checkGlobalCompletion();
                        };
                        mStep.appendChild(o);
                        o.style.marginBottom = '8px';
                    });
                    container.appendChild(mStep);
                }
            }
        },

        // ==========================================
        // COMPLETION LOGIC
        // ==========================================

        _checkGlobalCompletion: function () {
            this._updateNavState();

            const isAllDone = DATA.dimensions.every(dim => this._isDimensionComplete(dim.id));

            if (isAllDone && !this.isCompleted) {
                this.isCompleted = true;
                this._playCompletionSequence();
            }
        },

        _playCompletionSequence: function () {
            this.targetRotation = null; // Resume rotation but much faster
            this.isAnimatingCompletion = true;

            // Fast spin, bright glow
            if (this.faces) {
                Object.values(this.faces).forEach(face => {
                    face.material.emissiveIntensity = 1.0;
                    face.material.opacity = 0.8;
                });
            }

            setTimeout(() => {
                this.isAnimatingCompletion = false;
                this._showSummary();
            }, 3000);
        },

        _showSummary: function () {
            const res = DATA.methods.generateDescription(this.params.selections);
            const name = DATA.methods.generateName(this.params.selections);

            const sidebar = this.elements.summarySidebar;

            sidebar.querySelector('#te-sum-title').textContent = name;

            const textHtml = res.paragraphs.map(p => `<p>${p}</p>`).join('');
            sidebar.querySelector('#te-sum-text').innerHTML = textHtml;

            sidebar.querySelector('#te-sum-coherence').innerHTML = res.coherenceNote;

            // Hide workspace, show summary sidebar
            this.elements.workspacePanel.classList.add('hidden');
            this.elements.summarySidebar.classList.add('visible');

            // Reveal the host continue button now that exploration is complete
            const parent = this.elements.summarySidebar.closest('.interactive-simulation-container');
            if (parent) {
                const continueBtn = parent.querySelector('.btn-continue');
                if (continueBtn) {
                    continueBtn.style.display = 'block';
                    requestAnimationFrame(() => {
                        continueBtn.classList.add('visible');
                        continueBtn.style.boxShadow = '0 0 15px var(--gold-glow, rgba(245, 158, 11, 0.5))';
                    });
                }
            }
        }
    };

})();
