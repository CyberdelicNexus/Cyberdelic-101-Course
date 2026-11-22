/**
 * Cyberdelic Convergence - 2D (SVG) engine, kept as a fallback. Not loaded by any page.
 * Registers itself to window.SimulationEngines
 * 
 * Adapted from standalone version to fit InteractiveSimulation framework.
 */
(function () {

    // Ensure registry
    window.SimulationEngines = window.SimulationEngines || {};

    /* ============================================
       DATA STRUCTURE (Preserved)
       ============================================ */
    // Use external data
    const DATA = window.CyberdelicData;


    // Base Config (Defaults)
    const BASE_CONFIG = {
        svg: { width: 1000, height: 800, centerX: 500, centerY: 400 },
        nodes: { domainRadius: 60, centerRadiusMin: 15, centerRadiusMax: 70, orbitRadius: 300 }, // Max radius 70 is greater than domain 60
        connections: { minWidth: 1, maxWidth: 8 },
        timeline: { startYear: 2015, endYear: 2025 },
        styles: {
            labelSize: 10,
            centerLabelSizeMin: 4,
            centerLabelSizeMax: 14,
            contentHeaderSize: 7,
            contentTextSize: 5.5
        }
    };

    /**
     * ENGINE DEFINITION
     */
    window.SimulationEngines['CyberdelicConvergence2D'] = {
        name: 'Cyberdelic Convergence 2D',
        showPlaybackControls: false,

        defaults: {
            year: 2015
        },

        config: [
            { id: 'year', label: 'YEAR', min: 2015, max: 2025, step: 1 }
        ],

        // Instance State
        svg: null,
        domainPositions: [],
        particles: [],
        lastSpawnTime: 0,
        isZoomed: false,
        zoomedNode: null,
        selectedNode: null,
        simConfig: null, // Instance copy of BASE_CONFIG

        init: function (container, params) {
            if (!window.CyberdelicData) {
                console.error('CyberdelicData not loaded!');
                return;
            }

            // 0. Clone Config
            this.simConfig = JSON.parse(JSON.stringify(BASE_CONFIG));

            // 1. Create SVG Container if not exists
            let svg = container.querySelector('svg.convergence-viz');
            if (!svg) {
                // Clear container (it might have canvas from previous sim)
                container.innerHTML = '';
                svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
                svg.setAttribute('class', 'convergence-viz');
                svg.setAttribute('viewBox', `0 0 ${this.simConfig.svg.width} ${this.simConfig.svg.height}`);
                svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
                svg.style.width = '100%';
                svg.style.height = '100%';
                // Background (ambient blob light) lives in cyberdelic-convergence.css
                container.appendChild(svg);
            }
            this.svg = svg;
            this._createDefs();

            // 2. Setup Interactions (Click background to deselect)
            this.svg.addEventListener('click', (e) => {
                if (e.target === this.svg) {
                    this.zoomOut();
                }
            });

            // 3. Init Visualization
            this._calculatePositions();
            this._createConnections();
            this._createCenterNode();
            this._createDomainNodes();

            // 4. Initial Update
            this.update(0, params);

            console.log('[CyberdelicConvergence] Initialized');

            // 5. Init Tutorial
            this.initTutorial();
            this.initHelp();
            this._setupKeyboard();
        },

        resize: function (width, height) {
            // Responsive Logic
            const isMobile = width < 600;

            if (isMobile) {
                // Mobile Adjustments (Scale up text relative to SVG viewbox)
                this.simConfig.styles.labelSize = 24;
                this.simConfig.styles.centerLabelSizeMin = 10;
                this.simConfig.styles.centerLabelSizeMax = 28;
                this.simConfig.styles.contentHeaderSize = 14;
                this.simConfig.styles.contentTextSize = 12;
            } else {
                // Desktop Reset
                this.simConfig.styles.labelSize = 10;
                this.simConfig.styles.centerLabelSizeMin = 4;
                this.simConfig.styles.centerLabelSizeMax = 14;
                this.simConfig.styles.contentHeaderSize = 7;
                this.simConfig.styles.contentTextSize = 5.5;
            }

            // Re-render text elements that depend on these sizes
            // For simplicity, we can re-create the static nodes or update them selectors
            this.svg.querySelectorAll('.node-label').forEach(txt => {
                // Assuming standard label
                txt.setAttribute('font-size', this.simConfig.styles.labelSize); // SVG specific prop
                // Also might need to adjust spacing
            });

            // Re-create Center Node to update label
            const centerGroup = this.svg.getElementById('center-node');
            if (centerGroup) centerGroup.remove();
            this._createCenterNode();

            // Refine: Update content rings if zoomed
            if (this.isZoomed && this.zoomedNode) {
                this._createContentTags(this.zoomedNode);
            }
        },

        update: function (dt, params) {
            const year = Math.round(params.year);
            const yearChanged = this.lastYear !== year;

            this.lastYear = year; // Track for content updates
            // Visual Update for Year
            this._updateVisualization(year);

            // Particle System
            this._updateParticles(dt, year);
            this._renderParticles(year);

            // Update Zoomed Content if year changed
            if (this.isZoomed && yearChanged) {
                this._createContentTags(this.zoomedNode);
            }
        },

        draw: function (ctx, params) {
            // No Canvas Drawing needed, we use SVG DOM
        },

        // ========== IMPLEMENTATION ==========

        // Shared gradients and glow filters, styled after the Cyberdelic Nexus design system.
        _createDefs: function () {
            const NS = 'http://www.w3.org/2000/svg';
            if (this.svg.querySelector('defs#cn-defs')) return;

            const defs = document.createElementNS(NS, 'defs');
            defs.id = 'cn-defs';

            const stops = (grad, list) => list.forEach(([offset, color, opacity]) => {
                const s = document.createElementNS(NS, 'stop');
                s.setAttribute('offset', offset);
                s.setAttribute('stop-color', color);
                if (opacity !== undefined) s.setAttribute('stop-opacity', opacity);
                grad.appendChild(s);
            });

            // Brand gradient (cyan → violet → magenta): center ring and underbars
            const brand = document.createElementNS(NS, 'linearGradient');
            brand.id = 'cn-grad-brand';
            brand.setAttribute('x1', '0'); brand.setAttribute('y1', '0');
            brand.setAttribute('x2', '1'); brand.setAttribute('y2', '0.2');
            stops(brand, [['0%', '#4CDCEF'], ['50%', '#B49BF8'], ['100%', '#E562A4']]);
            defs.appendChild(brand);

            // Accretion streak behind the center (as on the site's NodeHub)
            const streak = document.createElementNS(NS, 'radialGradient');
            streak.id = 'cn-streak';
            stops(streak, [['0%', '#D6E7FC', 0.55], ['34%', '#7C4FF0', 0.28], ['72%', '#000000', 0]]);
            defs.appendChild(streak);

            // Center plate: black core with an ultraviolet inner glow at the rim
            const core = document.createElementNS(NS, 'radialGradient');
            core.id = 'cn-core';
            stops(core, [['0%', '#000000', 1], ['62%', '#07040F', 1], ['100%', '#7C4FF0', 0.55]]);
            defs.appendChild(core);

            // Per-domain plates: obsidian centre, colour only at the rim (inner radiance)
            DATA.domains.forEach(d => {
                const g = document.createElementNS(NS, 'radialGradient');
                g.id = `cn-plate-${d.id}`;
                stops(g, [['0%', '#0F0B1A', 0.92], ['58%', '#0F0B1A', 0.88], ['100%', d.color, 0.42]]);
                defs.appendChild(g);
            });

            // Soft bloom for halos and glows (one shared filter instead of per-element CSS)
            const mkBlur = (id, dev) => {
                const f = document.createElementNS(NS, 'filter');
                f.id = id;
                f.setAttribute('x', '-100%'); f.setAttribute('y', '-100%');
                f.setAttribute('width', '300%'); f.setAttribute('height', '300%');
                const b = document.createElementNS(NS, 'feGaussianBlur');
                b.setAttribute('stdDeviation', dev);
                f.appendChild(b);
                defs.appendChild(f);
            };
            mkBlur('cn-blur-sm', 2.5);
            mkBlur('cn-blur-md', 6);
            mkBlur('cn-blur-lg', 14);

            this.svg.insertBefore(defs, this.svg.firstChild);
        },

        // Smooth viewBox tween using the design system's arrival easing (cubic-bezier(.16,1,.3,1)).
        _animateViewBox: function (target, duration = 700) {
            const from = this.svg.getAttribute('viewBox').split(' ').map(Number);
            const to = target.split(' ').map(Number);
            if (this._vbAnim) cancelAnimationFrame(this._vbAnim);

            const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
            if (reduce) { this.svg.setAttribute('viewBox', target); return; }

            // Approximation of cubic-bezier(.16,1,.3,1): strong deceleration, no overshoot
            const ease = t => 1 - Math.pow(1 - t, 4);
            const start = performance.now();
            const step = now => {
                const t = Math.min(1, (now - start) / duration);
                const k = ease(t);
                this.svg.setAttribute('viewBox', from.map((v, i) => v + (to[i] - v) * k).join(' '));
                if (t < 1) this._vbAnim = requestAnimationFrame(step);
                else this._vbAnim = null;
            };
            this._vbAnim = requestAnimationFrame(step);
        },

        _calculatePositions: function () {
            this.domainPositions = DATA.domains.map(domain => {
                const angleRad = (domain.angle * Math.PI) / 180;
                return {
                    ...domain,
                    x: this.simConfig.svg.centerX + this.simConfig.nodes.orbitRadius * Math.cos(angleRad),
                    y: this.simConfig.svg.centerY + this.simConfig.nodes.orbitRadius * Math.sin(angleRad)
                };
            });
        },

        _getConnectionStrength: function (connection, year) {
            if (year < connection.yearAppears) return 0;
            if (connection.strengthByYear[year] !== undefined) return connection.strengthByYear[year];

            // Interpolate
            const years = Object.keys(connection.strengthByYear).map(Number).sort((a, b) => a - b);
            const lower = years.filter(y => y <= year).pop() || years[0];
            const upper = years.find(y => y >= year) || years[years.length - 1];
            if (lower === upper) return connection.strengthByYear[lower];

            const ratio = (year - lower) / (upper - lower);
            return connection.strengthByYear[lower] + (connection.strengthByYear[upper] - connection.strengthByYear[lower]) * ratio;
        },

        _createConnections: function () {
            const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            g.id = 'connections-group';

            // Spoke Connections to Center: domain colour fading into the violet core
            const defs = this.svg.querySelector('#cn-defs');
            this.domainPositions.forEach(src => {
                const gradId = `cn-spoke-${src.id}`;
                if (defs && !defs.querySelector(`#${gradId}`)) {
                    const grad = document.createElementNS('http://www.w3.org/2000/svg', 'linearGradient');
                    grad.id = gradId;
                    grad.setAttribute('gradientUnits', 'userSpaceOnUse');
                    grad.setAttribute('x1', src.x); grad.setAttribute('y1', src.y);
                    grad.setAttribute('x2', this.simConfig.svg.centerX); grad.setAttribute('y2', this.simConfig.svg.centerY);
                    [['0%', src.color, 0.9], ['100%', '#B49BF8', 0.15]].forEach(([o, c, op]) => {
                        const s = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
                        s.setAttribute('offset', o); s.setAttribute('stop-color', c); s.setAttribute('stop-opacity', op);
                        grad.appendChild(s);
                    });
                    defs.appendChild(grad);
                }

                // Glow
                const glow = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                glow.classList.add('center-connection-glow');
                glow.setAttribute('x1', src.x); glow.setAttribute('y1', src.y);
                glow.setAttribute('x2', this.simConfig.svg.centerX); glow.setAttribute('y2', this.simConfig.svg.centerY);
                glow.setAttribute('stroke', `url(#${gradId})`);
                glow.setAttribute('stroke-width', 4);
                glow.setAttribute('opacity', 0.25);
                glow.setAttribute('filter', 'url(#cn-blur-sm)');
                g.appendChild(glow);

                // Line
                const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                line.classList.add('center-connection-line');
                line.setAttribute('x1', src.x); line.setAttribute('y1', src.y);
                line.setAttribute('x2', this.simConfig.svg.centerX); line.setAttribute('y2', this.simConfig.svg.centerY);
                line.setAttribute('stroke', `url(#${gradId})`);
                line.setAttribute('stroke-width', 1);
                line.setAttribute('stroke-dasharray', '2 6');
                line.setAttribute('opacity', 0.55);
                g.appendChild(line);
            });

            DATA.connections.forEach((conn, i) => {
                const src = this.domainPositions.find(d => d.id === conn.source);
                const tgt = this.domainPositions.find(d => d.id === conn.target);
                if (!src || !tgt) return;

                let diff = Math.abs(src.angle - tgt.angle);
                if (diff > 180) diff = 360 - diff;
                const isAcross = diff > 135;

                // Glow
                const glow = document.createElementNS('http://www.w3.org/2000/svg', isAcross ? 'path' : 'line');
                glow.classList.add('connection-glow');
                glow.id = `conn-glow-${i}`;
                glow.setAttribute('stroke', src.color);
                glow.setAttribute('fill', 'none');
                glow.setAttribute('filter', 'url(#cn-blur-sm)');
                g.appendChild(glow);

                // Line
                const line = document.createElementNS('http://www.w3.org/2000/svg', isAcross ? 'path' : 'line');
                line.classList.add('connection-line');
                line.id = `conn-${i}`;
                line.setAttribute('stroke', src.color);
                line.setAttribute('fill', 'none');
                g.appendChild(line);

                if (!isAcross) {
                    glow.setAttribute('x1', src.x); glow.setAttribute('y1', src.y);
                    glow.setAttribute('x2', tgt.x); glow.setAttribute('y2', tgt.y);
                    line.setAttribute('x1', src.x); line.setAttribute('y1', src.y);
                    line.setAttribute('x2', tgt.x); line.setAttribute('y2', tgt.y);
                } else {
                    const r = this.simConfig.nodes.orbitRadius;
                    const cx = this.simConfig.svg.centerX;
                    const cy = this.simConfig.svg.centerY;
                    const v1x = src.x - cx, v1y = src.y - cy;
                    const v2x = tgt.x - cx, v2y = tgt.y - cy;
                    const cross = v1x * v2y - v1y * v2x;
                    const sweep = cross > 0 ? 1 : 0;
                    
                    const d = `M ${src.x} ${src.y} A ${r} ${r} 0 0 ${sweep} ${tgt.x} ${tgt.y}`;
                    glow.setAttribute('d', d);
                    line.setAttribute('d', d);
                }
            });

            this.svg.appendChild(g);
        },

        _createCenterNode: function () {
            const NS = 'http://www.w3.org/2000/svg';
            const cx = this.simConfig.svg.centerX;
            const cy = this.simConfig.svg.centerY;
            const g = document.createElementNS(NS, 'g');
            g.id = 'center-node';

            // Accretion streak: a horizontal band of light behind everything else
            if (!this.svg.getElementById('center-streak')) {
                const streak = document.createElementNS(NS, 'ellipse');
                streak.id = 'center-streak';
                streak.setAttribute('cx', cx); streak.setAttribute('cy', cy);
                streak.setAttribute('rx', 230); streak.setAttribute('ry', 30);
                streak.setAttribute('fill', 'url(#cn-streak)');
                streak.setAttribute('filter', 'url(#cn-blur-md)');
                streak.style.pointerEvents = 'none';
                const defs = this.svg.querySelector('#cn-defs');
                this.svg.insertBefore(streak, defs ? defs.nextSibling : this.svg.firstChild);
            }

            // Halo: orchid bloom behind the ring
            const halo = document.createElementNS(NS, 'circle');
            halo.id = 'center-halo';
            halo.setAttribute('cx', cx); halo.setAttribute('cy', cy);
            halo.setAttribute('fill', 'none');
            halo.setAttribute('stroke', '#B964F5');
            halo.setAttribute('stroke-width', 8);
            halo.setAttribute('opacity', 0.75);
            halo.setAttribute('filter', 'url(#cn-blur-lg)');
            g.appendChild(halo);

            // The lit ring: black plate, brand-gradient rim that slowly turns
            const circle = document.createElementNS(NS, 'circle');
            circle.id = 'center-circle';
            circle.setAttribute('cx', cx);
            circle.setAttribute('cy', cy);
            circle.setAttribute('fill', 'url(#cn-core)');
            circle.setAttribute('stroke', 'url(#cn-grad-brand)');
            circle.setAttribute('stroke-width', 2.5);
            g.appendChild(circle);

            const label = document.createElementNS(NS, 'text');
            label.classList.add('center-label');
            label.textContent = 'CYBERDELICS';
            label.setAttribute('x', cx);
            label.setAttribute('y', cy);
            label.setAttribute('text-anchor', 'middle');
            label.setAttribute('dy', '0.35em');
            label.setAttribute('fill', '#F1EEFB');
            label.setAttribute('font-size', this.simConfig.styles.centerLabelSizeMin || 10); // Start at Min Size
            label.style.pointerEvents = 'none';
            g.appendChild(label);

            this.svg.appendChild(g);
        },

        _createDomainNodes: function () {
            this.domainPositions.forEach(d => {
                const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
                g.classList.add('domain-node');
                g.dataset.id = d.id;
                g.style.setProperty('--node-color', d.color);
                const r = this.simConfig.nodes.domainRadius;

                // Halo: blurred bloom of the domain colour behind the plate
                const halo = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                halo.classList.add('node-halo');
                halo.setAttribute('cx', d.x);
                halo.setAttribute('cy', d.y);
                halo.setAttribute('r', r);
                halo.setAttribute('fill', 'none');
                halo.setAttribute('stroke', d.color);
                halo.setAttribute('stroke-width', 6);
                halo.setAttribute('filter', 'url(#cn-blur-md)');
                g.appendChild(halo);

                // Plate: obsidian centre, colour glowing in from the rim
                const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                circle.classList.add('node-circle');
                circle.setAttribute('cx', d.x);
                circle.setAttribute('cy', d.y);
                circle.setAttribute('r', r);
                circle.setAttribute('fill', `url(#cn-plate-${d.id})`);
                circle.setAttribute('stroke', d.color);
                circle.setAttribute('stroke-width', 1.5);
                g.appendChild(circle);

                // Fine inner ring: ritual-tech linework
                const inner = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                inner.classList.add('node-inner-ring');
                inner.setAttribute('cx', d.x);
                inner.setAttribute('cy', d.y);
                inner.setAttribute('r', r - 7);
                inner.setAttribute('fill', 'none');
                inner.setAttribute('stroke', d.color);
                inner.setAttribute('stroke-width', 0.75);
                inner.setAttribute('stroke-dasharray', '1 5');
                inner.setAttribute('opacity', 0.6);
                inner.style.pointerEvents = 'none';
                g.appendChild(inner);

                // Label
                const lines = d.name.split('\n');
                lines.forEach((line, i) => {
                    const txt = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                    txt.classList.add('node-label');
                    txt.setAttribute('x', d.x);
                    txt.setAttribute('y', d.y + (i - (lines.length - 1) / 2) * (this.simConfig.styles.labelSize * 1.8)); // Spacing relative to font
                    txt.setAttribute('text-anchor', 'middle');
                    txt.setAttribute('dominant-baseline', 'central');
                    txt.setAttribute('fill', '#F1EEFB');
                    txt.setAttribute('font-size', this.simConfig.styles.labelSize); // Dynamic Size
                    txt.textContent = line;
                    g.appendChild(txt);
                });

                // Interaction
                g.onclick = (e) => {
                    e.stopPropagation();
                    this.zoomToNode(d.id);
                };

                this.svg.appendChild(g);
            });
        },

        _updateVisualization: function (year) {
            // Update Connections
            DATA.connections.forEach((conn, i) => {
                const strength = this._getConnectionStrength(conn, year);
                const line = this.svg.getElementById(`conn-${i}`);
                const glow = this.svg.getElementById(`conn-glow-${i}`);
                if (line && glow) {
                    const width = this.simConfig.connections.minWidth + (this.simConfig.connections.maxWidth - this.simConfig.connections.minWidth) * strength;
                    line.setAttribute('stroke-width', width);
                    line.setAttribute('opacity', strength * 0.8);
                    glow.setAttribute('stroke-width', width + 4);
                    glow.setAttribute('opacity', strength * 0.3);
                }
            });

            // Update Center
            const progress = (year - this.simConfig.timeline.startYear) / (this.simConfig.timeline.endYear - this.simConfig.timeline.startYear);
            const size = this.simConfig.nodes.centerRadiusMin + (this.simConfig.nodes.centerRadiusMax - this.simConfig.nodes.centerRadiusMin) * progress;
            const circle = this.svg.getElementById('center-circle');
            if (circle) circle.setAttribute('r', size);
            const halo = this.svg.getElementById('center-halo');
            if (halo) {
                halo.setAttribute('r', size);
                halo.setAttribute('opacity', 0.35 + 0.5 * progress);
            }
            const streak = this.svg.getElementById('center-streak');
            if (streak) streak.setAttribute('opacity', 0.45 + 0.55 * progress);

            const fontSize = this.simConfig.styles.centerLabelSizeMin + (this.simConfig.styles.centerLabelSizeMax - this.simConfig.styles.centerLabelSizeMin) * progress;
            const label = this.svg.querySelector('#center-node text');
            if (label) label.setAttribute('font-size', fontSize);
        },

        // ========== PARTICLES ==========

        _updateParticles: function (dt, year) {
            // Spawn logic
            if (performance.now() - this.lastSpawnTime > 150) {
                this.lastSpawnTime = performance.now();
                this._spawnParticle(year);
            }

            // Move logic
            this.particles.forEach(p => {
                p.progress += 0.005; // speed
                if (p.progress >= 1) p.dead = true;
            });

            this.particles = this.particles.filter(p => !p.dead);
        },

        _spawnParticle: function (year) {
            const activeRefs = DATA.connections
                .map((c, i) => ({ c, i, s: this._getConnectionStrength(c, year) }))
                .filter(x => x.s > 0.1);

            if (activeRefs.length === 0) return;

            const pick = activeRefs[Math.floor(Math.random() * activeRefs.length)];
            const src = this.domainPositions.find(d => d.id === pick.c.source);

            this.particles.push({
                x: src.x,
                y: src.y,
                tx: this.simConfig.svg.centerX,
                ty: this.simConfig.svg.centerY,
                progress: 0,
                color: src.color,
                domainId: src.id
            });

            const nodeG = this.svg.querySelector(`.domain-node[data-id="${src.id}"]`);
            if (nodeG) {
                nodeG.classList.remove('ripple-source');
                void nodeG.offsetWidth; 
                nodeG.classList.add('ripple-source');
            }
        },

        _renderParticles: function (year) {
            let g = this.svg.getElementById('particle-group');
            if (!g) {
                g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
                g.id = 'particle-group';
                this.svg.insertBefore(g, this.svg.getElementById('center-node')); // Behind center
            }

            // Clear old (inefficient but safe for SVG refactor)
            g.innerHTML = '';

            this.particles.forEach(p => {
                const cx = p.x + (p.tx - p.x) * p.progress;
                const cy = p.y + (p.ty - p.y) * p.progress;

                const fade = 1 - p.progress;

                // Luminous trail behind the particle
                const tail = Math.max(0, p.progress - 0.06);
                const trail = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                trail.setAttribute('x1', p.x + (p.tx - p.x) * tail);
                trail.setAttribute('y1', p.y + (p.ty - p.y) * tail);
                trail.setAttribute('x2', cx);
                trail.setAttribute('y2', cy);
                trail.setAttribute('stroke', p.color);
                trail.setAttribute('stroke-width', 2);
                trail.setAttribute('stroke-linecap', 'round');
                trail.setAttribute('opacity', fade * 0.5);
                g.appendChild(trail);

                // Bloom
                const aura = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                aura.setAttribute('cx', cx);
                aura.setAttribute('cy', cy);
                aura.setAttribute('r', 7);
                aura.setAttribute('fill', p.color);
                aura.setAttribute('opacity', fade * 0.7);
                aura.setAttribute('filter', 'url(#cn-blur-sm)');
                g.appendChild(aura);

                // Bright core
                const core = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                core.setAttribute('cx', cx);
                core.setAttribute('cy', cy);
                core.setAttribute('r', 2.2);
                core.setAttribute('fill', '#F1EEFB');
                core.setAttribute('opacity', fade);
                g.appendChild(core);
            });
        },

        // ========== ZOOM ==========

        zoomToNode: function (id) {
            if (this.isZoomed && this.zoomedNode === id) {
                this.zoomOut();
                return;
            }

            const domain = this.domainPositions.find(d => d.id === id);
            if (!domain) return;

            this.isZoomed = true;
            this.zoomedNode = id;

            // Calculate ViewBox
            const size = 330; // Tighter zoom (was 300)
            const vb = `${domain.x - size / 2} ${domain.y - size / 2} ${size} ${size}`;

            this._animateViewBox(vb, 700);

            // Fade others
            this.svg.querySelectorAll('.domain-node').forEach(n => {
                n.style.opacity = (n.dataset.id === id) ? 1 : 0.1;
                n.style.pointerEvents = (n.dataset.id === id) ? 'auto' : 'none';
            });

            // Show content rings
            this._createContentTags(id);
        },

        // ========== RICH CONTENT UTILS ==========

        _getContentForYear: function (domainId, year) {
            if (!DATA || !DATA.domainDetails) return null;
            const details = DATA.domainDetails[domainId];
            if (!details) return null;

            if (!details.contentByYear) return details; // Fallback to flat if no year data

            const availYears = Object.keys(details.contentByYear).map(Number).sort((a, b) => a - b);
            let selectedYear = null;
            // Find most recent year <= current
            for (let i = availYears.length - 1; i >= 0; i--) {
                if (availYears[i] <= year) {
                    selectedYear = availYears[i];
                    break;
                }
            }
            if (selectedYear !== null) return details.contentByYear[selectedYear];
            return details; // Fallback
        },

        _wrapText: function (text, maxWidth, fontSize) {
            const words = text.split(' ');
            const lines = [];
            let currentLine = '';

            // Temp text for measuring
            const temp = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            temp.setAttribute('font-size', fontSize);
            temp.style.visibility = 'hidden';
            this.svg.appendChild(temp);

            words.forEach(word => {
                const testLine = currentLine ? `${currentLine} ${word}` : word;
                temp.textContent = testLine;
                if (temp.getComputedTextLength() > maxWidth && currentLine) {
                    lines.push(currentLine);
                    currentLine = word;
                } else {
                    currentLine = testLine;
                }
            });
            if (currentLine) lines.push(currentLine);
            temp.remove();
            return lines;
        },

        _getVisibleBounds: function () {
            // Because we might be zoomed, getting the viewBox is best
            const vb = this.svg.getAttribute('viewBox').split(' ').map(Number);
            return { x: vb[0], y: vb[1], width: vb[2], height: vb[3] };
        },

        _createContentTags: function (id) {
            // Clear existing rings first
            const existing = this.svg.querySelector('#content-rings');
            if (existing) existing.remove();

            const data = this._getContentForYear(id, this.lastYear || 2015);
            if (!data) return;

            const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            g.id = 'content-rings';
            g.classList.add('content-rings', 'visible');

            const domain = this.domainPositions.find(d => d.id === id);
            // We use fixed bounds relative to the viewbox size we know we set (220)
            const bounds = { width: 220, height: 220 };

            // Dimensions tailored for the zoomed view (Size 330 viewbox)
            // Increased widths to accommodate text better
            const horizontalBoxWidth = bounds.width * 0.70; // Wider (was 0.55)
            const horizontalBoxHeight = bounds.height * 0.35;
            const verticalBoxWidth = bounds.width * 0.35; // Wider (was 0.35)
            const verticalBoxHeight = bounds.height * 0.70;

            // Distances from center
            const radius = this.simConfig.nodes.domainRadius + 5;
            const topDist = radius + 20; // Pushed out slightly
            const sideDist = radius + 15;

            // 1. Contributions (Top)
            if (data.contributions) {
                const x = domain.x - (horizontalBoxWidth / 2);
                const y = domain.y - topDist - horizontalBoxHeight;
                g.appendChild(this._createBox(x, y, horizontalBoxWidth, horizontalBoxHeight, data.contributions, domain.color, 'CONTRIBUTIONS', 'list'));
            }

            // 2. People (Right)
            if (data.keyPeople) {
                const items = data.keyPeople;
                const x = domain.x + sideDist;
                const y = domain.y - (verticalBoxHeight / 2);
                g.appendChild(this._createBox(x, y, verticalBoxWidth, verticalBoxHeight, items, domain.color, 'KEY PEOPLE', 'people'));
            }

            // 3. Tech (Bottom)
            if (data.technologies) {
                const items = data.technologies;
                const x = domain.x - (horizontalBoxWidth / 2);
                const y = domain.y + topDist;
                g.appendChild(this._createBox(x, y, horizontalBoxWidth, horizontalBoxHeight, items, domain.color, 'TECHNOLOGIES', 'list'));
            }

            // 4. Examples (Left)
            if (data.examples) {
                const x = domain.x - sideDist - verticalBoxWidth;
                const y = domain.y - (verticalBoxHeight / 2);
                g.appendChild(this._createBox(x, y, verticalBoxWidth, verticalBoxHeight, data.examples, domain.color, 'EXAMPLES', 'cards'));
            }

            this.svg.appendChild(g);
        },

        _createBox: function (x, y, w, h, items, color, title, type) {
            const NS = 'http://www.w3.org/2000/svg';
            const g = document.createElementNS(NS, 'g');
            g.classList.add('content-section');
            g.style.setProperty('--node-color', color);

            // Rim gradient for this colour (transparent → colour → transparent), made once
            const defs = this.svg.querySelector('#cn-defs');
            const rimId = `cn-rim-${color.replace('#', '')}`;
            if (defs && !defs.querySelector(`#${rimId}`)) {
                const grad = document.createElementNS(NS, 'linearGradient');
                grad.id = rimId;
                [['0%', 0], ['50%', 1], ['100%', 0]].forEach(([o, op]) => {
                    const s = document.createElementNS(NS, 'stop');
                    s.setAttribute('offset', o); s.setAttribute('stop-color', color); s.setAttribute('stop-opacity', op);
                    grad.appendChild(s);
                });
                defs.appendChild(grad);
            }

            // Edge bloom: soft light rising from the top edge (aura)
            const bloom = document.createElementNS(NS, 'ellipse');
            bloom.setAttribute('cx', x + w / 2); bloom.setAttribute('cy', y + 3);
            bloom.setAttribute('rx', w * 0.38); bloom.setAttribute('ry', 7);
            bloom.setAttribute('fill', color);
            bloom.setAttribute('opacity', 0.22);
            bloom.setAttribute('filter', 'url(#cn-blur-md)');
            bloom.style.pointerEvents = 'none';
            g.appendChild(bloom);

            // Glass plate with a hairline border
            const rect = document.createElementNS(NS, 'rect');
            rect.classList.add('panel-bg');
            rect.setAttribute('x', x); rect.setAttribute('y', y);
            rect.setAttribute('width', w); rect.setAttribute('height', h);
            rect.setAttribute('rx', 9);
            rect.setAttribute('fill', 'rgba(15,11,26,0.86)');
            rect.setAttribute('stroke', 'rgba(255,255,255,0.14)');
            rect.setAttribute('stroke-width', 0.75);
            g.appendChild(rect);

            // Rim line: brightest at the centre of the top edge
            const rim = document.createElementNS(NS, 'line');
            rim.setAttribute('x1', x + 9); rim.setAttribute('y1', y + 0.4);
            rim.setAttribute('x2', x + w - 9); rim.setAttribute('y2', y + 0.4);
            rim.setAttribute('stroke', `url(#${rimId})`);
            rim.setAttribute('stroke-width', 1);
            rim.style.pointerEvents = 'none';
            g.appendChild(rim);

            // Eyebrow title: uppercase, wide tracking
            const header = document.createElementNS(NS, 'text');
            header.classList.add('panel-title');
            header.textContent = title;
            header.setAttribute('x', x + w / 2);
            header.setAttribute('y', y + 13);
            header.setAttribute('text-anchor', 'middle');
            header.setAttribute('fill', color);
            header.setAttribute('font-size', this.simConfig.styles.contentHeaderSize * 0.85); // Dynamic
            g.appendChild(header);

            // Gradient underbar (the site's 64×3 section-header bar, scaled)
            const bar = document.createElementNS(NS, 'rect');
            bar.setAttribute('x', x + w / 2 - 12); bar.setAttribute('y', y + 18);
            bar.setAttribute('width', 24); bar.setAttribute('height', 1.1);
            bar.setAttribute('rx', 0.6);
            bar.setAttribute('fill', 'url(#cn-grad-brand)');
            g.appendChild(bar);

            // Content
            let curY = y + 30;
            const maxY = y + h - 5;
            const fontSize = this.simConfig.styles.contentTextSize; // Dynamic
            const padding = 10;
            const textWidth = w - (padding * 2);

            if (type === 'list') {
                items.forEach(item => {
                    if (curY >= maxY) return;
                    const lines = this._wrapText('◇ ' + item, textWidth, fontSize);
                    lines.forEach(l => {
                        const t = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                        t.textContent = l;
                        t.classList.add('panel-text');
                        t.setAttribute('x', x + padding); t.setAttribute('y', curY);
                        t.setAttribute('fill', '#ABA4C9');
                        t.setAttribute('font-size', fontSize);
                        g.appendChild(t);
                        curY += 7;
                    });
                    curY += 2;
                });
            } else if (type === 'people') {
                items.forEach(p => {
                    if (curY >= maxY) return;

                    const nameStr = typeof p === 'string' ? p : p.name;
                    const nameLines = this._wrapText(nameStr, textWidth, fontSize + 0.5);

                    nameLines.forEach(l => {
                        const tn = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                        tn.textContent = l;
                        tn.setAttribute('x', x + padding); tn.setAttribute('y', curY);
                        tn.classList.add('panel-name');
                        tn.setAttribute('fill', '#F1EEFB'); tn.setAttribute('font-weight', '600');
                        tn.setAttribute('font-size', fontSize + 0.5);
                        g.appendChild(tn);
                        curY += 8;
                    });

                    if (typeof p !== 'string' && p.role) {
                        const roleLines = this._wrapText(p.role, textWidth, fontSize);
                        roleLines.forEach(l => {
                            const tr = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                            tr.textContent = l;
                            tr.setAttribute('x', x + padding); tr.setAttribute('y', curY);
                            tr.classList.add('panel-text');
                            tr.setAttribute('fill', '#9890BB');
                            tr.setAttribute('font-size', fontSize);
                            g.appendChild(tr);
                            curY += 7;
                        });
                        curY += 3; // Extra spacing after role
                    } else {
                        curY += 2;
                    }
                });
            } else if (type === 'cards') {
                items.forEach(ex => {
                    if (curY >= maxY) return;

                    // Calculate height needed
                    const titleWidth = ex.url ? textWidth - 20 : textWidth - 4;
                    const nameLines = this._wrapText(ex.name, titleWidth, fontSize + 0.5);
                    const descLines = this._wrapText(ex.type || ex.description, textWidth - 4, fontSize - 0.5);

                    const lineHeight = 7;
                    const cardPadding = 8;
                    const contentHeight = (nameLines.length * lineHeight) + (descLines.length * lineHeight) + 6; // +6 gap
                    const cardHeight = contentHeight + cardPadding;

                    if (curY + cardHeight >= maxY) return;

                    // Card BG
                    const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
                    bg.setAttribute('x', x + 8); bg.setAttribute('y', curY);
                    bg.setAttribute('width', w - 16); bg.setAttribute('height', cardHeight);
                    bg.classList.add('example-card');
                    bg.setAttribute('rx', 5);
                    bg.setAttribute('fill', color); bg.setAttribute('fill-opacity', 0.06);
                    bg.setAttribute('stroke', 'rgba(255,255,255,0.11)'); bg.setAttribute('stroke-width', 0.5);
                    bg.style.cursor = 'pointer';

                    bg.onclick = (e) => {
                        e.stopPropagation();
                        if (ex.url) window.open(ex.url, '_blank');
                    };
                    g.appendChild(bg);

                    if (ex.url) {
                        const iconG = document.createElementNS('http://www.w3.org/2000/svg', 'g');
                        iconG.setAttribute('transform', `translate(${x + w - 22}, ${curY + 6}) scale(0.35)`);
                        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                        path.setAttribute('d', 'M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6 M15 3h6v6 M10 14L21 3');
                        path.setAttribute('fill', 'none');
                        path.setAttribute('stroke', color);
                        path.setAttribute('stroke-width', '2');
                        path.setAttribute('stroke-linecap', 'round');
                        path.setAttribute('stroke-linejoin', 'round');
                        path.style.pointerEvents = 'none';
                        iconG.appendChild(path);
                        g.appendChild(iconG);
                    }

                    let textY = curY + 10;

                    // Name
                    nameLines.forEach(l => {
                        const t = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                        t.textContent = l;
                        t.setAttribute('x', x + 12); t.setAttribute('y', textY);
                        t.setAttribute('font-size', fontSize + 0.5);
                        t.classList.add('panel-name');
                        t.setAttribute('fill', '#F1EEFB');
                        t.setAttribute('font-weight', '600');
                        t.style.pointerEvents = 'none';
                        g.appendChild(t);
                        textY += lineHeight;
                    });

                    textY += 2; // Small gap

                    // Description
                    descLines.forEach(l => {
                        const t2 = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                        t2.textContent = l;
                        t2.setAttribute('x', x + 12); t2.setAttribute('y', textY);
                        t2.setAttribute('font-size', fontSize - 0.5);
                        t2.classList.add('panel-text');
                        t2.setAttribute('fill', '#ABA4C9');
                        t2.style.pointerEvents = 'none';
                        g.appendChild(t2);
                        textY += lineHeight;
                    });

                    curY += cardHeight + 5; // Spacing between cards
                });
            }

            return g;
        },

        zoomOut: function () {
            this.isZoomed = false;
            this.zoomedNode = null;

            this._animateViewBox(`0 0 ${this.simConfig.svg.width} ${this.simConfig.svg.height}`, 400);

            // Reset opacity
            this.svg.querySelectorAll('.domain-node').forEach(n => {
                n.style.opacity = 1;
                n.style.pointerEvents = 'auto';
            });

            // Remove rings
            const rings = this.svg.getElementById('content-rings');
            if (rings) rings.remove();
        },

        reset: function () {
            this.zoomOut();
            this.particles = [];
        },

        // ========== INTERACTION & HELP ==========

        helpOverlay: null,

        _setupKeyboard: function () {
            // Listen on window for global shortcuts when this engine is active
            // Ideally should check if canvas/container has focus or mouseover
            window.addEventListener('keydown', this._handleKey.bind(this));
        },

        _handleKey: function (e) {
            // Check if we mean to interact with inputs
            if (e.target.tagName === 'INPUT') return;

            switch (e.key) {
                case 'ArrowLeft':
                    this._scrubYear(-1);
                    break;
                case 'ArrowRight':
                    this._scrubYear(1);
                    break;
                case 'Escape':
                    if (this.helpOverlay && this.helpOverlay.classList.contains('active')) {
                        this.toggleHelp(false);
                    } else {
                        this.zoomOut();
                    }
                    break;
                case ' ': // Space
                    e.preventDefault();
                    this.zoomOut(); // Or toggle play/pause if we had it
                    break;
                case 'h':
                case 'H':
                case '?':
                    this.toggleHelp();
                    break;
            }
        },

        _scrubYear: function (direction) {
            let newYear = (this.lastYear || this.simConfig.timeline.startYear) + direction;
            if (newYear < this.simConfig.timeline.startYear) newYear = this.simConfig.timeline.startYear;
            if (newYear > this.simConfig.timeline.endYear) newYear = this.simConfig.timeline.endYear;

            // We need to update the Host Parameters too, otherwise it will fight back
            // Assuming Host exposes a way or we just update our internal state and let Host sync?
            // The method 'config' binds UI to params. If we change params, we should update UI.
            // But here we don't have direct access to Host controls easily without a reference.
            // HACK: Dispatch an input event on the slider if we can find it?

            // Better: Just update visually for now, and rely on Loop to pick it up? 
            // Loop calls 'update(dt, params)'. If we change params locally, they get overwritten by Host UI.
            // So we need to Find the Slider.

            const slider = document.querySelector('input[type="range"]'); // Risky if multiple
            if (slider) {
                slider.value = newYear;
                slider.dispatchEvent(new Event('input'));
            }
        },

        initHelp: function () {
            // 1. Create Modal
            const modal = document.createElement('div');
            modal.className = 'help-modal';
            modal.innerHTML = `
                <span class="help-eyebrow">Cyberdelic convergence</span>
                <h2>Controls</h2>
                <span class="help-underbar" aria-hidden="true"></span>
                <div class="help-keyable"><span>Scrub the timeline</span> <span><span class="key-badge">←</span> <span class="key-badge">→</span></span></div>
                <div class="help-keyable"><span>Zoom out</span> <span><span class="key-badge">Space</span> <span class="key-badge">Esc</span></span></div>
                <div class="help-keyable"><span>Open a domain</span> <span><span class="key-badge">Click</span></span></div>
                <div class="help-keyable"><span>Toggle help</span> <span><span class="key-badge">H</span></span></div>
                <div class="help-actions">
                    <button class="help-restart-tutorial">Restart tutorial</button>
                    <button class="help-close">Close</button>
                </div>
            `;

            // 1.5 Bind Restart Tutorial
            modal.querySelector('.help-restart-tutorial').onclick = () => {
                this.toggleHelp(false);
                this.startTutorial();
            };

            // 2. Create Hint Button
            const hintBtn = document.createElement('button');
            hintBtn.className = 'help-hint-btn';
            hintBtn.innerHTML = 'Controls <span class="key-badge">H</span>';
            hintBtn.title = 'Press H for Controls';
            hintBtn.onclick = () => this.toggleHelp();

            if (this.svg && this.svg.parentNode) {
                this.svg.parentNode.appendChild(modal);
                this.svg.parentNode.appendChild(hintBtn);

                // Ensure relative positioning on parent for absolute children
                if (getComputedStyle(this.svg.parentNode).position === 'static') {
                    this.svg.parentNode.style.position = 'relative';
                }
            }
            this.helpOverlay = modal;
            this.helpHintBtn = hintBtn;

            modal.querySelector('.help-close').onclick = () => this.toggleHelp(false);
        },

        toggleHelp: function (forceState) {
            if (!this.helpOverlay) this.initHelp();

            if (forceState !== undefined) {
                if (forceState) this.helpOverlay.classList.add('active');
                else this.helpOverlay.classList.remove('active');
            } else {
                this.helpOverlay.classList.toggle('active');
            }
        },

        destroy: function () {
            // Framework handles cleanup, removing SVG
            if (this.tutorialOverlay && typeof this.tutorialOverlay.destroy === 'function') {
                this.tutorialOverlay.destroy();
            }
            if (this.helpOverlay) this.helpOverlay.remove();
            window.removeEventListener('keydown', this._handleKey); // Remove listener!
        },

        // ========== TUTORIAL ==========

        tutorialOverlay: null,

        initTutorial: function () {
            // Check if TutorialOverlay is available
            if (typeof TutorialOverlay === 'undefined') {
                console.warn('[CyberdelicConvergence] TutorialOverlay not found.');
                return;
            }

            if (!this.tutorialOverlay) {
                // Find container (parent of SVG)
                const container = this.svg && this.svg.parentNode ? this.svg.parentNode : document.body;
                this.tutorialOverlay = new TutorialOverlay(container);
            }

            // Auto-start after delay
            setTimeout(() => this.startTutorial(), 1000);
        },

        startTutorial: function () {
            if (!DATA.tutorialSteps || !this.tutorialOverlay) return;

            // Map data steps to TutorialOverlay format if needed
            // Currently they share structure { title, text, target, position }
            // But we need to handle specific targets that are selectors vs elements

            const steps = DATA.tutorialSteps.map(step => {
                let target = step.target;

                // If target is a selector for an element inside SVG, we need to find it
                if (typeof target === 'string' && target !== '#timeline-container') {
                    // Try to find in SVG first
                    const el = this.svg.querySelector(target);
                    if (el) target = el;
                }

                return {
                    ...step,
                    target: target,
                    spotlightSize: step.id === 'domains' ? 600 : undefined
                };
            });

            this.tutorialOverlay.start(steps);
        },
    };

})();