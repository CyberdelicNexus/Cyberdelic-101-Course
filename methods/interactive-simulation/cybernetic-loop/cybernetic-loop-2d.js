/**
 * Cybernetic Loop - Simulation Engine (previous 2D canvas version, kept for reference;
 * not loaded anywhere. It registers the same engine id as cybernetic-loop.js)
 * Registers itself to window.SimulationEngines
 */
(function () {
    'use strict';

    // Ensure registry
    window.SimulationEngines = window.SimulationEngines || {};

    const DATA = window.CyberneticLoopData;
    // We will dynamically point this to DATA.eeg, DATA.hrv, etc.
    let ACTIVE_DATA = DATA.eeg;

    window.SimulationEngines['CyberneticLoop'] = {
        name: 'Cybernetic Loop',
        showPlaybackControls: false,

        defaults: {
            intensity: 5
        },

        config: [
            { id: 'intensity', label: 'INTENSITY', min: 1, max: 10, step: 1 }
        ],

        // Instance State
        elements: {},
        ctx: null,
        simConfig: {
            nodeRadius: 54
        },
        state: {
            activeSignalType: 'eeg',
            activeNode: null,
            loopTime: 0,
            paused: false,
            speedMult: 4,
            lastTS: null,
            lastCenterIdx: 0,
            centerFade: 1.0,
            particles: []
        },

        init: function (container, params, host) {
            if (!DATA || !DATA.eeg) {
                console.error('[CyberneticLoop] CyberneticLoopData not found or malformed.');
                return;
            }

            // Sync active data reference
            ACTIVE_DATA = DATA[this.state.activeSignalType];

            this.params = params;
            this.host = host;

            // Generate Layout
            this._buildLayout(container);

            this.state.speedMult = 2 + ((params.intensity || 5) - 1) * 0.5;

            // Initialize Particles
            const PARTICLE_COUNT = 60;
            this.state.particles = Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
                t: i / PARTICLE_COUNT,
                speed: 0.04 + Math.random() * 0.03,
                size: 1.2 + Math.random() * 1.6,
                alpha: 0.4 + Math.random() * 0.5,
            }));

            // Setup Listeners
            this._bindEvents();

            this.resize(container.clientWidth, container.clientHeight);

            console.log('[CyberneticLoop] Initialized');
        },

        resize: function (width, height) {
            const wrap = this.elements.canvasWrap;
            if (!wrap) return;

            const canvas = this.elements.canvas;
            this.W = wrap.clientWidth;
            this.H = wrap.clientHeight;
            canvas.width = this.W;
            canvas.height = this.H;
            this.CX = this.W / 2;
            this.CY = this.H / 2;
            const minDim = Math.min(this.W, this.H);
            this.RADIUS = minDim * 0.34;
            this.ORBIT_R = minDim * 0.455;
            // Dynamically scale node radius based on window size (baseline ~54 at 800px)
            this.simConfig.nodeRadius = Math.max(20, minDim * 0.0675);
        },

        update: function (dt, params) {
            if (this.state.lastTS === null) this.state.lastTS = performance.now();

            this.state.speedMult = 2 + ((params.intensity || 5) - 1) * 0.5;

            if (!this.state.paused) {
                this.state.loopTime += dt * this.state.speedMult * 0.12;
            }

            // Update crossfade
            let centerNodeIdx = this.state.activeNode;
            if (centerNodeIdx === null) {
                // Auto-follow leading particle
                const leadParticle = this.state.particles.reduce((a, b) => a.t > b.t ? a : b);
                centerNodeIdx = this._arcPoint(leadParticle.t).segIdx;
            }

            if (centerNodeIdx !== this.state.lastCenterIdx) {
                this.state.lastCenterIdx = centerNodeIdx;
                this.state.centerFade = 0;
            }

            if (this.state.centerFade < 1) {
                this.state.centerFade = Math.min(1, this.state.centerFade + dt * 3.5);
            }

            // Move particles
            this.state.particles.forEach(p => {
                if (!this.state.paused) {
                    p.t = (p.t + p.speed * dt * this.state.speedMult * 0.04) % 1;
                }
            });
        },

        drawArc: function (nA, nB, alpha, strokeStyle) {
            const a1 = nA.angle;
            const a2 = nB.angle;
            this.ctx.beginPath();
            this.ctx.arc(this.CX, this.CY, this.ORBIT_R, a1, a2);
            this.ctx.strokeStyle = strokeStyle || `rgba(255,255,255,${alpha})`;
            this.ctx.lineWidth = 1.2;
            this.ctx.stroke();
        },

        drawArrowhead: function (nA, nB) {
            const a2 = nB.angle;
            const aBefore = a2 - 0.12;
            const ax = this.CX + Math.cos(aBefore) * this.ORBIT_R;
            const ay = this.CY + Math.sin(aBefore) * this.ORBIT_R;
            const angle = aBefore + Math.PI / 2;
            const size = 6;
            this.ctx.save();
            this.ctx.translate(ax, ay);
            this.ctx.rotate(angle);
            this.ctx.beginPath();
            this.ctx.moveTo(size, 0);
            this.ctx.lineTo(-size * 0.6, -size * 0.45);
            this.ctx.lineTo(-size * 0.6, size * 0.45);
            this.ctx.closePath();
            const [r, g, b] = this._hexToRgb(nB.color);
            this.ctx.fillStyle = `rgba(${r},${g},${b},0.6)`;
            this.ctx.fill();
            this.ctx.restore();
        },

        drawNode: function (node, isActive, pulsePhase) {
            const p = this._nodePos(node);
            const [r, g, b] = this._hexToRgb(node.color);

            const glowR = this.simConfig.nodeRadius * (isActive ? 2.8 : 1.8);
            const glow = this.ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, glowR);
            const glowAlpha = isActive ? 0.18 : 0.07 + Math.sin(pulsePhase) * 0.04;
            glow.addColorStop(0, `rgba(${r},${g},${b},${glowAlpha})`);
            glow.addColorStop(1, 'rgba(0,0,0,0)');
            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, glowR, 0, Math.PI * 2);
            this.ctx.fillStyle = glow;
            this.ctx.fill();

            if (isActive) {
                const pulseR = this.simConfig.nodeRadius + 8 + Math.sin(pulsePhase * 3) * 6;
                this.ctx.beginPath();
                this.ctx.arc(p.x, p.y, pulseR, 0, Math.PI * 2);
                this.ctx.strokeStyle = `rgba(${r},${g},${b},0.3)`;
                this.ctx.lineWidth = 1.5;
                this.ctx.stroke();
            }

            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, this.simConfig.nodeRadius, 0, Math.PI * 2);
            const bg = this.ctx.createRadialGradient(p.x, p.y - 8, 0, p.x, p.y, this.simConfig.nodeRadius);
            bg.addColorStop(0, `rgba(${r},${g},${b},${isActive ? 0.22 : 0.08})`);
            bg.addColorStop(1, `rgba(${r},${g},${b},${isActive ? 0.08 : 0.02})`);
            this.ctx.fillStyle = bg;
            this.ctx.fill();

            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, this.simConfig.nodeRadius, 0, Math.PI * 2);
            this.ctx.strokeStyle = `rgba(${r},${g},${b},${isActive ? 0.9 : 0.35})`;
            this.ctx.lineWidth = isActive ? 1.8 : 1.2;
            this.ctx.stroke();

            this.ctx.fillStyle = `rgba(${r},${g},${b},${isActive ? 0.7 : 0.35})`;
            this.ctx.font = '500 11px DM Mono, monospace';
            this.ctx.textAlign = 'center';
            this.ctx.fillText(`0${node.step}`, p.x, p.y - 12);

            const lines = node.label.split('\n');
            this.ctx.fillStyle = isActive ? `rgb(${r},${g},${b})` : `rgba(${r},${g},${b},0.65)`;
            this.ctx.font = `${isActive ? '600' : '400'} 12px Cinzel, serif`;
            this.ctx.textAlign = 'center';
            lines.forEach((ln, i) => {
                this.ctx.fillText(ln, p.x, p.y + 6 + i * 15);
            });
        },

        draw: function (dt, params) {
            if (!this.ctx) return;

            this.ctx.clearRect(0, 0, this.W, this.H);

            this.ctx.save();
            const centerR = this.simConfig.nodeRadius * 2.2;

            // Base node logic
            let centerNode = null;
            let cnR = 255, cnG = 255, cnB = 255;

            if (this.state.activeNode !== null) {
                centerNode = ACTIVE_DATA[this.state.activeNode];
                [cnR, cnG, cnB] = this._hexToRgb(centerNode.color);
            } else {
                const leadParticle = this.state.particles.reduce((a, b) => a.t > b.t ? a : b);
                const pos = this._arcPoint(leadParticle.t);
                centerNode = ACTIVE_DATA[pos.segIdx];
                [cnR, cnG, cnB] = this._hexToRgb(centerNode.color);
            }

            // Background ambient glow
            const bgGlow = this.ctx.createRadialGradient(this.CX, this.CY, 0, this.CX, this.CY, this.ORBIT_R * 1.5);
            bgGlow.addColorStop(0, `rgba(${cnR},${cnG},${cnB},${0.03 * this.state.centerFade})`);
            bgGlow.addColorStop(1, 'rgba(0,0,0,0)');
            this.ctx.fillStyle = bgGlow;
            this.ctx.fillRect(0, 0, this.W, this.H);

            // Center area clipping
            this.ctx.beginPath();
            this.ctx.arc(this.CX, this.CY, centerR, 0, Math.PI * 2);
            this.ctx.clip();
            this.ctx.globalAlpha = this.state.centerFade;

            const intensityRaw = params.intensity || 5;
            const intensityNorm = (intensityRaw - 1) / 9; // 0 (calm) to 1 (intense)

            // Center details based on node step
            switch (centerNode.step) {
                case 1: { // Body Signal
                    const globalPhase = this.state.loopTime;

                    if (this.state.activeSignalType === 'eeg') {
                        // ── EEG (Brainwaves) ──
                        // A chaotic multi-layered waveform that slowly synchronizes into neat Alpha waves
                        const calmness = 1 - intensityNorm; // 0=stressed/chaotic, 1=calm/alpha
                        const eegW = centerR * 1.6;
                        const eegX0 = this.CX - eegW / 2;

                        // Background glow shifting from tense orange/green to calm blue/purple
                        const bgA = 0.15 + calmness * 0.1;
                        const bR = 200 - calmness * 100, bG = 150 - calmness * 100, bB = 50 + calmness * 200;
                        const glow = this.ctx.createRadialGradient(this.CX, this.CY, 10, this.CX, this.CY, centerR);
                        glow.addColorStop(0, `rgba(${bR},${bG},${bB},${bgA})`);
                        glow.addColorStop(1, 'rgba(0,0,0,0)');
                        this.ctx.fillStyle = glow;
                        this.ctx.fillRect(this.CX - centerR, this.CY - centerR, centerR * 2, centerR * 2);

                        // Draw 3 layers of waves
                        for (let layer = 0; layer < 3; layer++) {
                            this.ctx.beginPath();
                            this.ctx.lineWidth = 1.2 + layer * 0.4;
                            this.ctx.strokeStyle = `rgba(${cnR},${cnG},${cnB},${0.3 + (2 - layer) * 0.25})`;

                            const samples = 100;
                            for (let i = 0; i < samples; i++) {
                                const t = i / samples;
                                const px = eegX0 + t * eegW;

                                // Chaotic high freq beta (fast, low amp) vs smooth alpha (slower, rhythmic)
                                const beta = Math.sin(t * 40 + globalPhase * 8 + layer) * 12 * (1 - calmness)
                                    + Math.sin(t * 85 + globalPhase * 15) * 6 * (1 - calmness);
                                const alphaWave = Math.sin(t * 15 + globalPhase * 4 + layer * 0.5) * 20 * calmness;

                                const baseOffset = layer === 0 ? -15 : layer === 1 ? 0 : 15;
                                const py = this.CY + baseOffset - (beta + alphaWave);

                                i === 0 ? this.ctx.moveTo(px, py) : this.ctx.lineTo(px, py);
                            }
                            this.ctx.stroke();
                        }

                        this.ctx.fillStyle = `rgba(${cnR},${cnG},${cnB},0.9)`;
                        this.ctx.font = '600 14px DM Mono, monospace';
                        this.ctx.textAlign = 'center';
                        this.ctx.fillText(calmness > 0.6 ? 'ALPHA DOMINANCE' : 'BETA DOMINANCE', this.CX, this.CY + centerR - 40);

                    } else if (this.state.activeSignalType === 'hrv') {
                        // ── HRV (Heart Rate Variability) ──
                        const hrvPhase = globalPhase * 1.5;
                        const coherence = 1 - Math.pow(intensityNorm, 1.2); // 0=jagged, 1=smooth sine
                        const sigW = centerR * 1.5;
                        const startX = this.CX - sigW / 2;

                        // Heart pulsing aura
                        const beatSize = 1 + Math.sin(globalPhase * 3) * 0.15;
                        const auraColor = coherence > 0.5 ? `100, 255, 150` : `255, 100, 100`; // Red to green
                        const hrvGlow = this.ctx.createRadialGradient(this.CX, this.CY, 0, this.CX, this.CY, centerR * beatSize);
                        hrvGlow.addColorStop(0, `rgba(${auraColor}, 0.2)`);
                        hrvGlow.addColorStop(1, 'rgba(0,0,0,0)');
                        this.ctx.fillStyle = hrvGlow;
                        this.ctx.beginPath(); this.ctx.arc(this.CX, this.CY, centerR, 0, Math.PI * 2); this.ctx.fill();

                        // Waveform drawing
                        this.ctx.beginPath();
                        this.ctx.lineWidth = 2;
                        this.ctx.strokeStyle = `rgb(${auraColor})`;

                        const points = 150;
                        for (let i = 0; i < points; i++) {
                            const t = i / points;
                            const px = startX + t * sigW;

                            // Perfect sine wave vs erratic jagged line
                            const smooth = Math.sin(t * 12 - hrvPhase * 2) * 35;
                            const jagged = Math.sin(t * 22 - hrvPhase * 3) * 20
                                + Math.sin(t * 7 + hrvPhase * 5) * 25
                                + (Math.random() - 0.5) * 10 * (1 - coherence);

                            const py = this.CY - (smooth * coherence + jagged * (1 - coherence));
                            i === 0 ? this.ctx.moveTo(px, py) : this.ctx.lineTo(px, py);
                        }
                        this.ctx.stroke();

                        this.ctx.fillStyle = `rgb(${auraColor})`;
                        this.ctx.font = '600 14px DM Mono, monospace';
                        this.ctx.textAlign = 'center';
                        this.ctx.fillText(coherence > 0.6 ? 'HIGH COHERENCE' : 'ERRATIC HRV', this.CX, this.CY + centerR - 40);

                    } else if (this.state.activeSignalType === 'gsr') {
                        // ── GSR (Galvanic Skin Response/EDA) ──
                        // A fluid fill/topological wave that rises high during stress (phasic spikes) and lowers during calm
                        const gsrPhase = globalPhase * 0.8;
                        const arousal = intensityNorm; // 0=relaxed/low conductance, 1=stressed/high conductance
                        const r = centerR * 0.85;

                        // Skin conductance raw 'sweat' particle background
                        for (let i = 0; i < 20; i++) {
                            const sr = (Math.sin(i * 11 + gsrPhase) * 0.5 + 0.5) * r;
                            const sa = i * 0.8 + gsrPhase * 0.5;
                            const sx = this.CX + Math.cos(sa) * sr;
                            const sy = this.CY + Math.sin(sa) * sr;
                            this.ctx.beginPath(); this.ctx.arc(sx, sy, 1 + arousal * 1.5, 0, Math.PI * 2);
                            this.ctx.fillStyle = `rgba(0, 200, 255, ${0.1 + arousal * 0.3})`;
                            this.ctx.fill();
                        }

                        // Drawing a fluid clipping path within a circle
                        this.ctx.save();
                        this.ctx.beginPath();
                        this.ctx.arc(this.CX, this.CY, r, 0, Math.PI * 2);
                        this.ctx.clip();
                        this.ctx.strokeStyle = `rgba(0, 217, 255, 0.5)`;
                        this.ctx.lineWidth = 2;
                        this.ctx.stroke();

                        // The rising/falling fluid level
                        const baseLevel = this.CY + r * 0.6 - arousal * r * 1.2;

                        for (let wave = 0; wave < 3; wave++) {
                            this.ctx.beginPath();
                            this.ctx.moveTo(this.CX - r, this.CY + r);
                            this.ctx.lineTo(this.CX - r, baseLevel);

                            for (let x = -r; x <= r; x += 5) {
                                // Add rippling that becomes rougher depending on arousal
                                const yOff = Math.sin((x + this.CX) * 0.05 + gsrPhase * (2 + wave) + wave) * 12 * (0.2 + arousal * 0.8)
                                    + Math.cos((x + this.CX) * 0.1 + gsrPhase * 4) * 5 * arousal;
                                this.ctx.lineTo(this.CX + x, baseLevel + yOff);
                            }

                            this.ctx.lineTo(this.CX + r, this.CY + r);
                            this.ctx.closePath();

                            const fillAlpha = 0.2 + (2 - wave) * 0.15;
                            const fillGrad = this.ctx.createLinearGradient(this.CX, baseLevel - 20, this.CX, this.CY + r);
                            fillGrad.addColorStop(0, `rgba(0, ${150 + arousal * 100}, 255, ${fillAlpha})`);
                            fillGrad.addColorStop(1, `rgba(0, 50, 150, ${fillAlpha * 0.2})`);

                            this.ctx.fillStyle = fillGrad;
                            this.ctx.fill();

                            if (wave === 0) {
                                this.ctx.strokeStyle = `rgba(0, 255, 255, ${0.4 + arousal * 0.5})`;
                                this.ctx.lineWidth = 1.5;
                                this.ctx.stroke();
                            }
                        }
                        this.ctx.restore();

                        this.ctx.fillStyle = `rgba(0, 217, 255, 0.9)`;
                        this.ctx.font = '600 14px DM Mono, monospace';
                        this.ctx.textAlign = 'center';
                        this.ctx.fillText(arousal > 0.6 ? 'HIGH AROUSAL' : 'LOW AROUSAL', this.CX, this.CY + centerR - 40);

                    } else if (this.state.activeSignalType === 'respiration') {
                        // ── Breathing (Respiration) ──
                        // A smooth, deeply expanding and contracting geometric sphere
                        // Speed up the breath rhythm as intensity increases
                        const breathSpeedMult = 0.95 + intensityNorm * 1.5;
                        const breathProgress = (Math.sin(globalPhase * breathSpeedMult) + 1) / 2; // 0=exhale empty, 1=inhale full
                        const maxR = centerR * 0.85;
                        const minR = centerR * 0.35;
                        const currentR = minR + breathProgress * (maxR - minR);

                        const isExhaling = Math.cos(globalPhase * breathSpeedMult) < 0; // True if decreasing
                        const colorCycle = breathProgress; // 0 (empty/rest) to 1 (full/active)
                        const cR = 50 + colorCycle * 100;
                        const cG = 200 + colorCycle * 55;
                        const cB = 255;

                        // Diaphragm lines radiating outward
                        const numLines = 16;
                        for (let i = 0; i < numLines; i++) {
                            const a = (i / numLines) * Math.PI * 2 + globalPhase * 0.1;
                            const lx1 = this.CX + Math.cos(a) * (currentR * 0.4);
                            const ly1 = this.CY + Math.sin(a) * (currentR * 0.4);
                            const lx2 = this.CX + Math.cos(a) * (currentR * 1.05);
                            const ly2 = this.CY + Math.sin(a) * (currentR * 1.05);

                            this.ctx.beginPath();
                            this.ctx.moveTo(lx1, ly1);
                            this.ctx.lineTo(lx2, ly2);
                            this.ctx.strokeStyle = `rgba(${cR},${cG},${cB},${0.1 + breathProgress * 0.3})`;
                            this.ctx.lineWidth = 1 + breathProgress * 2;
                            this.ctx.stroke();
                        }

                        // Expanding lung/sphere rings
                        for (let ring = 0; ring < 4; ring++) {
                            const rOff = ring * 0.2;
                            const rRing = currentR * Math.max(0.1, (1 - rOff));

                            this.ctx.beginPath();
                            this.ctx.arc(this.CX, this.CY, rRing, 0, Math.PI * 2);
                            this.ctx.fillStyle = `rgba(${cR},${cG},${cB},${0.05 + (3 - ring) * 0.05})`;
                            this.ctx.fill();
                            this.ctx.strokeStyle = `rgba(${cR},${cG},${cB},${0.3 + breathProgress * 0.4})`;
                            this.ctx.lineWidth = 1 + breathProgress;
                            this.ctx.stroke();
                        }

                        // Central core
                        const coreGlow = this.ctx.createRadialGradient(this.CX, this.CY, 0, this.CX, this.CY, currentR * 0.5);
                        coreGlow.addColorStop(0, `rgba(${cR},${cG},${cB},0.8)`);
                        coreGlow.addColorStop(1, 'rgba(0,0,0,0)');
                        this.ctx.fillStyle = coreGlow;
                        this.ctx.beginPath(); this.ctx.arc(this.CX, this.CY, currentR * 0.5, 0, Math.PI * 2); this.ctx.fill();

                        this.ctx.fillStyle = `rgba(${cR},${cG},${cB},0.9)`;
                        this.ctx.font = '600 14px DM Mono, monospace';
                        this.ctx.textAlign = 'center';

                        let breathStateText = "HOLD";
                        if (isExhaling && breathProgress > 0.05) breathStateText = "EXHALE";
                        else if (!isExhaling && breathProgress < 0.95) breathStateText = "INHALE";
                        this.ctx.fillText(breathStateText, this.CX, this.CY + centerR - 40);

                    } else {
                        // ── Default / Fallback Generic Body Signal (if anything else is selected) ──
                        const breathCycle = (Math.sin(this.state.loopTime * 0.9) + 1) / 2; // 0-1 breath in/out
                        const heartPhase = (this.state.loopTime * 1.1) % 1;

                        // Outer aura pulsing with breath
                        const auraR = centerR * (0.55 + breathCycle * 0.1);
                        const auraGrad = this.ctx.createRadialGradient(this.CX, this.CY, auraR * 0.5, this.CX, this.CY, auraR);
                        auraGrad.addColorStop(0, `rgba(${cnR},${cnG},${cnB},0)`);
                        auraGrad.addColorStop(0.7, `rgba(${cnR},${cnG},${cnB},0.04)`);
                        auraGrad.addColorStop(1, `rgba(${cnR},${cnG},${cnB},${0.06 + breathCycle * 0.06})`);
                        this.ctx.fillStyle = auraGrad;
                        this.ctx.beginPath(); this.ctx.arc(this.CX, this.CY, auraR, 0, Math.PI * 2); this.ctx.fill();

                        // Heartbeat ring emanating from chest
                        for (let r = 0; r < 3; r++) {
                            const phase = (heartPhase + r * 0.33) % 1;
                            const rr = 10 + phase * centerR * 0.5;
                            const a = (1 - phase) * (phase < 0.15 ? phase / 0.15 : 1) * 0.4;
                            this.ctx.beginPath();
                            this.ctx.arc(this.CX, this.CY + 4, rr, 0, Math.PI * 2);
                            this.ctx.strokeStyle = `rgba(${cnR},${cnG},${cnB},${a})`;
                            this.ctx.lineWidth = 1.5 * (1 - phase);
                            this.ctx.stroke();
                        }

                        // Body silhouette — glowing proportional to breath
                        const bodyAlpha = 0.25 + breathCycle * 0.2;
                        // Head
                        this.ctx.beginPath();
                        this.ctx.arc(this.CX, this.CY - 26, 9, 0, Math.PI * 2);
                        this.ctx.strokeStyle = `rgba(${cnR},${cnG},${cnB},${bodyAlpha})`;
                        this.ctx.lineWidth = 1.2;
                        this.ctx.stroke();
                        // Brainwave shimmer on head
                        for (let i = 0; i < 5; i++) {
                            const a = (-Math.PI * 0.7) + (i / 4) * Math.PI * 1.4;
                            const bx = this.CX + Math.cos(a) * 9;
                            const by = (this.CY - 26) + Math.sin(a) * 9;
                            const glowR = 1.5 + Math.sin(this.state.loopTime * 3 + i * 1.2) * 0.8;
                            this.ctx.beginPath();
                            this.ctx.arc(bx, by, glowR, 0, Math.PI * 2);
                            this.ctx.fillStyle = `rgba(${cnR},${cnG},${cnB},${0.3 + Math.sin(this.state.loopTime * 3 + i) * 0.15})`;
                            this.ctx.fill();
                        }
                        // Shoulders / torso
                        this.ctx.beginPath();
                        this.ctx.moveTo(this.CX - 12, this.CY - 17);
                        this.ctx.bezierCurveTo(this.CX - 14, this.CY - 10, this.CX - 10, this.CY + 2, this.CX - 9, this.CY + 14);
                        this.ctx.moveTo(this.CX + 12, this.CY - 17);
                        this.ctx.bezierCurveTo(this.CX + 14, this.CY - 10, this.CX + 10, this.CY + 2, this.CX + 9, this.CY + 14);
                        this.ctx.moveTo(this.CX - 9, this.CY + 14); this.ctx.lineTo(this.CX + 9, this.CY + 14);
                        this.ctx.strokeStyle = `rgba(${cnR},${cnG},${cnB},${bodyAlpha})`;
                        this.ctx.lineWidth = 1.1;
                        this.ctx.stroke();

                        // Chest heart glyph
                        const hx = this.CX, hy = this.CY + 1;
                        const hs = 4 + breathCycle * 1.5;
                        const heartBeat = heartPhase < 0.12 ? 1 + (1 - heartPhase / 0.12) * 0.5 : 1;
                        this.ctx.save();
                        this.ctx.translate(hx, hy);
                        this.ctx.scale(heartBeat, heartBeat);
                        this.ctx.beginPath();
                        this.ctx.moveTo(0, hs * 0.4);
                        this.ctx.bezierCurveTo(-hs * 0.1, -hs * 0.3, -hs, -hs * 0.3, -hs * 0.5, hs * 0.1);
                        this.ctx.bezierCurveTo(-hs * 0.25, hs * 0.5, 0, hs * 0.7, 0, hs * 0.4);
                        this.ctx.bezierCurveTo(0, hs * 0.7, hs * 0.25, hs * 0.5, hs * 0.5, hs * 0.1);
                        this.ctx.bezierCurveTo(hs, -hs * 0.3, hs * 0.1, -hs * 0.3, 0, hs * 0.4);
                        this.ctx.fillStyle = `rgba(${cnR},${cnG},${cnB},${0.6 + breathCycle * 0.3})`;
                        this.ctx.fill();
                        this.ctx.restore();

                        // ECG trace along the bottom half
                        const ecgW = centerR * 1.4;
                        const ecgX0 = this.CX - ecgW / 2;
                        const ecgY = this.CY + 26;
                        this.ctx.beginPath();
                        this.ctx.lineWidth = 1.4;
                        this.ctx.strokeStyle = `rgba(${cnR},${cnG},${cnB},0.7)`;
                        const ecgSamples = 90;
                        for (let i = 0; i < ecgSamples; i++) {
                            const t = i / ecgSamples;
                            const tOff = (t + this.state.loopTime * 0.45) % 1;
                            const ph = (tOff % 0.5) / 0.5;
                            let y = 0;
                            if (ph < 0.08) y = Math.sin(ph / 0.08 * Math.PI) * 0.15;
                            else if (ph < 0.18) y = 0;
                            else if (ph < 0.205) y = -(ph - 0.18) / 0.025 * 0.1;
                            else if (ph < 0.23) y = -0.1 + (ph - 0.205) / 0.025 * 1.1;
                            else if (ph < 0.26) y = 1 - (ph - 0.23) / 0.03 * 1.15;
                            else if (ph < 0.285) y = -0.15 + (ph - 0.26) / 0.025 * 0.15;
                            else if (ph < 0.45) y = Math.sin((ph - 0.285) / 0.165 * Math.PI) * 0.25;
                            const px = ecgX0 + t * ecgW;
                            const py = ecgY - y * 16;
                            i === 0 ? this.ctx.moveTo(px, py) : this.ctx.lineTo(px, py);
                        }
                        this.ctx.stroke();

                        // Label
                        this.ctx.fillStyle = `rgba(${cnR},${cnG},${cnB},0.9)`;
                        this.ctx.font = '600 14px DM Mono, monospace';
                        this.ctx.textAlign = 'center';
                        this.ctx.fillText('BODY BROADCASTS', this.CX, this.CY + centerR - 40);
                    }
                    break;
                }
                case 2: { // Sensor
                    const scanProgress = (this.state.loopTime * 0.55) % 1;
                    const scanX = this.CX - centerR * 0.85 + scanProgress * centerR * 1.7;
                    const sigW = centerR * 0.82;

                    // ── Analog bio-signal (left half, fading as scan passes) ──
                    this.ctx.beginPath();
                    this.ctx.lineWidth = 1.6;
                    const analogSamples = 80;
                    for (let i = 0; i < analogSamples; i++) {
                        const t = i / analogSamples;
                        const px = this.CX - sigW + t * sigW * 2;
                        const py = this.CY - (Math.sin((t * 5 + this.state.loopTime * 0.8) * Math.PI * 2) * 14 +
                            Math.sin((t * 2.3 + this.state.loopTime * 0.3) * Math.PI * 2) * 5);
                        // Fade out as scan passes over this point
                        const fadeAlpha = px < scanX ? 0.15 : 0.75;
                        if (i === 0) { this.ctx.strokeStyle = `rgba(${cnR},${cnG},${cnB},${fadeAlpha})`; this.ctx.moveTo(px, py); }
                        else {
                            this.ctx.stroke(); this.ctx.beginPath();
                            this.ctx.strokeStyle = `rgba(${cnR},${cnG},${cnB},${fadeAlpha})`;
                            this.ctx.moveTo(px, py);
                        }
                    }
                    this.ctx.stroke();

                    // ── Scanning line ──
                    this.ctx.beginPath();
                    this.ctx.moveTo(scanX, this.CY - centerR * 0.7);
                    this.ctx.lineTo(scanX, this.CY + centerR * 0.55);
                    const scanGrad = this.ctx.createLinearGradient(0, this.CY - centerR * 0.7, 0, this.CY + centerR * 0.55);
                    scanGrad.addColorStop(0, `rgba(${cnR},${cnG},${cnB},0)`);
                    scanGrad.addColorStop(0.3, `rgba(${cnR},${cnG},${cnB},0.9)`);
                    scanGrad.addColorStop(0.7, `rgba(${cnR},${cnG},${cnB},0.9)`);
                    scanGrad.addColorStop(1, `rgba(${cnR},${cnG},${cnB},0)`);
                    this.ctx.strokeStyle = scanGrad;
                    this.ctx.lineWidth = 1.5;
                    this.ctx.stroke();
                    // Scan glow
                    this.ctx.beginPath();
                    this.ctx.moveTo(scanX, this.CY - centerR * 0.7);
                    this.ctx.lineTo(scanX, this.CY + centerR * 0.55);
                    this.ctx.strokeStyle = `rgba(${cnR},${cnG},${cnB},0.12)`;
                    this.ctx.lineWidth = 8;
                    this.ctx.stroke();

                    // ── Sensor / electrode band across the center ──
                    this.ctx.beginPath();
                    this.ctx.moveTo(this.CX - sigW - 2, this.CY);
                    this.ctx.lineTo(this.CX + sigW + 2, this.CY);
                    this.ctx.strokeStyle = `rgba(${cnR},${cnG},${cnB},0.12)`;
                    this.ctx.lineWidth = 12;
                    this.ctx.stroke();
                    this.ctx.beginPath();
                    this.ctx.moveTo(this.CX - sigW - 2, this.CY);
                    this.ctx.lineTo(this.CX + sigW + 2, this.CY);
                    this.ctx.strokeStyle = `rgba(${cnR},${cnG},${cnB},0.35)`;
                    this.ctx.lineWidth = 1.5;
                    this.ctx.stroke();
                    // Electrode dots on band
                    for (let e = 0; e < 5; e++) {
                        const ex = this.CX - sigW * 0.8 + e * (sigW * 1.6 / 4);
                        this.ctx.beginPath();
                        this.ctx.arc(ex, this.CY, 3, 0, Math.PI * 2);
                        this.ctx.fillStyle = `rgba(${cnR},${cnG},${cnB},0.55)`;
                        this.ctx.fill();
                        this.ctx.beginPath();
                        this.ctx.arc(ex, this.CY, 5.5, 0, Math.PI * 2);
                        this.ctx.strokeStyle = `rgba(${cnR},${cnG},${cnB},0.25)`;
                        this.ctx.lineWidth = 1;
                        this.ctx.stroke();
                    }

                    // ── Digital sample dots (right of scan line) ──
                    const numSamples = 16;
                    for (let i = 0; i < numSamples; i++) {
                        const t = i / numSamples;
                        const px = this.CX - sigW + t * sigW * 2;
                        if (px > scanX) continue;
                        const val = Math.sin((t * 5 + this.state.loopTime * 0.8) * Math.PI * 2) * 14 +
                            Math.sin((t * 2.3 + this.state.loopTime * 0.3) * Math.PI * 2) * 5;
                        const py = this.CY - val;
                        // Vertical stem from band
                        this.ctx.beginPath();
                        this.ctx.moveTo(px, this.CY);
                        this.ctx.lineTo(px, py);
                        this.ctx.strokeStyle = `rgba(${cnR},${cnG},${cnB},0.22)`;
                        this.ctx.lineWidth = 0.8;
                        this.ctx.stroke();
                        // Sample dot
                        this.ctx.beginPath();
                        this.ctx.arc(px, py, 3, 0, Math.PI * 2);
                        this.ctx.fillStyle = `rgba(${cnR},${cnG},${cnB},0.85)`;
                        this.ctx.fill();
                        // Bit label
                        this.ctx.fillStyle = `rgba(${cnR},${cnG},${cnB},0.4)`;
                        this.ctx.font = '5px DM Mono, monospace';
                        this.ctx.textAlign = 'center';
                        this.ctx.fillText(Math.round(50 + val * 2), px, py - 6);
                    }

                    // Hz readout
                    this.ctx.fillStyle = `rgba(${cnR},${cnG},${cnB},0.5)`;
                    this.ctx.font = '600 8px DM Mono, monospace';
                    this.ctx.textAlign = 'right';
                    this.ctx.fillText('256 Hz', this.CX + sigW, this.CY - centerR * 0.55);

                    this.ctx.fillStyle = `rgba(${cnR},${cnG},${cnB},0.9)`;
                    this.ctx.font = '600 14px DM Mono, monospace';
                    this.ctx.textAlign = 'center';
                    this.ctx.fillText('INVISIBLE → MEASURABLE', this.CX, this.CY + centerR - 40);
                    break;
                }
                case 3: { // Algorithm
                    const procSpeed = this.state.loopTime * 1.0;

                    // ── Incoming raw data stream (left) ──
                    const streamX = this.CX - centerR * 0.85;
                    for (let i = 0; i < 12; i++) {
                        const dy = -centerR * 0.55 + (i / 11) * centerR * 1.1;
                        const len = 6 + Math.sin(procSpeed * 2.3 + i * 1.7) * 5;
                        const a = 0.2 + Math.sin(procSpeed * 1.8 + i * 0.9) * 0.15;
                        this.ctx.beginPath();
                        this.ctx.rect(streamX - 3, this.CY + dy - 1.5, len, 3);
                        this.ctx.fillStyle = `rgba(${cnR},${cnG},${cnB},${a})`;
                        this.ctx.fill();
                    }
                    // Stream arrow →
                    this.ctx.beginPath();
                    this.ctx.moveTo(streamX + 14, this.CY);
                    this.ctx.lineTo(streamX + 24, this.CY);
                    this.ctx.strokeStyle = `rgba(${cnR},${cnG},${cnB},0.3)`;
                    this.ctx.lineWidth = 1;
                    this.ctx.stroke();
                    this.ctx.beginPath();
                    this.ctx.moveTo(streamX + 22, this.CY - 3);
                    this.ctx.lineTo(streamX + 26, this.CY);
                    this.ctx.lineTo(streamX + 22, this.CY + 3);
                    this.ctx.strokeStyle = `rgba(${cnR},${cnG},${cnB},0.3)`;
                    this.ctx.lineWidth = 1;
                    this.ctx.stroke();

                    // ── Processing rings (center nucleus) ──
                    for (let ring = 3; ring >= 1; ring--) {
                        const rr = ring * 12;
                        const spin = this.state.loopTime * (0.4 + ring * 0.15) * (ring % 2 === 0 ? -1 : 1);
                        const dashes = ring * 3;
                        this.ctx.beginPath();
                        for (let d = 0; d < dashes; d++) {
                            const a1 = spin + (d / dashes) * Math.PI * 2;
                            const a2 = a1 + (Math.PI / dashes) * 0.7;
                            this.ctx.arc(this.CX, this.CY, rr, a1, a2);
                        }
                        this.ctx.strokeStyle = `rgba(${cnR},${cnG},${cnB},${0.2 + ring * 0.1})`;
                        this.ctx.lineWidth = 1.2;
                        this.ctx.stroke();
                    }
                    // Nucleus dot
                    const nucPulse = 0.5 + Math.sin(procSpeed * 3) * 0.25;
                    this.ctx.beginPath();
                    this.ctx.arc(this.CX, this.CY, 5, 0, Math.PI * 2);
                    this.ctx.fillStyle = `rgba(${cnR},${cnG},${cnB},${nucPulse})`;
                    this.ctx.fill();
                    const nucGlow = this.ctx.createRadialGradient(this.CX, this.CY, 0, this.CX, this.CY, 18);
                    nucGlow.addColorStop(0, `rgba(${cnR},${cnG},${cnB},0.12)`);
                    nucGlow.addColorStop(1, 'rgba(0,0,0,0)');
                    this.ctx.fillStyle = nucGlow;
                    this.ctx.beginPath(); this.ctx.arc(this.CX, this.CY, 18, 0, Math.PI * 2); this.ctx.fill();

                    // Converging data specks → nucleus
                    for (let i = 0; i < 6; i++) {
                        const baseAngle = (i / 6) * Math.PI * 2;
                        const prog = (procSpeed * 0.7 + i * 0.16) % 1;
                        const r0 = centerR * 0.55;
                        const px = this.CX + Math.cos(baseAngle) * r0 * (1 - prog);
                        const py = this.CY + Math.sin(baseAngle) * r0 * (1 - prog);
                        this.ctx.beginPath();
                        this.ctx.arc(px, py, 2, 0, Math.PI * 2);
                        this.ctx.fillStyle = `rgba(${cnR},${cnG},${cnB},${prog * 0.7})`;
                        this.ctx.fill();
                    }

                    // ── Output: state classification (right) ──
                    const states = [['CALM', 0.87], ['FOCUSED', 0.72], ['STRESSED', 0.45], ['RELAXED', 0.91], ['ALERT', 0.63]];
                    const cycleLen = 2.2;
                    const stateIdx = Math.floor(this.state.loopTime / cycleLen) % states.length;
                    const cycleFrac = (this.state.loopTime % cycleLen) / cycleLen;
                    const fadeA = cycleFrac < 0.12 ? cycleFrac / 0.12 : cycleFrac > 0.85 ? (1 - cycleFrac) / 0.15 : 1;
                    const [label, conf] = states[stateIdx];
                    const outX = this.CX;
                    const outY = this.CY - centerR * 0.55; // Placed at top center
                    const outW = centerR * 0.75;

                    // Arrow from nucleus to output (going UP)
                    this.ctx.beginPath();
                    this.ctx.moveTo(this.CX, this.CY - 20);
                    this.ctx.lineTo(this.CX, outY + 24);
                    this.ctx.strokeStyle = `rgba(${cnR},${cnG},${cnB},${fadeA * 0.35})`;
                    this.ctx.lineWidth = 1;
                    this.ctx.stroke();

                    // Arrowhead
                    this.ctx.beginPath();
                    this.ctx.moveTo(this.CX - 4, outY + 28);
                    this.ctx.lineTo(this.CX, outY + 23);
                    this.ctx.lineTo(this.CX + 4, outY + 28);
                    this.ctx.strokeStyle = `rgba(${cnR},${cnG},${cnB},${fadeA * 0.35})`;
                    this.ctx.lineWidth = 1;
                    this.ctx.stroke();

                    // Classification box
                    this.ctx.strokeStyle = `rgba(${cnR},${cnG},${cnB},${fadeA * 0.55})`;
                    this.ctx.lineWidth = 1;
                    this.ctx.strokeRect(outX - outW * 0.5, outY - 20, outW, 40);

                    // State label
                    this.ctx.fillStyle = `rgba(${cnR},${cnG},${cnB},${fadeA * 0.95})`;
                    this.ctx.font = `700 9px DM Mono, monospace`;
                    this.ctx.textAlign = 'center';
                    this.ctx.fillText(label, outX, outY - 5);

                    // Confidence bar
                    this.ctx.fillStyle = `rgba(${cnR},${cnG},${cnB},0.15)`;
                    this.ctx.fillRect(outX - outW * 0.4, outY + 5, outW * 0.8, 6);
                    this.ctx.fillStyle = `rgba(${cnR},${cnG},${cnB},${fadeA * 0.7})`;
                    this.ctx.fillRect(outX - outW * 0.4, outY + 5, outW * 0.8 * conf * fadeA, 6);
                    this.ctx.fillStyle = `rgba(${cnR},${cnG},${cnB},${fadeA * 0.5})`;
                    this.ctx.font = '500 6px DM Mono, monospace';
                    this.ctx.textAlign = 'center';
                    this.ctx.fillText(`${Math.round(conf * 100)}%`, outX, outY + 18);

                    this.ctx.fillStyle = `rgba(${cnR},${cnG},${cnB},0.9)`;
                    this.ctx.font = '600 14px DM Mono, monospace';
                    this.ctx.textAlign = 'center';
                    this.ctx.fillText('NOISE → MEANING', this.CX, this.CY + centerR - 40);
                    break;
                }
                case 4: { // VR Response
                    const envState = 1 - intensityNorm; // 0=stressed→1=calm
                    const envColors = [
                        [220, 60, 80],    // stressed : warm red
                        [255, 136, 204],  // mid
                        [100, 180, 255],  // calm : cool blue
                    ];
                    const ci = envState < 0.5 ? 0 : 1;
                    const ct = envState < 0.5 ? envState * 2 : (envState - 0.5) * 2;
                    const [er, eg, eb] = [
                        Math.round(envColors[ci][0] + (envColors[ci + 1][0] - envColors[ci][0]) * ct),
                        Math.round(envColors[ci][1] + (envColors[ci + 1][1] - envColors[ci][1]) * ct),
                        Math.round(envColors[ci][2] + (envColors[ci + 1][2] - envColors[ci][2]) * ct),
                    ];

                    // Sky gradient
                    const skyH = centerR * 0.85;
                    const skyGr = this.ctx.createLinearGradient(this.CX, this.CY - skyH, this.CX, this.CY + 6);
                    skyGr.addColorStop(0, `rgba(${er},${eg},${eb},0.22)`);
                    skyGr.addColorStop(1, `rgba(${er},${eg},${eb},0.03)`);
                    this.ctx.fillStyle = skyGr;
                    this.ctx.fillRect(this.CX - centerR, this.CY - skyH, centerR * 2, skyH + 6);

                    // Floating orbs / snowglobe particles
                    for (let i = 0; i < 14; i++) {
                        const seed = i * 137.5;
                        const ox = this.CX + Math.sin(seed + this.state.loopTime * (0.15 + (i % 3) * 0.08)) * centerR * 0.65;
                        const oy = this.CY - skyH * 0.2 - Math.abs(Math.sin(seed * 0.7 + this.state.loopTime * (0.2 + (i % 5) * 0.04))) * skyH * 0.7;
                        const or = 1.2 + Math.sin(seed + this.state.loopTime * 0.5) * 0.8;
                        const oa = 0.15 + envState * 0.35;
                        this.ctx.beginPath();
                        this.ctx.arc(ox, oy, or, 0, Math.PI * 2);
                        this.ctx.fillStyle = `rgba(${er},${eg},${eb},${oa})`;
                        this.ctx.fill();
                    }

                    // Horizon line
                    this.ctx.beginPath();
                    this.ctx.moveTo(this.CX - centerR, this.CY + 6);
                    this.ctx.lineTo(this.CX + centerR, this.CY + 6);
                    const hLine = this.ctx.createLinearGradient(this.CX - centerR, 0, this.CX + centerR, 0);
                    hLine.addColorStop(0, 'rgba(0,0,0,0)');
                    hLine.addColorStop(0.5, `rgba(${er},${eg},${eb},0.5)`);
                    hLine.addColorStop(1, 'rgba(0,0,0,0)');
                    this.ctx.strokeStyle = hLine;
                    this.ctx.lineWidth = 1;
                    this.ctx.stroke();

                    // Terrain wireframe (responding to state — calmer = smoother/higher terrain)
                    const terrW = centerR * 1.72;
                    const terrX0 = this.CX - terrW / 2;
                    const terrYBase = this.CY + 10;
                    const terrRows = 5, terrCols = 14;
                    for (let row = 0; row < terrRows; row++) {
                        this.ctx.beginPath();
                        for (let col = 0; col < terrCols; col++) {
                            const tx = terrX0 + (col / (terrCols - 1)) * terrW;
                            const dep = row / terrRows;
                            // Calm state: gentle rolling hills. Stressed: jagged sharp peaks.
                            const jagged = 1 - envState;
                            const smooth = envState;
                            const h = (Math.sin(col * 0.5 + this.state.loopTime * (0.6 - smooth * 0.4) + row * 0.8) * 12 * smooth
                                + Math.sin(col * 2.1 + this.state.loopTime * 1.2 + row) * 8 * jagged)
                                * (1 - dep * 0.5) * (0.5 + envState * 0.7);
                            const ty = terrYBase - dep * 30 - h;
                            col === 0 ? this.ctx.moveTo(tx, ty) : this.ctx.lineTo(tx, ty);
                        }
                        const rowAlpha = (0.08 + (1 - row / terrRows) * 0.35) * (0.5 + envState * 0.5);
                        this.ctx.strokeStyle = `rgba(${er},${eg},${eb},${rowAlpha})`;
                        this.ctx.lineWidth = row === 0 ? 1.2 : 0.7;
                        this.ctx.stroke();
                    }

                    // State label (top-right)
                    const vrStates = ['STRESSED', 'ACTIVATING', 'CALM'];
                    const vrStateIdx = envState < 0.33 ? 0 : envState < 0.66 ? 1 : 2;
                    this.ctx.fillStyle = `rgba(${er},${eg},${eb},0.7)`;
                    this.ctx.font = '600 8px DM Mono, monospace';
                    this.ctx.textAlign = 'right';
                    this.ctx.fillText(vrStates[vrStateIdx], this.CX + centerR - 6, this.CY - skyH + 14);

                    this.ctx.fillStyle = `rgba(${cnR},${cnG},${cnB},0.9)`;
                    this.ctx.font = '600 14px DM Mono, monospace';
                    this.ctx.textAlign = 'center';
                    this.ctx.fillText('STATE → WORLD', this.CX, this.CY + centerR - 40);
                    break;
                }
                case 5: { // Learner Adjustment
                    const loopProg = (this.state.loopTime * 0.35) % 1; // loop completion progress
                    const calmLevel = 1 - intensityNorm;

                    // Inward ripples converging on the body
                    for (let r = 0; r < 4; r++) {
                        const phase = (1 - ((this.state.loopTime * 0.5 + r * 0.25) % 1));
                        const rr = 8 + phase * centerR * 0.62;
                        const thick = 1 + (1 - phase) * 1.5;
                        const alpha = (1 - phase) * 0.3 * (0.5 + calmLevel * 0.5);
                        this.ctx.beginPath();
                        this.ctx.arc(this.CX, this.CY - 5, rr, 0, Math.PI * 2);
                        this.ctx.strokeStyle = `rgba(${cnR},${cnG},${cnB},${alpha})`;
                        this.ctx.lineWidth = thick;
                        this.ctx.stroke();
                    }

                    // Body glow — brightest at loop completion
                    const glowIntensity = 0.06 + calmLevel * 0.12 + Math.sin(this.state.loopTime * 2.5) * 0.04;
                    const bodyGlow = this.ctx.createRadialGradient(this.CX, this.CY - 8, 0, this.CX, this.CY - 8, 30);
                    bodyGlow.addColorStop(0, `rgba(${cnR},${cnG},${cnB},${glowIntensity * 3})`);
                    bodyGlow.addColorStop(0.5, `rgba(${cnR},${cnG},${cnB},${glowIntensity})`);
                    bodyGlow.addColorStop(1, 'rgba(0,0,0,0)');
                    this.ctx.fillStyle = bodyGlow;
                    this.ctx.beginPath(); this.ctx.arc(this.CX, this.CY - 8, 30, 0, Math.PI * 2); this.ctx.fill();

                    // Body silhouette — more luminous than node 1 (it's receiving, awakening)
                    const lumAlpha = 0.4 + calmLevel * 0.35;
                    this.ctx.lineWidth = 1.3;
                    // Head
                    this.ctx.beginPath();
                    this.ctx.arc(this.CX, this.CY - 25, 9, 0, Math.PI * 2);
                    this.ctx.strokeStyle = `rgba(${cnR},${cnG},${cnB},${lumAlpha})`;
                    this.ctx.stroke();
                    // Inner fill on head (awareness)
                    const headFill = this.ctx.createRadialGradient(this.CX, this.CY - 25, 0, this.CX, this.CY - 25, 9);
                    headFill.addColorStop(0, `rgba(${cnR},${cnG},${cnB},${calmLevel * 0.18})`);
                    headFill.addColorStop(1, 'rgba(0,0,0,0)');
                    this.ctx.fillStyle = headFill;
                    this.ctx.beginPath(); this.ctx.arc(this.CX, this.CY - 25, 9, 0, Math.PI * 2); this.ctx.fill();
                    // Torso
                    this.ctx.beginPath();
                    this.ctx.moveTo(this.CX - 11, this.CY - 16);
                    this.ctx.bezierCurveTo(this.CX - 13, this.CY - 8, this.CX - 9, this.CY + 4, this.CX - 8, this.CY + 14);
                    this.ctx.moveTo(this.CX + 11, this.CY - 16);
                    this.ctx.bezierCurveTo(this.CX + 13, this.CY - 8, this.CX + 9, this.CY + 4, this.CX + 8, this.CY + 14);
                    this.ctx.moveTo(this.CX - 8, this.CY + 14); this.ctx.lineTo(this.CX + 8, this.CY + 14);
                    this.ctx.strokeStyle = `rgba(${cnR},${cnG},${cnB},${lumAlpha})`;
                    this.ctx.stroke();

                    // Inward arrows from 4 directions converging on body
                    const arrowDirs = [
                        [0, -1, 'TOP'],
                        [1, 0, 'RIGHT'],
                        [0, 1, 'BOTTOM'],
                        [-1, 0, 'LEFT'],
                    ];
                    arrowDirs.forEach(([dx, dy], idx) => {
                        const t = (this.state.loopTime * 0.6 + idx * 0.25) % 1;
                        const startR = centerR * 0.7;
                        const endR = 18;
                        const dist = startR - (startR - endR) * t;
                        const ax = this.CX + dx * dist;
                        const ay = (this.CY - 5) + dy * dist;
                        this.ctx.beginPath();
                        this.ctx.arc(ax, ay, 2.5, 0, Math.PI * 2);
                        this.ctx.fillStyle = `rgba(${cnR},${cnG},${cnB},${t * 0.7})`;
                        this.ctx.fill();
                    });

                    // Breath ripple (conscious breath taken)
                    const breathPulse = (Math.sin(this.state.loopTime * 0.8) + 1) / 2;
                    this.ctx.beginPath();
                    this.ctx.arc(this.CX, this.CY + 2, 5 + breathPulse * 6, 0, Math.PI * 2);
                    this.ctx.strokeStyle = `rgba(${cnR},${cnG},${cnB},${breathPulse * 0.4})`;
                    this.ctx.lineWidth = 1;
                    this.ctx.stroke();

                    // "Loop count"
                    const loopCount = Math.floor(this.state.loopTime * 0.35 / 1) + 1;
                    this.ctx.fillStyle = `rgba(${cnR},${cnG},${cnB},0.4)`;
                    this.ctx.font = '500 9px DM Mono, monospace';
                    this.ctx.textAlign = 'right';
                    this.ctx.fillText(`LOOP ×${loopCount}`, this.CX + centerR - 10, this.CY - centerR * 0.6);

                    this.ctx.fillStyle = `rgba(${cnR},${cnG},${cnB},0.9)`;
                    this.ctx.font = '600 14px DM Mono, monospace';
                    this.ctx.textAlign = 'center';
                    this.ctx.fillText('PERCEIVE → ADJUST', this.CX, this.CY + centerR - 40);
                    break;
                }
            }

            this.ctx.restore();
            this.ctx.globalAlpha = 1.0;

            // Center border ring
            this.ctx.beginPath();
            this.ctx.arc(this.CX, this.CY, centerR, 0, Math.PI * 2);
            this.ctx.strokeStyle = `rgba(${cnR},${cnG},${cnB},0.18)`;
            this.ctx.lineWidth = 1;
            this.ctx.stroke();

            // Node name at top of center
            this.ctx.fillStyle = `rgba(${cnR},${cnG},${cnB},0.35)`;
            this.ctx.font = '500 12px DM Mono, monospace';
            this.ctx.textAlign = 'center';
            this.ctx.fillText(`STEP ${centerNode.step}`, this.CX, this.CY - centerR + 26);

            // Draw Arcs
            ACTIVE_DATA.forEach((nA, i) => {
                const nB = ACTIVE_DATA[(i + 1) % ACTIVE_DATA.length];
                const isActiveArc = this.state.activeNode !== null &&
                    (ACTIVE_DATA[this.state.activeNode].id === nA.id || ACTIVE_DATA[this.state.activeNode].id === nB.id);
                const [r, g, b] = this._hexToRgb(nA.color);

                this.drawArc(nA, nB,
                    isActiveArc ? 0.35 : 0.1,
                    isActiveArc ? `rgba(${r},${g},${b},0.3)` : null
                );
                this.drawArrowhead(nA, nB);
            });

            // Draw Particles
            this.state.particles.forEach(p => {
                const pos = this._arcPoint(p.t);
                const segNode = ACTIVE_DATA[pos.segIdx];
                const nextNode = ACTIVE_DATA[(pos.segIdx + 1) % ACTIVE_DATA.length];
                const [r1, g1, b1] = this._hexToRgb(segNode.color);
                const [r2, g2, b2] = this._hexToRgb(nextNode.color);
                const [r, g, b] = this._lerpColor([r1, g1, b1], [r2, g2, b2], pos.segT);

                const isNearActive = this.state.activeNode !== null && pos.segIdx === this.state.activeNode;
                const alpha = p.alpha * (isNearActive ? 1.3 : 0.7);

                this.ctx.beginPath();
                this.ctx.arc(pos.x, pos.y, p.size * (isNearActive ? 1.5 : 1), 0, Math.PI * 2);
                this.ctx.fillStyle = `rgba(${r},${g},${b},${Math.min(alpha, 1)})`;
                this.ctx.fill();

                // Trail
                const trailT = ((p.t - 0.008 + 1) % 1);
                const trailPos = this._arcPoint(trailT);
                this.ctx.beginPath();
                this.ctx.arc(trailPos.x, trailPos.y, p.size * 0.5, 0, Math.PI * 2);
                this.ctx.fillStyle = `rgba(${r},${g},${b},${alpha * 0.25})`;
                this.ctx.fill();
            });

            // Draw Nodes
            ACTIVE_DATA.forEach((node, i) => {
                this.drawNode(node, i === this.state.activeNode, this.state.loopTime + i * 1.2);
            });
        },

        reset: function () {
            this.state.activeNode = null;
            this.state.loopTime = 0;
            this.state.particles.forEach((p, i) => p.t = i / this.state.particles.length);
            this._renderDetail();
        },

        destroy: function () {
            // Cleanup bindings if needed
        },

        // Helper methods
        _buildLayout: function (container) {
            container.innerHTML = `
                <div id="canvas-wrap">
                    <canvas id="c" class="sim-canvas"></canvas>
                    <div class="sim-signal-selectors">
                        <div class="signal-group align-left">
                            <button class="signal-btn active" data-signal="eeg">EEG (Brain)</button>
                            <button class="signal-btn" data-signal="hrv">HRV (Heart)</button>
                        </div>
                        <div class="signal-group align-right">
                            <button class="signal-btn" data-signal="gsr">GSR (Skin)</button>
                            <button class="signal-btn" data-signal="respiration">Breathing</button>
                        </div>
                    </div>
                </div>
                <div class="detail-panel" id="detail-panel">
                    <div class="detail-inner" id="detail-inner">
                        <div class="detail-empty">
                            <div class="big">↺</div>
                            Click any node to explore that step of the loop
                        </div>
                    </div>
                    <div class="detail-nav" id="detail-nav" style="display:none">
                        <button class="nav-btn" id="nav-prev">← Prev</button>
                        <div class="nav-dots" id="nav-dots"></div>
                        <button class="nav-btn" id="nav-next">Next →</button>
                    </div>
                </div>
            `;
            this.elements.canvasWrap = container.querySelector('#canvas-wrap');
            this.elements.canvas = container.querySelector('#c');
            this.ctx = this.elements.canvas.getContext('2d');
            this.elements.inner = container.querySelector('#detail-inner');
            this.elements.nav = container.querySelector('#detail-nav');
            this.elements.dots = container.querySelector('#nav-dots');
            this.elements.prevBtn = container.querySelector('#nav-prev');
            this.elements.nextBtn = container.querySelector('#nav-next');

            this.elements.signalBtns = container.querySelectorAll('.signal-btn');

            // Re-render dots based on nodes
            this._buildDots();
        },

        _buildDots: function () {
            this.elements.dots.innerHTML = ACTIVE_DATA.map((n, i) => {
                return `<div class="nav-dot" data-idx="${i}"></div>`;
            }).join('');

            this.elements.dots.querySelectorAll('.nav-dot').forEach(dot => {
                dot.addEventListener('click', () => {
                    this.state.activeNode = parseInt(dot.dataset.idx);
                    this._renderDetail();
                });
            });
        },

        _bindEvents: function () {
            const canvas = this.elements.canvas;

            canvas.addEventListener('click', e => {
                const rect = canvas.getBoundingClientRect();
                const mx = e.clientX - rect.left;
                const my = e.clientY - rect.top;

                let hit = null;
                ACTIVE_DATA.forEach((node, i) => {
                    const p = this._nodePos(node);
                    const dx = mx - p.x, dy = my - p.y;
                    if (Math.sqrt(dx * dx + dy * dy) < this.simConfig.nodeRadius + 8) hit = i;
                });

                if (hit !== null) {
                    this.state.activeNode = (this.state.activeNode === hit) ? null : hit;
                    this._renderDetail();
                }
            });

            canvas.addEventListener('mousemove', e => {
                const rect = canvas.getBoundingClientRect();
                const mx = e.clientX - rect.left;
                const my = e.clientY - rect.top;
                let over = false;
                ACTIVE_DATA.forEach(node => {
                    const p = this._nodePos(node);
                    const dx = mx - p.x, dy = my - p.y;
                    if (Math.sqrt(dx * dx + dy * dy) < this.simConfig.nodeRadius + 8) over = true;
                });
                canvas.style.cursor = over ? 'pointer' : 'default';
            });

            this.elements.prevBtn.addEventListener('click', () => {
                this.state.activeNode = ((this.state.activeNode ?? 0) - 1 + ACTIVE_DATA.length) % ACTIVE_DATA.length;
                this._renderDetail();
            });
            this.elements.nextBtn.addEventListener('click', () => {
                this.state.activeNode = ((this.state.activeNode ?? -1) + 1) % ACTIVE_DATA.length;
                this._renderDetail();
            });

            this.elements.signalBtns.forEach(btn => {
                btn.addEventListener('click', () => {
                    // Update active state
                    this.elements.signalBtns.forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');

                    const newType = btn.dataset.signal;
                    if (this.state.activeSignalType !== newType && DATA[newType]) {
                        this.state.activeSignalType = newType;
                        ACTIVE_DATA = DATA[newType];
                        this._buildDots(); // Re-bind dot listeners to new data structure length (if needed)

                        // Trigger a fade transition for the center text/art
                        this.state.lastCenterIdx = null;
                        this.state.centerFade = 0;

                        // Force update detail panel if a node is currently selected
                        if (this.state.activeNode !== null) {
                            this._renderDetail();
                        }
                    }
                });
            });
        },

        _renderDetail: function () {
            const inner = this.elements.inner;
            const nav = this.elements.nav;
            const dots = this.elements.dots;

            if (this.state.activeNode === null) {
                inner.innerHTML = `<div class="detail-empty"><div class="big">↺</div>Click any node to explore that step of the loop</div>`;
                nav.style.display = 'none';
                return;
            }

            const node = ACTIVE_DATA[this.state.activeNode];
            const [r, g, b] = this._hexToRgb(node.color);

            inner.innerHTML = `
                <div class="detail-step">Step ${node.step} of 5</div>
                <div class="detail-title" style="color:rgb(${r},${g},${b})">${node.title}</div>
                <div class="detail-divider"></div>
                <div class="detail-body">${node.body.replace(/\n/g, '<br><br>')}</div>
                <div class="detail-example">
                    <div class="detail-example-label">In Practice</div>
                    <div class="detail-example-text">${node.example}</div>
                </div>
                <div class="detail-why">${node.why}</div>
            `;

            nav.style.display = 'flex';

            dots.querySelectorAll('.nav-dot').forEach((dot, i) => {
                const n = ACTIVE_DATA[i];
                const [dr, dg, db] = this._hexToRgb(n.color);
                dot.className = `nav-dot ${i === this.state.activeNode ? 'active' : ''}`;
                dot.style.background = i === this.state.activeNode ? `rgb(${dr},${dg},${db})` : '';
                dot.style.boxShadow = i === this.state.activeNode ? `0 0 5px rgba(${dr},${dg},${db},0.5)` : '';
            });
        },

        // Utilities
        _hexToRgb: function (hex) {
            const r = parseInt(hex.slice(1, 3), 16);
            const g = parseInt(hex.slice(3, 5), 16);
            const b = parseInt(hex.slice(5, 7), 16);
            return [r, g, b];
        },

        _lerpColor: function (c1, c2, t) {
            return [
                Math.round(c1[0] + (c2[0] - c1[0]) * t),
                Math.round(c1[1] + (c2[1] - c1[1]) * t),
                Math.round(c1[2] + (c2[2] - c1[2]) * t),
            ];
        },

        _nodePos: function (node) {
            return {
                x: this.CX + Math.cos(node.angle) * this.RADIUS,
                y: this.CY + Math.sin(node.angle) * this.RADIUS,
            };
        },

        _arcPoint: function (t) {
            const angle = -Math.PI / 2 + t * Math.PI * 2;
            const totalNodes = ACTIVE_DATA.length;
            const tNorm = ((t % 1) + 1) % 1;
            const segIdx = Math.floor(tNorm * totalNodes) % totalNodes;
            const segT = (tNorm * totalNodes) - Math.floor(tNorm * totalNodes);
            return {
                x: this.CX + Math.cos(angle) * this.ORBIT_R,
                y: this.CY + Math.sin(angle) * this.ORBIT_R,
                segIdx,
                segT,
            };
        }
    };
})();
