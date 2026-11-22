/**
 * Scenario-Based Method
 * Branching narrative teaching method implementation
 */

(function () {
    'use strict';

    if (typeof createTeachingMethod === 'undefined') {
        console.error('Core dependency "method-base.js" missing.');
        return;
    }

    const ScenarioBasedFactory = function () {
        return createTeachingMethod('scenario-based', {

            // ---------- Private State ----------
            sceneData: [],
            currentSceneId: null,
            choiceHistory: [],
            moduleTitle: '',

            // ---------- Lifecycle Hooks ----------

            onInit: function (container, options) {
                console.log('[ScenarioBased] onInit for container:', container ? container.id : 'missing');
                console.log('[ScenarioBased] options keys:', Object.keys(options || {}));

                // 0. Robust scene data loading
                this.sceneData = options.scenes || (options.content && options.content.scenes) || [];
                this.moduleTitle = options.title || (options.content && options.content.title) || '';

                // Fallback for array-only options
                if (this.sceneData.length === 0 && Array.isArray(options)) {
                    this.sceneData = options;
                }

                console.log('[ScenarioBased] sceneData count:', this.sceneData.length);
                this.currentSceneId = this.sceneData.length > 0 ? this.sceneData[0].id : null;
                console.log('[ScenarioBased] currentSceneId:', this.currentSceneId);

                this.choiceHistory = [];
                this.setTotalSteps(this.sceneData.length);

                if (this.currentSceneId) {
                    this._renderScene(this.currentSceneId);
                } else {
                    console.warn('[ScenarioBased] NO SCENES LOADED');
                    container.innerHTML = `
                        <div class="error" style="color:#ff5555; background:rgba(0,0,0,0.5); padding:2rem; border:1px solid #ff5555; border-radius:8px;">
                            <h3>Scenario Error</h3>
                            <p>No scenes found in the manifest for this module.</p>
                            <p style="font-size:0.8rem; opacity:0.7;">Module ID: ${options.id || 'unknown'}</p>
                        </div>
                    `;
                }

                // Attach click handler
                this._boundClickHandler = this._handleClick.bind(this);
                container.addEventListener('click', this._boundClickHandler);

                if (options.restore) {
                    this.onReset();
                }
            },

            onDestroy: function () {
                const state = this._getState();
                if (state.container) {
                    state.container.removeEventListener('click', this._boundClickHandler);
                }
            },

            onReset: function () {
                this.choiceHistory = [];
                if (this.sceneData.length > 0) {
                    this._renderScene(this.sceneData[0].id);
                }
            },

            // ---------- State Tracking ----------

            getCustomState: function () {
                return {
                    currentSceneId: this.currentSceneId,
                    choiceHistory: this.choiceHistory
                };
            },

            setCustomState: function (savedState) {
                this.choiceHistory = savedState.choiceHistory || [];
                this.currentSceneId = savedState.currentSceneId || (this.sceneData.length > 0 ? this.sceneData[0].id : null);
                if (this.currentSceneId) {
                    this._renderScene(this.currentSceneId);
                }
            },

            // ---------- Rendering ----------

            _renderScene: function (sceneId) {
                console.log('[ScenarioBased] Rendering scene:', sceneId);

                const scene = this.sceneData.find(s => s.id === sceneId);
                if (!scene) {
                    console.error('[ScenarioBased] Scene not found:', sceneId);
                    return;
                }

                const container = this._getState().container;

                const Icons = window.LessonIcons;
                const kind = this._sceneKind(scene);

                // Build HTML
                let html = `<div class="scenario-scene active" data-scene-id="${scene.id}">`;

                if (this.moduleTitle) {
                    // The header (with its animated emblem) is kept across scenes; see below.
                    html += `<div class="sb-header-slot"></div>`;
                }

                html += `<div class="scene-content sb-kind-${kind}">
                    <div class="sb-corner-node top-left"></div>
                    <div class="sb-corner-node top-right"></div>
                    <div class="sb-corner-node bottom-left"></div>
                    <div class="sb-corner-node bottom-right"></div>`;

                if (Icons) {
                    html += `<div class="sb-badge" aria-hidden="true">${Icons.svg(this._sceneIcon(scene, kind))}</div>`;
                }

                // Media
                if (scene.media) {
                    html += this._generateMediaHTML(scene.media);
                }

                // Narrative
                html += `<div class="scenario-narrative">${scene.narrative || ''}</div>`;

                // Choices
                if (scene.choices && scene.choices.length > 0) {
                    html += `<div class="scenario-choices">`;
                    const isNav = scene.choices.length === 1;
                    scene.choices.forEach((choice, i) => {
                        const nextSceneAttr = choice.outcome ? `data-next-scene="${choice.outcome}"` : '';
                        const icon = !Icons ? '' : isNav
                            ? `<span class="sb-choice-icon sb-choice-arrow">${Icons.svg('arrow')}</span>`
                            : `<span class="sb-choice-icon">${Icons.sigil(i)}</span>`;
                        html += `
                            <div class="choice-option${isNav ? ' sb-choice-nav' : ''}" data-choice-id="${choice.id}" ${nextSceneAttr}>
                                ${isNav ? '' : icon}<div class="choice-text"><strong>${choice.label}</strong></div>${isNav ? icon : ''}
                            </div>
                        `;
                    });
                    html += `</div>`;
                }

                html += `</div>`; // scene-content
                html += `</div>`; // scenario-scene

                // After the first scene only the card is swapped, so the header and its
                // ambient emblem animation stay in place instead of restarting.
                const existingScene = container.querySelector('.scenario-scene.active');
                const existingCard = existingScene && existingScene.querySelector('.scene-content');
                if (existingCard) {
                    const tpl = document.createElement('template');
                    tpl.innerHTML = html;
                    existingCard.replaceWith(tpl.content.querySelector('.scene-content'));
                    existingScene.dataset.sceneId = scene.id;
                } else {
                    container.innerHTML = html;
                    const slot = container.querySelector('.sb-header-slot');
                    if (slot) {
                        const header = document.createElement('div');
                        header.className = 'lx-header sb-header';
                        const firstText = (this.sceneData[0] && this.sceneData[0].narrative) || '';
                        header.innerHTML = (Icons ? Icons.emblem(Icons.topic(this.moduleTitle + ' ' + firstText, 'branch')) : '') +
                            `<h1 class="module-title">${this.moduleTitle}</h1>`;
                        slot.replaceWith(header);
                    }
                }
                this.currentSceneId = sceneId;

                // Terminal Scene Continue Button
                if (!scene.choices || scene.choices.length === 0) {
                    const contentEl = container.querySelector('.scene-content');
                    const continueBtn = document.createElement('button');
                    continueBtn.className = 'scene-continue visible';
                    continueBtn.textContent = 'Continue';
                    continueBtn.style.marginTop = '2rem';
                    continueBtn.addEventListener('click', (e) => {
                        e.target.disabled = true;
                        e.target.textContent = 'Loading...';
                        this.markComplete();
                    });
                    contentEl.appendChild(continueBtn);
                }
            },

            // Classify a scene so it gets a matching badge icon and tone.
            _sceneKind: function (scene) {
                const id = String(scene.id || '').toLowerCase();
                const choices = scene.choices || [];
                const text = String(scene.narrative || '')
                    .replace(/<h3[^>]*>[\s\S]*?<\/h3>/i, ' ')
                    .replace(/<[^>]*>/g, ' ')
                    .trim();
                const endKeywords = ['complete', 'flow_next_module', 'modules_end'];

                if (this.sceneData.indexOf(scene) === 0) return 'intro';
                if (choices.length === 0 ||
                    /reflect|summary|complete|final|conclusion|debrief|wrap/.test(id) ||
                    choices.every(c => endKeywords.indexOf(c.outcome) !== -1)) return 'reflect';
                if (choices.length >= 2) return 'decision';
                if ((/(^|_)(correct|right|best|ideal)/.test(id) && !/incorrect/.test(id)) ||
                    /^(correct|exactly)\b/i.test(text)) return 'correct';
                if (/incorrect|wrong|unsafe|danger|(^|_)miss/.test(id) ||
                    /^(not quite|incorrect|not exactly|this isn['\u2019]t)\b/i.test(text)) return 'miss';
                return 'insight';
            },

            _sceneIcon: function (scene, kind) {
                const Icons = window.LessonIcons;
                switch (kind) {
                    case 'intro': return 'orbit';
                    case 'reflect': return 'spiral';
                    case 'correct': return 'check';
                    case 'miss': return 'retry';
                    case 'insight': return 'prism';
                    default: {
                        const h3 = (String(scene.narrative || '').match(/<h3[^>]*>([\s\S]*?)<\/h3>/i) || [])[1];
                        return Icons.topic(h3 || scene.narrative, 'branch');
                    }
                }
            },

            _generateMediaHTML: function (media) {
                if (!media) return '';
                const pos = media.position ? `media-${media.position}` : 'media-inline';
                let content = '';
                if (media.type === 'image') {
                    content = `<img src="${media.src}" alt="${media.alt || ''}" class="sim-media-image">`;
                } else if (media.type === 'video') {
                    const attrs = media.autoplay !== false ? 'autoplay loop muted playsinline' : 'controls';
                    content = `<video src="${media.src}" ${attrs} class="sim-media-video"></video>`;
                } else if (media.type === 'youtube') {
                    let src = media.src;
                    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
                    const match = src.match(regExp);
                    if (match && match[2].length === 11) {
                        src = `https://www.youtube.com/embed/${match[2]}?autoplay=1&mute=1&controls=0&loop=1`;
                    }
                    content = `<iframe class="sim-media-video" src="${src}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`;
                } else if (media.type === 'threejs') {
                    content = `<div class="threejs-canvas" data-engine="${media.engine}"></div>`;
                }
                return `<div class="media-container ${pos}">${content}</div>`;
            },

            // ---------- Interaction ----------

            _handleClick: function (event) {
                const choiceEl = event.target.closest('.choice-option');
                if (choiceEl && !choiceEl.classList.contains('disabled')) {
                    event.preventDefault();

                    const nextSceneId = choiceEl.dataset.nextScene;
                    console.log('[ScenarioBased] Choice selected, next:', nextSceneId);

                    // Visual feedback
                    const allChoices = choiceEl.closest('.scenario-scene').querySelectorAll('.choice-option');
                    allChoices.forEach(c => c.classList.add('disabled'));
                    choiceEl.classList.add('selected');

                    // Ripple from the pointer position (centre for keyboard clicks)
                    const rect = choiceEl.getBoundingClientRect();
                    const ripple = document.createElement('span');
                    ripple.className = 'sb-ripple';
                    const x = event.clientX ? event.clientX - rect.left : rect.width / 2;
                    const y = event.clientY ? event.clientY - rect.top : rect.height / 2;
                    ripple.style.left = x + 'px';
                    ripple.style.top = y + 'px';
                    choiceEl.appendChild(ripple);

                    if (nextSceneId) {
                        // Support transition keywords
                        if (nextSceneId === 'flow_next_module' || nextSceneId === 'complete' || nextSceneId === 'modules_end') {
                            console.log('[ScenarioBased] Completing module via keyword');
                            this.markComplete();
                            return;
                        }

                        // Navigate to next scene
                        setTimeout(() => {
                            this._renderScene(nextSceneId);
                            this.advanceStep();
                        }, 400);
                    }
                }
            }
        });
    };

    // Export
    window.ScenarioBasedFactory = ScenarioBasedFactory;
    if (window.MethodLoader) {
        window.MethodLoader.registerFactory('scenario-based', ScenarioBasedFactory);
    }
})();
