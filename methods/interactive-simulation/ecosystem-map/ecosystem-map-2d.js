/**
 * Ecosystem Map - Simulation Engine
 * Registers to window.SimulationEngines['EcosystemMap']
 * Follows CyberdelicConvergence pattern.
 *
 * Tier 3: Accordion sidebar, connection descriptions, ripple trace animation.
 * Completion gate: student must visit all 8 nodes before host.markComplete() fires.
 */
(function () {
    window.SimulationEngines = window.SimulationEngines || {};

    const DATA = window.EcosystemMapData;

    window.SimulationEngines['EcosystemMap'] = {
        name: 'Ecosystem Map',
        showPlaybackControls: false,
        config: [],
        defaults: {},

        // ─── Instance State ───────────────────────────────────────────────
        svg: null,
        svgContainer: null,
        panel: null,
        nodePositions: [],
        particles: [],
        pulseTimer: 0,
        isZoomed: false,
        zoomedNodeId: null,
        visitedNodes: null,
        continueUnlocked: false,
        host: null,
        ripplePlaying: false,
        rippleLabels: [],

        // ─── Lifecycle ────────────────────────────────────────────────────
        init: function (container, params, host) {
            this.host = host;

            // Reset state for re-init safety
            this.isZoomed = false;
            this.zoomedNodeId = null;
            this.visitedNodes = new Set();
            this.continueUnlocked = false;
            this.particles = [];
            this.pulseTimer = 0;
            this.ripplePlaying = false;
            this.rippleLabels = [];

            // Build DOM skeleton
            container.innerHTML = '';
            const wrapper = document.createElement('div');
            wrapper.className = 'ecosystem-map-wrapper';
            container.appendChild(wrapper);

            // Left: SVG container
            const svgContainer = document.createElement('div');
            svgContainer.className = 'ecosystem-map-svg-container';
            wrapper.appendChild(svgContainer);
            this.svgContainer = svgContainer;

            // SVG element
            const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svg.setAttribute('viewBox', `0 0 ${DATA.svg.width} ${DATA.svg.height}`);
            svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
            // background moved to CSS classes to prevent boxy empty space
            svgContainer.appendChild(svg);
            this.svg = svg;

            // Click SVG background to deselect
            svg.addEventListener('click', (e) => {
                if (e.target === svg || e.target.tagName === 'svg') this._zoomOut();
            });

            // Right: detail panel
            const panel = document.createElement('div');
            panel.className = 'ecosystem-map-panel';
            panel.innerHTML = this._panelTemplate();
            wrapper.appendChild(panel);
            this.panel = panel;

            // Hint text
            const hint = document.createElement('div');
            hint.className = 'em-hint';
            hint.textContent = 'CLICK ANY NODE TO EXPLORE';
            svgContainer.appendChild(hint);
            this._hintEl = hint;

            // Build positions then draw (z-order: connections → center → nodes)
            this._calculatePositions();
            this._drawConnections();
            this._drawCenterNode();
            this._drawNodes();
            this._initParticles();
        },

        update: function (dt, params) {
            this._updateParticles(dt);
            this._updateCenterPulse(dt);
        },

        resize: function (width, height) {
            // viewBox + preserveAspectRatio handles scaling automatically
        },

        destroy: function () {
            this._clearRippleLabels();
            this.svg = null;
            this.svgContainer = null;
            this.panel = null;
            this.particles = [];
            this.host = null;
            this.visitedNodes = null;
        },

        // ─── Layout ───────────────────────────────────────────────────────
        _calculatePositions: function () {
            this.nodePositions = DATA.nodes.map(node => {
                const rad = (node.angle * Math.PI) / 180;
                return {
                    ...node,
                    x: DATA.svg.cx + DATA.orbitRadius * Math.cos(rad),
                    y: DATA.svg.cy + DATA.orbitRadius * Math.sin(rad)
                };
            });
        },

        // ─── Drawing ──────────────────────────────────────────────────────
        _drawCenterNode: function () {
            const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            g.id = 'em-center-node';

            // Glow halo
            const halo = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            halo.setAttribute('cx', DATA.svg.cx);
            halo.setAttribute('cy', DATA.svg.cy);
            halo.setAttribute('r', 44);
            halo.setAttribute('fill', 'rgba(6,182,212,0.06)');
            halo.setAttribute('stroke', 'none');
            g.appendChild(halo);

            // Outer ring
            const outer = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            outer.setAttribute('cx', DATA.svg.cx);
            outer.setAttribute('cy', DATA.svg.cy);
            outer.setAttribute('r', 38);
            outer.setAttribute('fill', 'rgba(6,182,212,0.1)');
            outer.setAttribute('stroke', '#06b6d4');
            outer.setAttribute('stroke-width', 1.5);
            outer.style.filter = 'drop-shadow(0 0 8px rgba(6,182,212,0.5))';
            g.appendChild(outer);

            // Inner ring
            const inner = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            inner.setAttribute('cx', DATA.svg.cx);
            inner.setAttribute('cy', DATA.svg.cy);
            inner.setAttribute('r', 26);
            inner.setAttribute('fill', 'rgba(6,182,212,0.06)');
            inner.setAttribute('stroke', '#06b6d4');
            inner.setAttribute('stroke-width', 0.5);
            g.appendChild(inner);

            // Animated pulse ring
            const pulse = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            pulse.id = 'em-center-pulse';
            pulse.setAttribute('cx', DATA.svg.cx);
            pulse.setAttribute('cy', DATA.svg.cy);
            pulse.setAttribute('r', 38);
            pulse.setAttribute('fill', 'none');
            pulse.setAttribute('stroke', '#06b6d4');
            pulse.setAttribute('stroke-width', 1);
            pulse.setAttribute('opacity', 0);
            g.appendChild(pulse);

            // Labels
            ['CYBERDELIC', 'ECOSYSTEM'].forEach((line, i) => {
                const txt = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                txt.textContent = line;
                txt.setAttribute('x', DATA.svg.cx);
                txt.setAttribute('y', DATA.svg.cy + (i === 0 ? -5 : 8));
                txt.setAttribute('text-anchor', 'middle');
                txt.setAttribute('fill', '#06b6d4');
                txt.setAttribute('font-size', 7);
                txt.setAttribute('font-family', 'Orbitron, monospace');
                txt.setAttribute('font-weight', 'bold');
                txt.style.pointerEvents = 'none';
                g.appendChild(txt);
            });

            this.svg.appendChild(g);
        },

        _drawConnections: function () {
            const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            g.id = 'em-connections';

            // Spokes (node → center) - always straight
            this.nodePositions.forEach(node => {
                this._addConnectionLine(g, node.x, node.y, DATA.svg.cx, DATA.svg.cy, node.color, `spoke-${node.id}`, true);
            });

            // Dynamic connections based on DATA.nodes[i].connections
            const drawnPairs = new Set();
            this.nodePositions.forEach(src => {
                src.connections.forEach(targetId => {
                    const tgt = this.nodePositions.find(n => n.id === targetId);
                    if (!tgt) return;
                    
                    const pairKey = [src.id, tgt.id].sort().join('-');
                    if (drawnPairs.has(pairKey)) return;
                    drawnPairs.add(pairKey);

                    let diff = Math.abs(src.angle - tgt.angle);
                    if (diff > 180) diff = 360 - diff;
                    
                    const isAcross = diff > 135;
                    this._addConnectionLine(g, src.x, src.y, tgt.x, tgt.y, src.color, `lateral-${src.id}-${tgt.id}`, isAcross);
                });
            });

            this.svg.appendChild(g);
        },

        _addConnectionLine: function (parent, x1, y1, x2, y2, color, id, isStraight) {
            // Blurred glow layer
            const glow = document.createElementNS('http://www.w3.org/2000/svg', isStraight ? 'line' : 'path');
            glow.id = `em-conn-glow-${id}`;
            glow.setAttribute('stroke', color);
            glow.setAttribute('stroke-width', 4);
            glow.setAttribute('fill', 'none');
            glow.setAttribute('opacity', 0);
            glow.style.filter = 'blur(3px)';
            parent.appendChild(glow);

            // Sharp line
            const line = document.createElementNS('http://www.w3.org/2000/svg', isStraight ? 'line' : 'path');
            line.id = `em-conn-${id}`;
            line.setAttribute('stroke', color);
            line.setAttribute('stroke-width', 0.8);
            line.setAttribute('fill', 'none');
            line.setAttribute('opacity', 0);
            parent.appendChild(line);

            if (isStraight) {
                glow.setAttribute('x1', x1); glow.setAttribute('y1', y1);
                glow.setAttribute('x2', x2); glow.setAttribute('y2', y2);
                line.setAttribute('x1', x1); line.setAttribute('y1', y1);
                line.setAttribute('x2', x2); line.setAttribute('y2', y2);
            } else {
                // Curved Arc around outer radius
                const r = DATA.orbitRadius;
                const cx = DATA.svg.cx;
                const cy = DATA.svg.cy;
                const v1x = x1 - cx, v1y = y1 - cy;
                const v2x = x2 - cx, v2y = y2 - cy;
                const cross = v1x * v2y - v1y * v2x;
                const sweep = cross > 0 ? 1 : 0;
                
                const d = `M ${x1} ${y1} A ${r} ${r} 0 0 ${sweep} ${x2} ${y2}`;
                glow.setAttribute('d', d);
                line.setAttribute('d', d);
            }
        },

        _drawNodes: function () {
            this.nodePositions.forEach(node => {
                const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
                g.classList.add('ecosystem-node');
                g.dataset.id = node.id;

                // Node circle
                const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                circle.setAttribute('cx', node.x);
                circle.setAttribute('cy', node.y);
                circle.setAttribute('r', DATA.nodeRadius);
                circle.setAttribute('fill', node.color);
                circle.setAttribute('fill-opacity', 0.15);
                circle.setAttribute('stroke', node.color);
                circle.setAttribute('stroke-width', 2);
                circle.style.filter = `drop-shadow(0 0 6px ${node.color}40)`;
                g.appendChild(circle);

                // Label (split on \n)
                const lines = node.label.split('\n');
                lines.forEach((line, i) => {
                    const txt = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                    txt.classList.add('em-node-label');
                    txt.textContent = line;
                    txt.setAttribute('x', node.x);
                    txt.setAttribute('y', node.y + (i - (lines.length - 1) / 2) * 13);
                    txt.setAttribute('text-anchor', 'middle');
                    txt.setAttribute('dominant-baseline', 'middle');
                    txt.setAttribute('fill', node.color);
                    txt.setAttribute('font-size', 7.5);
                    txt.setAttribute('font-family', 'Orbitron, monospace');
                    txt.setAttribute('font-weight', 'bold');
                    txt.style.pointerEvents = 'none';
                    g.appendChild(txt);
                });

                // Click handler
                g.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (!this.ripplePlaying) this._selectNode(node.id);
                });

                this.svg.appendChild(g);
            });
        },

        // ─── Interaction ──────────────────────────────────────────────────
        _selectNode: function (id) {
            // Un-zoom logic
            this._cancelRippleTrace(); // ALWAYS clear any running/lingering trace visuals

            // Toggle off if already active
            if (this.isZoomed && this.zoomedNodeId === id) {
                this._zoomOut();
                return;
            }

            this.isZoomed = true;
            this.zoomedNodeId = id;

            // Hide hint
            if (this._hintEl) this._hintEl.style.opacity = '0';

            // Find connected nodes
            const activeNode = DATA.nodes.find(n => n.id === id);
            const connectedSet = new Set(activeNode.connections);
            DATA.nodes.forEach(n => {
                if (n.connections.includes(id)) connectedSet.add(n.id);
            });
            connectedSet.add(id);

            // Dim all other nodes, highlight active & connected
            this.svg.querySelectorAll('.ecosystem-node').forEach(g => {
                const checkId = g.dataset.id;
                g.classList.remove('ripple-active', 'ripple-source');
                if (checkId === id) {
                    g.classList.remove('dimmed');
                    g.classList.add('active');
                } else if (connectedSet.has(checkId)) {
                    g.classList.remove('dimmed');
                    g.classList.remove('active');
                } else {
                    g.classList.add('dimmed');
                    g.classList.remove('active');
                }
            });

            this._updateConnectionVisibility(id);
            this._populatePanel(id);
            this.panel.classList.add('visible');

            // Mark visited
            const isNew = !this.visitedNodes.has(id);
            this.visitedNodes.add(id);

            if (isNew) {
                this._updateProgress();
            }

            // Interaction complete signal (Unlocks but does not force transition)
            if (this.visitedNodes.size === 8 && !this.continueUnlocked) {
                this.continueUnlocked = true;
                const simContainer = this.host._elements.container.querySelector('.interactive-simulation-container') || this.host._elements.container;
                if (simContainer) {
                    simContainer.classList.add('interaction-complete');
                }
            }
        },

        _zoomOut: function () {
            this.isZoomed = false;
            this.zoomedNodeId = null;

            this._cancelRippleTrace(); // Clear it here too to be safe

            this.svg.querySelectorAll('.ecosystem-node').forEach(g => {
                g.classList.remove('dimmed', 'active', 'ripple-active', 'ripple-source');
            });

            this._updateConnectionVisibility(null);
            this.panel.classList.remove('visible');
        },

        _updateConnectionVisibility: function (activeNodeId) {
            const connGroup = this.svg.getElementById('em-connections');
            if (!connGroup) return;

            connGroup.querySelectorAll('line, path').forEach(line => {
                const id = line.id;
                const isGlow = id.includes('glow');

                if (!activeNodeId) {
                    // Restore slightly faded base state for spokes, hide laterals
                    const isSpoke = id.includes('spoke');
                    line.setAttribute('opacity', isSpoke ? (isGlow ? 0.08 : 0.2) : 0);
                    return;
                }

                // Does this connection involve the active node?
                const involves = id.includes(`-${activeNodeId}-`) || id.endsWith(`-${activeNodeId}`) || id.includes(`spoke-${activeNodeId}`);
                if (involves) {
                    line.setAttribute('opacity', isGlow ? 0.35 : 0.85);
                } else {
                    line.setAttribute('opacity', 0);
                }
            });
        },

        // ─── Panel ────────────────────────────────────────────────────────
        _panelTemplate: function () {
            return `
                <div class="em-panel-header">
                    <div class="em-panel-dot"></div>
                    <div style="flex:1;min-width:0;">
                        <div class="em-panel-title"></div>
                        <div class="em-panel-subtitle"></div>
                    </div>
                </div>
                <div class="em-panel-body"></div>
                <div class="em-panel-footer"></div>
            `;
        },

        _populatePanel: function (id) {
            const node = DATA.nodes.find(n => n.id === id);
            if (!node || !this.panel) return;

            const p = this.panel;

            // Header
            const dot = p.querySelector('.em-panel-dot');
            dot.style.background = node.color;
            dot.style.boxShadow = `0 0 6px ${node.color}`;
            const titleEl = p.querySelector('.em-panel-title');
            titleEl.textContent = node.label.replace('\n', ' ');
            titleEl.style.color = node.color;
            p.querySelector('.em-panel-subtitle').textContent = node.subtitle;

            // Build accordion body
            const body = p.querySelector('.em-panel-body');
            body.innerHTML = '';

            // Section 1: Role in Ecosystem (starts open)
            this._addAccordionSection(body, 'Role in Ecosystem', node.role.slice(0, 50) + '…', `
                <div class="em-role-text">${node.role}</div>
            `, true, node.color);

            // Section 2: Key Players
            if (node.keyPlayers && node.keyPlayers.length) {
                const playersHtml = `<ul class="em-player-list">
                    ${node.keyPlayers.map(pl => `
                        <li class="em-player-item">
                            <div class="em-player-name" style="color:${node.color}">${pl.name}</div>
                            <div class="em-player-detail">${pl.detail}</div>
                        </li>
                    `).join('')}
                </ul>`;
                this._addAccordionSection(body, 'Key Players', `${node.keyPlayers.length} organizations`, playersHtml, false, node.color);
            }

            // Section 3: Challenge
            this._addAccordionSection(body, '▼ Key Challenge', '', `
                <div class="em-challenge-card">${node.challenge}</div>
            `, false, node.color);

            // Section 4: Opportunity
            this._addAccordionSection(body, '▲ Key Opportunity', '', `
                <div class="em-opportunity-card">${node.opportunity}</div>
            `, false, node.color);

            // Section 5: Connections
            this._addConnectionsSection(body, node);

            // Section 6: Ripple Trace
            this._addRippleSection(body, node);

            // Footer
            p.querySelector('.em-panel-footer').innerHTML =
                `<span style="color:${node.color};opacity:0.9;">⚡</span> <span style="color:#64748b;">${node.ripple}</span>`;
        },

        _addAccordionSection: function (parent, title, preview, contentHtml, startOpen, accentColor) {
            const section = document.createElement('div');
            section.className = 'em-accordion-section' + (startOpen ? ' open' : '');

            section.innerHTML = `
                <div class="em-accordion-header">
                    <span class="em-accordion-title">${title}</span>
                    <span class="em-accordion-preview">${preview}</span>
                    <span class="em-accordion-arrow">▾</span>
                </div>
                <div class="em-accordion-body">${contentHtml}</div>
            `;

            section.querySelector('.em-accordion-header').addEventListener('click', () => {
                section.classList.toggle('open');
            });

            parent.appendChild(section);
        },

        _addConnectionsSection: function (body, node) {
            let html = '';
            node.connections.forEach(cid => {
                const cn = DATA.nodes.find(n => n.id === cid);
                if (!cn) return;

                // Look up connection descriptions (both directions)
                const descOut = DATA.connectionDescriptions[`${node.id}→${cid}`] || '';
                const descIn = DATA.connectionDescriptions[`${cid}→${node.id}`] || '';
                const desc = descOut || descIn || 'Connected ecosystem component';

                html += `
                    <div class="em-connection-item">
                        <div class="em-connection-dot" style="background:${cn.color};box-shadow:0 0 4px ${cn.color}"></div>
                        <div class="em-connection-info">
                            <div class="em-connection-name" style="color:${cn.color}">${cn.label.replace('\n', ' ')}</div>
                            <div class="em-connection-desc">${desc}</div>
                        </div>
                    </div>
                `;
            });

            // Also show reverse connections (nodes that connect TO this one but aren't in its list)
            DATA.nodes.forEach(n => {
                if (n.id === node.id) return;
                if (node.connections.includes(n.id)) return; // Already shown
                if (!n.connections.includes(node.id)) return; // Doesn't connect to us

                const desc = DATA.connectionDescriptions[`${n.id}→${node.id}`] || DATA.connectionDescriptions[`${node.id}→${n.id}`] || 'Connected ecosystem component';
                html += `
                    <div class="em-connection-item">
                        <div class="em-connection-dot" style="background:${n.color};box-shadow:0 0 4px ${n.color}"></div>
                        <div class="em-connection-info">
                            <div class="em-connection-name" style="color:${n.color}">← ${n.label.replace('\n', ' ')}</div>
                            <div class="em-connection-desc">${desc}</div>
                        </div>
                    </div>
                `;
            });

            if (html) {
                this._addAccordionSection(body, 'Connections', `${node.connections.length} links`, html, false, node.color);
            }
        },

        _addRippleSection: function (body, node) {
            // Find ripple chains that start at this node
            const chains = (DATA.rippleChains || []).filter(c => c.startNode === node.id);
            if (!chains.length) return;

            const html = `<div class="em-ripple-options">
                ${chains.map(chain => `
                    <button class="em-ripple-btn" data-chain-id="${chain.id}">
                        <span>⚡</span>
                        <span>${chain.title}</span>
                    </button>
                    <div class="em-role-text" style="font-size:11px;margin-bottom:4px; margin-top:2px;">${chain.description}</div>
                `).join('')}
            </div>`;

            // Open by default so the user sees the feature right away
            this._addAccordionSection(body, 'Trace Ripple Effect', 'Animated cascade', html, true, node.color);

            // Attach click handlers after DOM insert
            setTimeout(() => {
                body.querySelectorAll('.em-ripple-btn').forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        const chainId = btn.dataset.chainId;
                        const chain = DATA.rippleChains.find(c => c.id === chainId);
                        if (chain) this._playRippleTrace(chain, btn);
                    });
                });
            }, 50);
        },

        // ─── Ripple Trace Animation ───────────────────────────────────────
        _cancelRippleTrace: function () {
            // Clear running timers
            if (this.rippleTimeouts) {
                this.rippleTimeouts.forEach(clearTimeout);
                this.rippleTimeouts = [];
            }
            this.ripplePlaying = false;
            
            // Revert any "Tracing..." buttons in the panel
            if (this.panel) {
                const btns = this.panel.querySelectorAll('.em-ripple-btn');
                btns.forEach(btn => {
                    btn.classList.remove('playing');
                    // We don't restore exact text easily here, but _populatePanel re-renders it on node click anyway.
                });
            }

            this._clearRippleLabels();
            this._clearRippleNodeStates();
        },

        _playRippleTrace: function (chain, btn) {
            if (this.ripplePlaying) return;
            this.ripplePlaying = true;
            this.rippleTimeouts = []; // Reset tracker

            btn.classList.add('playing');
            btn.textContent = '⚡ TRACING…';

            // Clear any previous ripple state before starting new one
            this._clearRippleLabels();
            this._clearRippleNodeStates();

            // Dim all nodes first
            this.svg.querySelectorAll('.ecosystem-node').forEach(g => {
                g.classList.add('dimmed');
                g.classList.remove('active');
            });

            // Hide all connections
            const connGroup = this.svg.getElementById('em-connections');
            if (connGroup) {
                connGroup.querySelectorAll('line, path').forEach(el => {
                    el.setAttribute('opacity', 0);
                });
            }

            // Illuminate start node
            const startG = this.svg.querySelector(`.ecosystem-node[data-id="${chain.startNode}"]`);
            if (startG) {
                startG.classList.remove('dimmed');
                startG.classList.add('ripple-source');
            }

            // Step through the chain
            const stepDelay = 2800; // SLOWED DOWN PER USER REQUEST
            const activatedNodes = new Set([chain.startNode]);

            chain.steps.forEach((step, i) => {
                const timeoutId = setTimeout(() => {
                    if (!this.svg) return; // Destroyed check

                    // Activate target node
                    activatedNodes.add(step.to);
                    const targetG = this.svg.querySelector(`.ecosystem-node[data-id="${step.to}"]`);
                    if (targetG) {
                        targetG.classList.remove('dimmed');
                        targetG.classList.add('ripple-active');
                    }

                    // Show connection line between from and to
                    this._showRippleConnection(step.from, step.to);

                    // Add step number badge on the target node
                    this._addRippleBadge(step.to, i + 1, step.label);

                    // Show label overlay centrally
                    this._showRippleLabel(step.label);

                    // End of chain
                    if (i === chain.steps.length - 1) {
                        const endTimeout = setTimeout(() => {
                            this._endRippleTrace(btn, chain);
                        }, stepDelay + 1000);
                        this.rippleTimeouts.push(endTimeout);
                    }
                }, stepDelay * i + 800); // initial offset so 1st happens slightly after start

                this.rippleTimeouts.push(timeoutId);
            });
        },

        _showRippleConnection: function (fromId, toId) {
            const connGroup = this.svg.getElementById('em-connections');
            if (!connGroup) return;

            // Find matching elements
            connGroup.querySelectorAll('line, path').forEach(el => {
                const id = el.id;
                if (id.includes(fromId) && id.includes(toId) && !id.includes('spoke')) {
                    const isGlow = id.includes('glow');
                    el.setAttribute('opacity', isGlow ? 0.6 : 1);
                    el.setAttribute('stroke', '#06b6d4');
                    el.setAttribute('stroke-width', isGlow ? 8 : 2);
                }
            });
        },

        _addRippleBadge: function (nodeId, stepNum, labelText) {
            const node = this.nodePositions.find(n => n.id === nodeId);
            if (!node) return;

            // Push the badge outward from the center relative to the node
            const dx = node.x - DATA.svg.cx;
            const dy = node.y - DATA.svg.cy;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
            const offsetAmt = DATA.nodeRadius + 14; // px outward relative to center, so 14px past the edge
            const badgeX = node.x + (dx / dist) * offsetAmt;
            const badgeY = node.y + (dy / dist) * offsetAmt;

            // Background circle for badge
            const bgCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            bgCircle.setAttribute('cx', badgeX);
            bgCircle.setAttribute('cy', badgeY);
            bgCircle.setAttribute('r', 10);
            bgCircle.setAttribute('fill', '#06b6d4');
            bgCircle.classList.add('em-ripple-badge-bg');
            
            // Interaction to re-show the text for this step
            bgCircle.addEventListener('click', (e) => {
                e.stopPropagation();
                // Ensure it's not currently playing before overriding the label
                // but actually, we only add "ripple-complete" after it plays, 
                // so it's mostly only obvious to click after it plays anyway.
                this._showRippleLabel(labelText);
            });

            this.svg.appendChild(bgCircle);

            // Number text
            const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            text.textContent = stepNum;
            text.setAttribute('x', badgeX);
            text.setAttribute('y', badgeY);
            text.setAttribute('text-anchor', 'middle');
            text.setAttribute('dominant-baseline', 'central');
            text.classList.add('em-ripple-badge');
            text.setAttribute('fill', '#080d14');
            text.setAttribute('font-size', '10px');
            text.setAttribute('font-weight', 'bold');
            this.svg.appendChild(text);

            // Track for cleanup
            this.rippleLabels.push(bgCircle, text);
        },

        _showRippleLabel: function (labelText) {
            if (!this.svgContainer) return;

            // Anchor exactly right above the Cyberdelic Ecosystem center node
            // Center is at svg.cx, svg.cy. 
            // We use standard HTML overlay absolute positioning like before, but fixed to center.
            
            const svgRect = this.svg.getBoundingClientRect();
            const containerRect = this.svgContainer.getBoundingClientRect();
            const scaleX = svgRect.width / DATA.svg.width;
            const scaleY = svgRect.height / DATA.svg.height;
            
            // Offset a bit above center
            const pixelX = svgRect.left - containerRect.left + (DATA.svg.cx * scaleX);
            const pixelY = svgRect.top - containerRect.top + ((DATA.svg.cy - 75) * scaleY);

            const label = document.createElement('div');
            label.className = 'em-ripple-label em-central-ripple-label';
            label.textContent = labelText;
            label.style.left = pixelX + 'px';
            label.style.top = pixelY + 'px';
            label.style.transform = 'translate(-50%, -50%)';
            // Custom styling for central label to make it pop
            label.style.padding = '12px 20px';
            label.style.fontSize = '16px';
            label.style.maxWidth = '320px';
            label.style.boxShadow = '0 0 20px rgba(6, 182, 212, 0.5)';
            label.style.zIndex = '60';

            this.svgContainer.appendChild(label);

            // Animate in
            requestAnimationFrame(() => {
                label.classList.add('visible');
            });

            // Fade out previous labels
            this.rippleLabels.forEach(el => {
                if (el.classList && el.classList.contains('em-ripple-label') && el !== label) {
                    el.classList.remove('visible');
                    setTimeout(() => { if (el.parentNode) el.parentNode.removeChild(el); }, 300);
                }
            });

            // Remove stale label refs that are gone
            this.rippleLabels = this.rippleLabels.filter(el => {
                if (el.classList && el.classList.contains('em-ripple-label') && el !== label) return false;
                return true;
            });

            this.rippleLabels.push(label);
        },

        _endRippleTrace: function (btn, chain) {
            this.ripplePlaying = false;
            btn.classList.remove('playing');
            btn.innerHTML = `<span>⚡</span><span>${chain.title}</span>`;
            
            // Pulsate the badges to indicate they are interactive
            if (this.svg) {
                this.svg.querySelectorAll('.em-ripple-badge-bg').forEach(circle => {
                    circle.classList.add('ripple-complete');
                });
            }
            // We NO LONGER clear the labels and nodes here. 
            // They remain visible until the user clicks a new node.
            
            // (Optional) Could restore selection but we want the ripple path to stay prominent 
            // until a new click triggers _cancelRippleTrace via _selectNode.
        },

        _clearRippleLabels: function () {
            (this.rippleLabels || []).forEach(el => {
                if (el && el.parentNode) el.parentNode.removeChild(el);
            });
            this.rippleLabels = [];
        },

        _clearRippleNodeStates: function () {
            if (!this.svg) return;
            this.svg.querySelectorAll('.ecosystem-node').forEach(g => {
                g.classList.remove('ripple-active', 'ripple-source');
            });
        },

        _updateProgress: function () {
            // Disabled per user request
        },

        // ─── Particles ────────────────────────────────────────────────────
        _initParticles: function () {
            this.particles = [];

            // Dynamic lateral connections based on arrays
            const drawnPairs = new Set();
            const lateralConns = [];
            this.nodePositions.forEach(src => {
                src.connections.forEach(targetId => {
                    const tgt = this.nodePositions.find(n => n.id === targetId);
                    if (!tgt) return;
                    const pairKey = [src.id, tgt.id].sort().join('-');
                    if (drawnPairs.has(pairKey)) return;
                    drawnPairs.add(pairKey);

                    let diff = Math.abs(src.angle - tgt.angle);
                    if (diff > 180) diff = 360 - diff;
                    const isAcross = diff > 135;
                    
                    lateralConns.push({
                        srcNode: src,
                        tgtNode: tgt,
                        isAcross: isAcross
                    });
                });
            });

            // Particles for the lateral paths exclusively (pulsing from active node)
            lateralConns.forEach((conn, ci) => {
                // Two particles per connection link
                for (let j = 0; j < 2; j++) {
                    const baseSpeed = 0.0020 + Math.random() * 0.0030;
                    this.particles.push({
                        conn: conn,
                        node1: conn.srcNode.id,
                        node2: conn.tgtNode.id,
                        progress: (ci / lateralConns.length + j * 0.5) % 1,
                        speed: baseSpeed,
                        baseSpeed: baseSpeed
                    });
                }
            });

            // Create SVG group behind center node
            let g = this.svg.getElementById('em-particle-group');
            if (!g) {
                g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
                g.id = 'em-particle-group';
                const centerNode = this.svg.getElementById('em-center-node');
                if (centerNode) {
                    this.svg.insertBefore(g, centerNode);
                } else {
                    this.svg.appendChild(g);
                }
            }
        },

        _updateParticles: function (dt) {
            const g = this.svg ? this.svg.getElementById('em-particle-group') : null;
            if (!g) return;

            // Clear previous frame's particles
            while (g.firstChild) g.removeChild(g.firstChild);

            if (!this.isZoomed || !this.zoomedNodeId || this.ripplePlaying) return;

            this.particles.forEach(p => {
                // Only animate particles moving along connections matching zoomed node
                if (p.node1 !== this.zoomedNodeId && p.node2 !== this.zoomedNodeId) return;

                p.speed = p.baseSpeed * 2.5;
                p.progress += p.speed;
                if (p.progress > 1) p.progress -= 1;

                // Travel strictly outwards from active Node -> target Node
                const startNode = p.node1 === this.zoomedNodeId ? p.conn.srcNode : p.conn.tgtNode;
                const endNode = p.node1 === this.zoomedNodeId ? p.conn.tgtNode : p.conn.srcNode;

                let cx, cy;
                if (p.conn.isAcross) {
                    cx = startNode.x + (endNode.x - startNode.x) * p.progress;
                    cy = startNode.y + (endNode.y - startNode.y) * p.progress;
                } else {
                    let a1 = startNode.angle;
                    let a2 = endNode.angle;
                    if (Math.abs(a2 - a1) > 180) {
                        if (a2 > a1) a1 += 360;
                        else a2 += 360;
                    }
                    const angle = a1 + (a2 - a1) * p.progress;
                    const rad = (angle * Math.PI) / 180;
                    cx = DATA.svg.cx + DATA.orbitRadius * Math.cos(rad);
                    cy = DATA.svg.cy + DATA.orbitRadius * Math.sin(rad);
                }

                const opacity = Math.max(0, 0.9 - p.progress * 0.7);

                const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                circle.setAttribute('cx', cx);
                circle.setAttribute('cy', cy);
                circle.setAttribute('r', 2.5);
                circle.setAttribute('fill', startNode.color);
                circle.setAttribute('opacity', opacity);
                g.appendChild(circle);
            });
        },

        // ─── Center Pulse ─────────────────────────────────────────────────
        _updateCenterPulse: function (dt) {
            this.pulseTimer = (this.pulseTimer || 0) + dt;
            const period = 3000;
            const progress = (this.pulseTimer % period) / period;

            const pulse = this.svg ? this.svg.getElementById('em-center-pulse') : null;
            if (!pulse) return;

            const r = 38 + progress * 32;
            const opacity = (1 - progress) * 0.35;
            pulse.setAttribute('r', r);
            pulse.setAttribute('opacity', opacity);
        }
    };
})();
