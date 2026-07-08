/**
 * CYBERDELICS 101 - Lesson Runner
 * 
 * The central engine for orchestrating manifest-based lessons.
 */

(function () {
    'use strict';

    const MethodRegistry = {
        get 'progressive-disclosure'() { return window.ProgressiveDisclosureFactory; },
        get 'interactive-simulation'() { return window.InteractiveSimulationFactory; },
        get 'scenario-based'() { return window.ScenarioBasedFactory; },
        get 'knowledge-construction'() { return window.KnowledgeConstructionFactory; },
        get 'option-selector'() { return window.OptionSelectorFactory; },
        get 'external-links'() { return window.ExternalLinksFactory; }
    };

    class LessonRunner {
        constructor() {
            this.currentLesson = null;
            this.activeModule = null;
            this.activeModuleIndex = -1;
            this.container = null;
            this.isTransitioning = false;
        }

        init(container) {
            this.container = typeof container === 'string'
                ? document.querySelector(container)
                : container;

            if (!this.container) {
                console.error('[LessonRunner] Container not found');
            }
            this._initBackground();
        }

        loadLesson(manifest) {
            this.currentLesson = manifest;
            this.activeModuleIndex = -1;

            console.log(`[LessonRunner] Loading Lesson: ${manifest.title}`);
            this._applyTheme(manifest.theme);

            const startLesson = () => {
                if (window.LessonUI) {
                    window.LessonUI.init(this.container);
                    window.LessonUI.update(manifest.title, 0);
                    if (manifest.artifacts && window.LessonUI.registerArtifacts) {
                        window.LessonUI.registerArtifacts(manifest.artifacts);
                    }
                }

                const event = new CustomEvent('lesson-ready', { detail: { runner: this } });
                window.dispatchEvent(event);

                setTimeout(() => {
                    if (this.activeModuleIndex === -1) {
                        this.nextModule();
                    }
                }, 100);
            };

            if (manifest.skipOpeningScreen) {
                this.container.innerHTML = '';
                startLesson();
            } else {
                this._showOpeningScreen(manifest, startLesson);
            }
        }

        _showOpeningScreen(manifest, onStart) {
            this.container.innerHTML = '';
            const screen = document.createElement('div');
            screen.className = 'opening-screen';

            const mainTitle = manifest.title || 'Cyberdelics 101';
            const eyebrow = manifest.eyebrow || manifest.module || 'Cyberdelics 101';

            screen.innerHTML = `
                <div class="cover-orb cover-orb-1"></div>
                <div class="cover-orb cover-orb-2"></div>
                <div class="cover-center">
                    <p class="cover-eyebrow">${eyebrow}</p>
                    <h1 class="cover-title">${mainTitle}</h1>
                    <button class="opening-begin-btn">Begin</button>
                </div>
            `;
            this.container.appendChild(screen);

            const btn = screen.querySelector('.opening-begin-btn');
            btn.addEventListener('click', () => {
                screen.classList.add('fade-out');
                setTimeout(() => {
                    screen.remove();
                    onStart();
                }, 800);
            });
        }

        nextModule() {
            if (this.isTransitioning || !this.currentLesson) return;
            this.isTransitioning = true;
            setTimeout(() => { this.isTransitioning = false; }, 1000);

            if (this.activeModule && this.activeModule.destroy) {
                this.activeModule.destroy();
            }

            this.activeModuleIndex++;

            if (this.activeModuleIndex >= this.currentLesson.modules.length) {
                this._finishLesson();
                return;
            }

            const moduleConfig = this.currentLesson.modules[this.activeModuleIndex];
            console.log(`[LessonRunner] Loading module ${this.activeModuleIndex}:`, moduleConfig.id);
            this._runModule(moduleConfig);
        }

        prevModule() {
            if (this.isTransitioning || this.activeModuleIndex <= 0) return;
            this.isTransitioning = true;
            setTimeout(() => { this.isTransitioning = false; }, 1000);

            if (this.activeModule && this.activeModule.destroy) {
                this.activeModule.destroy();
            }

            this.activeModuleIndex--;
            this._runModule(this.currentLesson.modules[this.activeModuleIndex], { restore: true });
        }

        jumpTo(index) {
            if (!this.currentLesson || index < 0 || index >= this.currentLesson.modules.length) return;
            if (this.activeModule && this.activeModule.destroy) {
                this.activeModule.destroy();
            }
            this.activeModuleIndex = index;
            this._runModule(this.currentLesson.modules[this.activeModuleIndex]);
        }

        _runModule(moduleConfig, runtimeOptions = {}) {
            const type = moduleConfig.type;

            if (window.LessonUI && window.LessonUI.setBackAction) {
                window.LessonUI.setBackAction(this.activeModuleIndex > 0 ? () => this.prevModule() : null);
            }

            const factory = MethodRegistry[type] || window[this._toPascalCase(type) + 'Factory'];
            if (!factory) {
                console.error(`[LessonRunner] Unknown Method Type: ${type}`);
                return;
            }

            if (window.ArtifactSystem) window.ArtifactSystem.unmount();

            let targetContainer = this.container;
            if (window.LessonUI) {
                targetContainer = window.LessonUI.getContentContainer();
                const progress = (this.activeModuleIndex) / (this.currentLesson.modules.length);
                window.LessonUI.update(null, progress);
            }

            targetContainer.innerHTML = '';
            const moduleContainer = document.createElement('div');
            moduleContainer.className = `module-container module-${type}`;
            moduleContainer.id = moduleConfig.id;
            targetContainer.appendChild(moduleContainer);

            // Special HTML injection for Interactive Simulation (needs viewport/controls)
            if (type === 'interactive-simulation') {
                const showContinue = !moduleConfig.hideContinueButton;
                moduleContainer.style.display = 'flex';
                moduleContainer.style.flexDirection = 'column';
                moduleContainer.style.minHeight = '100%';
                moduleContainer.innerHTML = `
                    <div class="interactive-simulation-container" style="display: flex; flex-direction: column; flex: 1; position: relative; min-height: 60vh;">
                        <!-- The target engine will mount here and wipe this inner content -->
                        <div class="sim-header" style="flex: 0 0 auto; padding-bottom: 0.5rem;">
                            <h3>${moduleConfig.title || ''}</h3>
                        </div>
                        <div class="sim-controls" style="flex: 0 0 auto; padding-bottom: 1rem;"></div>
                        <div class="sim-viewport" style="flex: 1; border: 1px solid #333; position: relative; overflow: hidden; border-radius: 8px;"></div>
                    </div>
                `;
            } else if (moduleConfig.contentHTML) {
                // Legacy / Direct HTML support
                moduleContainer.innerHTML = moduleConfig.contentHTML;
            }

            const instance = factory();

            // Pass the ENTIRE moduleConfig + runtimeOptions for maximum robustness
            const options = { ...moduleConfig, ...runtimeOptions };

            // Only pass the inner simulation container so engines don't delete our footer
            const targetContainerForEngine = moduleContainer.querySelector('.interactive-simulation-container') || moduleContainer;
            instance.init(targetContainerForEngine, options);
            this.activeModule = instance;

            // Re-inject the Continue Button AFTER the engine initializes so it survives the innerHTML sweep
            if (type === 'interactive-simulation') {
                const showContinue = !moduleConfig.hideContinueButton;
                const footer = document.createElement('div');
                footer.className = 'sim-footer';
                footer.style.flex = '0 0 auto';
                footer.style.display = 'flex';
                footer.style.justifyContent = 'center'; // Centered
                footer.style.padding = '1.5rem 0';
                // Removed marginTop: 'auto' so it hugs the bottom of the simulation canvas rather than pushing to the bottom of the screen
                footer.innerHTML = `<button class="btn-continue" style="display: ${showContinue ? 'block' : 'none'};">Continue <span>▶</span></button>`;

                moduleContainer.appendChild(footer);
            }

            instance.on('complete', () => {
                console.log(`[LessonRunner] Module ${moduleConfig.id} Complete`);
                if (moduleConfig.artifacts && window.ArtifactSystem) {
                    moduleConfig.artifacts.forEach(art => {
                        if (art.trigger === 'step_complete') window.ArtifactSystem.collect(art);
                    });
                }
                setTimeout(() => this.nextModule(), 1250);
            });

            if (type === 'interactive-simulation') {
                const btn = moduleContainer.querySelector('.btn-continue');
                if (btn) btn.addEventListener('click', () => {
                    console.log('[LessonRunner] Continue button clicked for Interactive Simulation');
                    instance.markComplete();
                });
            }

            if (moduleConfig.onEnter && window.LessonUI && moduleConfig.onEnter.action === 'openBottomSidebar') {
                setTimeout(() => window.LessonUI.toggleBottomPanel(true), 500);
            }

            const artifacts = (moduleConfig.artifacts || []).concat(moduleConfig.config?.artifacts || []);
            if (window.ArtifactSystem && artifacts.length > 0) {
                window.ArtifactSystem.mount(moduleContainer, artifacts);
            }
        }

        _finishLesson() {
            if (window.LessonUI) {
                window.LessonUI.update(null, 1.0);
                window.LessonUI.setBackAction(null);
            }

            const container = window.LessonUI ? window.LessonUI.getContentContainer() : this.container;

            const nextLesson = this.currentLesson.nextLesson;
            const nextHtml = nextLesson
                ? `<div class="lesson-complete-next">
                       <p class="lesson-complete-next-label">Coming Next</p>
                       <p class="lesson-complete-next-title">${nextLesson.title}</p>
                       ${nextLesson.description ? `<p class="lesson-complete-next-desc">${nextLesson.description}</p>` : ''}
                   </div>`
                : '<p class="lesson-complete-return-hint">Return to the course to continue your journey.</p>';

            container.innerHTML = `
                <div class="lesson-complete-screen">
                    <div class="completed-icon">✔</div>
                    <h1 class="lesson-complete-title">LESSON COMPLETE</h1>
                    <p class="lesson-complete-subtitle">
                        <strong>${this.currentLesson.title}</strong>
                    </p>
                    ${nextHtml}
                </div>
            `;
            // ── NOTIFY FRAMER ─────────────────────────────────────────────
            // Fires once when the lesson complete screen renders.
            // The Framer CyberdelicsLesson component listens for this message
            // and calls its onLessonComplete event prop, which you wire in
            // the Framer canvas to set a boolean variable (e.g. lesson_1_1_complete = true).
            //
            // lessonId is read from the manifest root field: "lessonId": "module_1_lesson_1"
            // If that field is absent, falls back to the manifest title slug.
            const lessonId = this.currentLesson.lessonId
                || this.currentLesson.id
                || (this.currentLesson.title || 'unknown')
                    .toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');

            const payload = {
                type: 'LESSON_COMPLETE',
                lessonId: lessonId,
                timestamp: new Date().toISOString()
            };

            console.log('[LessonRunner] Sending LESSON_COMPLETE to Framer:', payload);
            window.parent.postMessage(payload, '*');
        }

        _initBackground() {
            if (document.getElementById('lr-bg-canvas')) return;
            const canvas = document.createElement('canvas');
            canvas.id = 'lr-bg-canvas';
            canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:1;';
            document.body.prepend(canvas);

            const ctx = canvas.getContext('2d');
            const mouse = { x: -9999, y: -9999 };
            const GRID = 44;
            const GLOW_R = 160;

            const resize = () => {
                canvas.width = window.innerWidth;
                canvas.height = window.innerHeight;
            };
            window.addEventListener('resize', resize);
            document.addEventListener('mousemove', e => { mouse.x = e.clientX; mouse.y = e.clientY; });

            const draw = () => {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                const cols = Math.ceil(canvas.width / GRID) + 1;
                const rows = Math.ceil(canvas.height / GRID) + 1;
                for (let i = 0; i < cols; i++) {
                    for (let j = 0; j < rows; j++) {
                        const x = i * GRID;
                        const y = j * GRID;
                        const dist = Math.hypot(x - mouse.x, y - mouse.y);
                        const t = Math.max(0, 1 - dist / GLOW_R);
                        const alpha = 0.05 + t * 0.3;
                        const r = 1.2 + t * 2.4;
                        ctx.beginPath();
                        ctx.arc(x, y, r, 0, Math.PI * 2);
                        ctx.fillStyle = `rgba(130,90,255,${alpha.toFixed(2)})`;
                        ctx.fill();
                    }
                }
                requestAnimationFrame(draw);
            };

            resize();
            draw();
        }

        _applyTheme(theme) {
            if (!theme || !this.container) return;
            const root = this.container;
            if (theme.primaryColor) root.style.setProperty('--primary-color', theme.primaryColor);
            if (theme.fontBody) root.style.setProperty('--font-body', theme.fontBody);
        }

        _toPascalCase(str) {
            return str.replace(/(^|-)./g, x => x.slice(-1).toUpperCase());
        }
    }

    window.LessonRunner = new LessonRunner();
})();