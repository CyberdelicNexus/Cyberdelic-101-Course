/**
 * Option Selector Method
 * Selection-based teaching method for single or multi-choice questions.
 * 
 * Features:
 * - Single-choice (radio): One answer only
 * - Multi-choice (checkbox): Multiple answers, with optional synthesis
 * 
 * Factory Pattern (matches other methods)
 */

(function () {
    'use strict';

    if (typeof createTeachingMethod === 'undefined') {
        console.error('Core dependency "method-base.js" missing.');
        return;
    }

    const OptionSelectorFactory = function () {
        return createTeachingMethod('option-selector', {


            // ========== PRIVATE STATE ==========
            _config: null,
            _questions: [],
            _currentQuestionIndex: 0,
            _selectedIds: new Set(),
            _isComplete: false,
            _awaitingNext: false,
            _awaitingRetry: false,

            // ========== LIFECYCLE ==========

            onInit: function (container, options = {}) {
                // 0. Robust data loading (normalize questions)
                const questions = options.questions
                    || (options.content && options.content.questions)
                    || (options.config && options.config.questions);

                if (questions && Array.isArray(questions)) {
                    this._questions = questions;
                } else {
                    // Legacy single question support or direct options
                    const optList = options.options || (options.content && options.content.options) || [];
                    const qText = options.question || (options.content && options.content.question) || 'Make a selection:';
                    const synth = options.synthesis || (options.content && options.content.synthesis) || {};

                    this._questions = [{
                        question: qText,
                        options: optList,
                        synthesis: synth,
                        fallbackSynthesis: options.fallbackSynthesis || (options.content && options.content.fallbackSynthesis)
                    }];
                }

                // 1. Robust config loading
                const cfg = options.config || options || {};
                this._config = {
                    mode: cfg.mode || (options.content && options.content.mode) || 'single', // 'single' or 'multi'
                    style: cfg.style || (options.content && options.content.style) || 'card', // 'card' or 'text'
                    confirmButtonText: cfg.confirmButtonText || (options.content && options.content.confirmButtonText) || 'Confirm'
                };

                this._currentQuestionIndex = 0;
                this._selectedIds.clear();
                this._isComplete = false;

                // Set total steps based on question count
                this.setTotalSteps(this._questions.length);

                // Render UI
                this._render(container);

                console.log('[OptionSelector] Initialized:', this._config.mode, 'mode with', this._questions.length, 'questions');
            },

            onDestroy: function () {
                // Cleanup handled by container removal
            },

            onReset: function () {
                this._currentQuestionIndex = 0;
                this._selectedIds.clear();
                this._isComplete = false;
                this._awaitingNext = false;
                this._awaitingRetry = false;
                const container = this._getState().container;
                if (container) {
                    this._render(container);
                }
            },

            // ========== STATE ==========

            getCustomState: function () {
                return {
                    currentQuestionIndex: this._currentQuestionIndex,
                    selectedIds: Array.from(this._selectedIds),
                    isComplete: this._isComplete
                };
            },

            setCustomState: function (savedState) {
                if (typeof savedState.currentQuestionIndex !== 'undefined') {
                    this._currentQuestionIndex = savedState.currentQuestionIndex;
                }
                if (savedState.selectedIds) {
                    this._selectedIds = new Set(savedState.selectedIds);
                }
                this._isComplete = savedState.isComplete || false;
            },

            // ========== RENDERING ==========

            _getCurrentQuestion: function () {
                return this._questions[this._currentQuestionIndex];
            },

            _render: function (container) {
                container.innerHTML = '';

                const currentQ = this._getCurrentQuestion();

                // Wrapper
                const wrapper = document.createElement('div');
                wrapper.className = 'os-container';
                wrapper.innerHTML = `
                    <div class="os-corner-node top-left"></div>
                    <div class="os-corner-node top-right"></div>
                    <div class="os-corner-node bottom-left"></div>
                    <div class="os-corner-node bottom-right"></div>
                `;

                // Question
                const questionEl = document.createElement('div');
                questionEl.className = 'os-question';
                questionEl.innerHTML = currentQ.question;
                wrapper.appendChild(questionEl);

                // Options Container - Grid for cards, List for quiz
                const optionsContainer = document.createElement('div');
                optionsContainer.className = this._config.style === 'text'
                    ? 'os-options-text'
                    : 'os-options-grid';

                // FORCE FLEX STYLES
                if (this._config.style !== 'text') {
                    optionsContainer.style.display = 'flex';
                    optionsContainer.style.flexWrap = 'wrap';
                    optionsContainer.style.justifyContent = 'center'; // Center orphan items
                    optionsContainer.style.gap = '16px';
                    optionsContainer.style.width = '100%';
                }

                currentQ.options.forEach(opt => {
                    const optionEl = document.createElement('div');
                    optionEl.className = this._config.style === 'text'
                        ? 'os-option-text'
                        : 'os-option';

                    // Reduce padding & Enforce sizing
                    if (this._config.style !== 'text') {
                        optionEl.style.padding = '12px 24px';
                        optionEl.style.flex = '0 1 30%';
                        optionEl.style.minWidth = '180px';
                        optionEl.style.maxWidth = '300px';
                    }
                    optionEl.dataset.id = opt.id;

                    // Icon (only for card style)
                    if (this._config.style !== 'text' && opt.icon) {
                        const iconEl = document.createElement('div');
                        iconEl.className = 'os-option-icon';
                        iconEl.textContent = opt.icon;
                        optionEl.appendChild(iconEl);
                    }

                    // Label
                    const labelEl = document.createElement('div');
                    labelEl.className = 'os-option-label';
                    labelEl.textContent = opt.label;
                    optionEl.appendChild(labelEl);

                    // Click Handler
                    optionEl.addEventListener('click', () => this._handleOptionClick(opt.id, optionEl));

                    optionsContainer.appendChild(optionEl);
                });

                wrapper.appendChild(optionsContainer);

                // Response Area (hidden initially)
                const responseArea = document.createElement('div');
                responseArea.className = 'os-response-area';
                responseArea.style.display = 'none';
                wrapper.appendChild(responseArea);

                // Confirm Button (for BOTH modes now)
                const btnWrapper = document.createElement('div');
                btnWrapper.className = 'os-btn-wrapper';

                const confirmBtn = document.createElement('button');
                confirmBtn.className = 'btn btn-primary os-confirm-btn';
                confirmBtn.textContent = this._config.confirmButtonText;
                confirmBtn.disabled = true;
                confirmBtn.addEventListener('click', () => this._handleConfirm());

                btnWrapper.appendChild(confirmBtn);
                wrapper.appendChild(btnWrapper);

                container.appendChild(wrapper);
            },

            // ========== INTERACTION ==========

            _handleOptionClick: function (id, element) {
                if (this._isComplete || this._awaitingNext) return;

                // Handle Retry Reset: Clear everything but continue with new selection
                if (this._awaitingRetry) {
                    this._resetSelection();
                    // Since _resetSelection clears _selectedIds, we start fresh below
                }

                const container = this._getState().container;

                if (this._config.mode === 'single') {
                    // Clear previous selection
                    this._selectedIds.clear();
                    container.querySelectorAll('.os-option-text.selected, .os-option.selected').forEach(el => el.classList.remove('selected'));

                    // Select this one
                    this._selectedIds.add(id);
                    element.classList.add('selected');

                    // Hide response until confirm
                    this._hideResponse();

                } else {
                    // Toggle selection
                    if (this._selectedIds.has(id)) {
                        this._selectedIds.delete(id);
                        element.classList.remove('selected');
                    } else {
                        this._selectedIds.add(id);
                        element.classList.add('selected');
                    }

                    // Live Preview Logic (with validation check)
                    // "Hiding again if its correct until the button is pressed"
                    if (this._isSelectionCorrect(this._selectedIds)) {
                        this._hideResponse();
                    } else {
                        // Show preview (stripped of Correct/Incorrect labels)
                        if (this._config.style !== 'text') {
                            if (this._config.mode === 'single') {
                                this._showResponse(id, true);
                            } else {
                                this._showSynthesizedResponse(false, true);
                            }
                        }
                    }
                }

                // Enable/disable confirm button (both modes)
                const confirmBtn = container.querySelector('.os-confirm-btn');
                if (confirmBtn) {
                    confirmBtn.disabled = this._selectedIds.size === 0;
                }
            },

            _handleConfirm: function () {
                // Handling State Transitions
                if (this._awaitingNext) {
                    // Move to next question or complete
                    if (this._currentQuestionIndex < this._questions.length - 1) {
                        this._currentQuestionIndex++;
                        this._selectedIds.clear();
                        this._awaitingNext = false;

                        // Re-render next question
                        const container = this._getState().container;
                        this._render(container);

                        // Update progress
                        this.advanceStep();
                    } else {
                        this._complete();
                    }
                    return;
                }

                if (this._awaitingRetry) {
                    this._resetSelection();
                    return;
                }

                if (this._selectedIds.size === 0 || this._isComplete) return;


                // --- VALIDATION LOGIC ---
                const isCorrect = this._isSelectionCorrect(this._selectedIds);

                // --- OUTCOME HANDLING ---
                const container = this._getState().container;
                const confirmBtn = container.querySelector('.os-confirm-btn');

                // Visual feedback on selected option + response area
                const _selectedEl = container.querySelector('.os-option-text.selected, .os-option.selected');
                const _responseArea = container.querySelector('.os-response-area');

                if (isCorrect) {
                    // CASE: CORRECT
                    if (this._config.mode === 'single') {
                        const selectedId = Array.from(this._selectedIds)[0];
                        this._showResponse(selectedId);
                    } else {
                        this._showSynthesizedResponse(false);
                    }

                    if (_selectedEl) _selectedEl.classList.add('os-answer-correct');
                    if (_responseArea) {
                        _responseArea.classList.remove('os-response-incorrect');
                        _responseArea.classList.add('os-response-correct');
                    }

                    // Change State to Awaiting Next
                    this._awaitingNext = true;
                    if (confirmBtn) {
                        const isLast = this._currentQuestionIndex === this._questions.length - 1;
                        confirmBtn.textContent = isLast ? 'Complete Lesson' : 'Next Question ▶';
                        confirmBtn.classList.add('btn-success');
                        confirmBtn.style.display = 'inline-block';
                    }

                } else {
                    // CASE: INCORRECT
                    if (this._config.mode === 'single') {
                        const selectedId = Array.from(this._selectedIds)[0];
                        this._showResponse(selectedId);
                    } else {
                        this._showSynthesizedResponse(false);
                    }

                    if (_selectedEl) {
                        _selectedEl.classList.add('os-answer-incorrect');
                        setTimeout(() => _selectedEl.classList.remove('os-answer-incorrect'), 500);
                    }
                    if (_responseArea) {
                        _responseArea.classList.remove('os-response-correct');
                        _responseArea.classList.add('os-response-incorrect');
                    }

                    // Change State to Awaiting Retry
                    this._awaitingRetry = true;
                    if (confirmBtn) {
                        confirmBtn.textContent = 'Try Again ↺';
                        confirmBtn.classList.add('btn-warning');
                    }
                }
            },

            _resetSelection: function () {
                const container = this._getState().container;

                // Clear state
                this._selectedIds.clear();
                this._awaitingRetry = false;

                // Reset UI
                container.querySelectorAll('.os-option-text.selected, .os-option.selected').forEach(el => el.classList.remove('selected'));

                // Hide Response Area
                const responseArea = container.querySelector('.os-response-area');
                if (responseArea) {
                    responseArea.style.display = 'none';
                    responseArea.classList.remove('active');
                }

                // Reset Button
                const confirmBtn = container.querySelector('.os-confirm-btn');
                if (confirmBtn) {
                    confirmBtn.textContent = this._config.confirmButtonText;
                    confirmBtn.classList.remove('btn-warning');
                    confirmBtn.classList.remove('btn-success');
                    confirmBtn.disabled = true;
                }
            },

            _isSelectionCorrect: function (selectedIds) {
                const currentQ = this._getCurrentQuestion();
                const correctOptionIds = currentQ.options
                    .filter(o => o.correct === true)
                    .map(o => o.id);

                if (correctOptionIds.length === 0) return true; // Default behavior

                const selectedArray = Array.from(selectedIds);
                const allSelectedAreCorrect = selectedArray.every(id => correctOptionIds.includes(id));
                const allCorrectAreSelected = correctOptionIds.length === selectedArray.length; // assuming unique IDs

                return allSelectedAreCorrect && allCorrectAreSelected;
            },

            _showResponse: function (singleId, isPreview = false) {
                const container = this._getState().container;
                const responseArea = container.querySelector('.os-response-area');

                const currentQ = this._getCurrentQuestion();
                const option = currentQ.options.find(o => o.id === singleId);
                const synthesis = currentQ.synthesis || {};

                // Use synthesis[id] if available, otherwise option.response
                let text = synthesis[singleId] || (option ? option.response : null);

                if (option && text) {
                    if (isPreview) {
                        text = text.replace(/^(Correct|Incorrect)[!.]\s*/i, '');
                    }

                    // New Structure: Label Header + Body
                    responseArea.innerHTML = `
                        <div class="os-synthesis-header">${option.label}</div>
                        <div class="os-synthesis-body">${text}</div>
                    `;

                    responseArea.style.display = 'block';
                    responseArea.classList.add('active');
                }
            },

            _showSynthesizedResponse: function (hideConfirm = true, isPreview = false) {
                const container = this._getState().container;
                const responseArea = container.querySelector('.os-response-area');

                // If nothing selected, hide response area
                if (this._selectedIds.size === 0) {
                    responseArea.style.display = 'none';
                    responseArea.classList.remove('active');
                    return;
                }

                const currentQ = this._getCurrentQuestion();
                // Build synthesis key (sorted IDs joined by +)
                const sortedIds = Array.from(this._selectedIds).sort();
                const key = sortedIds.join('+');

                // 1. Build Header (Labels: "Fire + Water")
                const labels = sortedIds.map(id => {
                    const opt = currentQ.options.find(o => o.id === id);
                    return opt ? opt.label : id;
                });
                const headerText = labels.join(' + ');


                // 2. Build Body (Response)
                const synthesis = currentQ.synthesis || {};
                let bodyText = synthesis[key];

                // Fallback: If no exact synthesis match
                if (!bodyText) {
                    // Collect individual responses (without labels in body)
                    const parts = sortedIds.map(id => {
                        // Check synthesis first for individual IDs too
                        if (synthesis[id]) return synthesis[id];

                        const opt = currentQ.options.find(o => o.id === id);
                        return opt && opt.response ? opt.response : '';
                    }).filter(Boolean);

                    bodyText = parts.length > 0
                        ? parts.join('<br>') // Join with line break
                        : (currentQ.fallbackSynthesis || 'You have made your selections.');
                }

                // 3. Strip Preview Logic
                if (isPreview) {
                    // User Request: Only show combined labels (header) until button is pressed.
                    // Clear body text completely for preview.
                    bodyText = '';
                }

                // 4. Render
                responseArea.innerHTML = `
                    <div class="os-synthesis-header">${headerText}</div>
                    <div class="os-synthesis-body">${bodyText}</div>
                `;

                responseArea.style.display = 'block';
                responseArea.classList.add('active');

                // Optionally hide confirm button (only on final confirm)
                if (hideConfirm) {
                    const confirmBtn = container.querySelector('.os-confirm-btn');
                    if (confirmBtn) confirmBtn.style.display = 'none';
                }
            },

            _complete: function () {
                this._isComplete = true;
                this.markComplete();

                // Emit event with selection data
                this.emit('selectionMade', {
                    mode: this._config.mode,
                    selectedIds: Array.from(this._selectedIds)
                });
            },

            _hideResponse: function () {
                const container = this._getState().container;
                const responseArea = container.querySelector('.os-response-area');
                if (responseArea) {
                    responseArea.style.display = 'none';
                    responseArea.classList.remove('active');
                }
            }
        });
    };

    // ========== EXPORT ==========
    if (window.MethodLoader) {
        window.MethodLoader.registerFactory('option-selector', OptionSelectorFactory);
    }

    // Always expose for direct access (LessonRunner fallback)
    window.OptionSelectorFactory = OptionSelectorFactory;

})();
