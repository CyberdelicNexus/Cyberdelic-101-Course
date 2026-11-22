/**
 * CYBERDELICS 101 - Teaching Method Base
 * Shared interface that all teaching methods must implement
 * 
 * This provides a consistent API for:
 * - Progress tracking
 * - State management (save/restore)
 * - Event-based method communication
 * - Composition (nesting methods)
 */

/**
 * Creates a new teaching method with the standard interface
 * @param {string} methodName - Unique identifier for this method
 * @param {object} implementation - Method-specific functions
 * @returns {object} Complete method with base + custom functions
 */
function createTeachingMethod(methodName, implementation) {
    'use strict';

    // ---------- Private State ----------
    const state = {
        name: methodName,
        container: null,
        isInitialized: false,
        currentStep: 0,
        totalSteps: 0,
        isComplete: false,
        parent: null,
        children: [],
        eventListeners: {}
    };

    // ---------- Event System ----------
    const events = {
        emit: function (eventName, data) {
            const listeners = state.eventListeners[eventName] || [];
            listeners.forEach(callback => callback(data));

            // Also emit to parent if nested
            if (state.parent && state.parent.emit) {
                state.parent.emit(`${methodName}:${eventName}`, data);
            }
        },

        on: function (eventName, callback) {
            if (!state.eventListeners[eventName]) {
                state.eventListeners[eventName] = [];
            }
            state.eventListeners[eventName].push(callback);
        },

        off: function (eventName, callback) {
            if (!state.eventListeners[eventName]) return;
            state.eventListeners[eventName] = state.eventListeners[eventName]
                .filter(cb => cb !== callback);
        }
    };

    // ---------- Base Interface ----------
    const base = {
        // ========== LIFECYCLE ==========

        /**
         * Initialize method on a container element
         * @param {string} containerSelector - CSS selector or element
         * @param {object} options - Configuration options
         */
        init: function (containerSelector, options = {}) {
            // Find container
            state.container = typeof containerSelector === 'string'
                ? document.querySelector(containerSelector)
                : containerSelector;

            if (!state.container) {
                console.error(`[${methodName}] Container not found:`, containerSelector);
                return false;
            }

            state.isInitialized = true;

            // Call implementation's init if provided
            if (implementation.onInit) {
                implementation.onInit.call(this, state.container, options);
            }

            events.emit('init', { container: state.container });
            return true;
        },

        /**
         * Clean up event listeners and reset state
         */
        destroy: function () {
            if (implementation.onDestroy) {
                implementation.onDestroy.call(this);
            }

            // Destroy children first
            state.children.forEach(child => child.destroy());

            state.eventListeners = {};
            state.isInitialized = false;
            events.emit('destroy', {});
        },

        /**
         * Reset to initial state
         */
        reset: function () {
            state.currentStep = 0;
            state.isComplete = false;

            if (implementation.onReset) {
                implementation.onReset.call(this);
            }

            events.emit('reset', {});
        },

        // ========== PROGRESS ==========

        getProgress: function () {
            return state.totalSteps > 0
                ? state.currentStep / state.totalSteps
                : 0;
        },

        getTotalSteps: function () {
            return state.totalSteps;
        },

        getCurrentStep: function () {
            return state.currentStep;
        },

        setTotalSteps: function (total) {
            state.totalSteps = total;
        },

        advanceStep: function () {
            if (state.currentStep < state.totalSteps) {
                state.currentStep++;
                events.emit('stepComplete', {
                    step: state.currentStep,
                    total: state.totalSteps,
                    progress: this.getProgress()
                });

                // Notify CourseCore if available
                if (typeof CourseCore !== 'undefined') {
                    CourseCore.advanceProgress();
                }
            }
        },

        onStepComplete: function (callback) {
            events.on('stepComplete', callback);
        },

        // ========== STATE ==========

        getState: function () {
            const baseState = {
                name: state.name,
                currentStep: state.currentStep,
                totalSteps: state.totalSteps,
                isComplete: state.isComplete
            };

            // Merge with implementation state
            if (implementation.getCustomState) {
                return { ...baseState, ...implementation.getCustomState.call(this) };
            }
            return baseState;
        },

        setState: function (savedState) {
            state.currentStep = savedState.currentStep || 0;
            state.totalSteps = savedState.totalSteps || state.totalSteps;
            state.isComplete = savedState.isComplete || false;

            if (implementation.setCustomState) {
                implementation.setCustomState.call(this, savedState);
            }

            events.emit('stateRestored', savedState);
        },

        isComplete: function () {
            return state.isComplete;
        },

        markComplete: function () {
            state.isComplete = true;
            events.emit('complete', { method: state.name });
        },

        // ========== COMPOSITION ==========

        setParent: function (parentMethod) {
            state.parent = parentMethod;
        },

        addChild: function (childMethod, containerEl) {
            childMethod.setParent(this);
            state.children.push(childMethod);
            return childMethod;
        },

        getChildren: function () {
            return state.children;
        },

        // ========== EVENTS ==========
        emit: events.emit,
        on: events.on,
        off: events.off,

        // ========== INTERNAL ACCESS ==========
        _getState: function () { return state; },
        _getName: function () { return methodName; }
    };

    // Merge base with implementation
    return { ...base, ...implementation };
}

// Export for use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { createTeachingMethod };
}

/* ==========================================================================
   LessonIcons — inline SVG line icons shared by the teaching methods.
   Drawn for the lesson player: 24px grid, 1.5 stroke, round joins, no fills
   except small accent nodes. Inline only (the lesson frame's CSP blocks
   every external or data: image), so icons are returned as markup strings.
   ========================================================================== */
(function () {
    'use strict';
    if (typeof window === 'undefined') return;

    var P = {
        headset: '<path d="M3 9.5A2.5 2.5 0 0 1 5.5 7h13A2.5 2.5 0 0 1 21 9.5v4a2.5 2.5 0 0 1-2.5 2.5h-3.2l-1.6-2a1.5 1.5 0 0 0-2.4 0l-1.6 2H5.5A2.5 2.5 0 0 1 3 13.5z"/><path d="M3 11H1.5M21 11h1.5"/><circle class="li-node" cx="12" cy="10.5" r="1"/>',
        person: '<circle cx="12" cy="8" r="3.2"/><path d="M5.5 19.5c.8-3.4 3.4-5.5 6.5-5.5s5.7 2.1 6.5 5.5"/><circle class="li-node" cx="18.5" cy="5" r="1"/>',
        pulse: '<path d="M2.5 12h4l2-5 3.5 10 2.5-7 1.5 2h5.5"/><circle class="li-node" cx="21.5" cy="12" r="1"/>',
        shield: '<path d="M12 3l7 3v5.5c0 4.3-3 7.7-7 9.5-4-1.8-7-5.2-7-9.5V6z"/><circle class="li-node" cx="12" cy="11" r="1.6"/><path d="M12 12.6v3"/>',
        compass: '<circle cx="12" cy="12" r="8.5"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/><circle class="li-node" cx="12" cy="12" r="0.9"/>',
        hourglass: '<path d="M6.5 3h11M6.5 21h11"/><path d="M8 3v2.5c0 2 4 4.5 4 6.5s-4 4.5-4 6.5V21M16 3v2.5c0 2-4 4.5-4 6.5s4 4.5 4 6.5V21"/><circle class="li-node" cx="12" cy="18" r="1"/>',
        eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/><circle class="li-node" cx="12" cy="12" r="1"/>',
        term: '<path d="M8 5H5v14h3M16 5h3v14h-3"/><path d="M9.5 12h5"/><circle class="li-node" cx="12" cy="8.5" r="1"/>',
        network: '<circle cx="6" cy="7" r="2"/><circle cx="18" cy="7" r="2"/><circle cx="12" cy="18" r="2"/><path d="M8 7h8M7 8.8l4 7.4M17 8.8l-4 7.4"/><circle class="li-node" cx="12" cy="10.5" r="1"/>',
        branch: '<circle cx="6" cy="5" r="2"/><circle cx="6" cy="19" r="2"/><circle cx="18" cy="9" r="2"/><path d="M6 7v10M6 14c0-3 2.5-5 6-5h4"/>',
        orbit: '<circle cx="12" cy="12" r="3"/><ellipse cx="12" cy="12" rx="9.5" ry="4" transform="rotate(-25 12 12)"/><circle class="li-node" cx="20" cy="8.2" r="1"/>',
        prism: '<path d="M12 4 20 18.5H4z"/><path d="M1.5 13.5l7.2-1.3"/><path d="M16.2 11.2l6.3-1.7M16.8 13.2h5.7M16.2 15.2l6.3 1.7"/>',
        spiral: '<path d="M12 10.5a1.5 1.5 0 0 1 1.5 1.5 3 3 0 0 1-3 3 4.5 4.5 0 0 1-4.5-4.5 6 6 0 0 1 6-6 7.5 7.5 0 0 1 7.5 7.5"/><circle class="li-node" cx="12" cy="12" r="0.9"/>',
        check: '<circle cx="12" cy="12" r="9"/><path class="li-draw" d="M7.5 12.5l3 3 6-6.5"/>',
        retry: '<path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3"/><path class="li-draw" d="M4.5 4.5v4h4"/>',
        cross: '<circle cx="12" cy="12" r="9"/><path class="li-draw" d="M8.8 8.8l6.4 6.4M15.2 8.8l-6.4 6.4"/>',
        arrow: '<path d="M5 12h13"/><path d="M13 6.5l5.5 5.5-5.5 5.5"/>',
        // Option sigils: one geometric glyph per answer slot
        sig0: '<circle cx="12" cy="12" r="6.5"/><circle class="li-node" cx="12" cy="12" r="1.4"/>',
        sig1: '<path d="M12 5.5l7 12.5H5z"/><circle class="li-node" cx="12" cy="13.6" r="1.4"/>',
        sig2: '<path d="M12 4.5l7.5 7.5-7.5 7.5-7.5-7.5z"/><circle class="li-node" cx="12" cy="12" r="1.4"/>',
        sig3: '<path d="M12 4.5l6.5 3.75v7.5L12 19.5l-6.5-3.75v-7.5z"/><circle class="li-node" cx="12" cy="12" r="1.4"/>',
        sig4: '<rect x="6" y="6" width="12" height="12" rx="1.5"/><circle class="li-node" cx="12" cy="12" r="1.4"/>'
    };

    // Topic keywords, checked in order; first hit wins.
    var TOPICS = [
        ['hourglass', /\b(1[89]\d\d|20\d\d)\b|histor|origin|pioneer|conference|decade|era\b/i],
        ['term', /\bmean(s|ing)?\b|refer|\bterm\b|\bword\b|defin|literally|etymolog/i],
        ['shield', /safe|risk|ethic|consent|scope of practice|contraindic|harm|medical|boundar|vulnerab/i],
        ['pulse', /biofeedback|heart|\beeg\b|brain|neuro|breath|nervous|physiolog|somatic|embodi/i],
        ['headset', /\bvr\b|\bar\b|\bxr\b|virtual|headset|immersi|oculus|platform|\bexperience\b/i],
        ['person', /client|person|people|someone|participant|advisor|believer|practitioner|facilitator|user/i],
        ['compass', /design|build|develop|creat|practice|session|plan|integrat/i],
        ['eye', /mind|conscious|psyche|delic|aware|percep|attention|presence/i]
    ];

    function svg(name, cls) {
        var body = P[name] || P.network;
        return '<svg class="li-icon li-' + name + (cls ? ' ' + cls : '') + '" viewBox="0 0 24 24" width="24" height="24" ' +
            'fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" ' +
            'aria-hidden="true" focusable="false">' + body + '</svg>';
    }

    function topic(text, fallback) {
        var plain = String(text || '').replace(/<[^>]*>/g, ' ');
        for (var i = 0; i < TOPICS.length; i++) {
            if (TOPICS[i][1].test(plain)) return TOPICS[i][0];
        }
        return fallback || 'network';
    }

    // Animated header emblem: Academy-gradient orbit, counter-rotating
    // dashed ring and a breathing core with a topic icon inside.
    var uid = 0;
    function emblem(iconName) {
        var g = 'li-grad-' + (++uid);
        return '<span class="li-emblem" aria-hidden="true">' +
            '<svg class="li-emblem-rings" viewBox="0 0 48 48" width="48" height="48" fill="none">' +
            '<defs><linearGradient id="' + g + '" x1="0" y1="0" x2="1" y2="1">' +
            '<stop class="li-stop-a" offset="0"/><stop class="li-stop-b" offset="1"/>' +
            '</linearGradient></defs>' +
            '<g class="li-ring-outer"><circle cx="24" cy="24" r="22" stroke="url(#' + g + ')" stroke-width="1.25" stroke-dasharray="46 10 8 10" stroke-linecap="round"/>' +
            '<circle class="li-orbit-node" cx="24" cy="2" r="1.6"/></g>' +
            '<g class="li-ring-inner"><circle cx="24" cy="24" r="16.5" class="li-ring-dash" stroke-width="1" stroke-dasharray="2 4" opacity="0.7"/></g>' +
            '<circle class="li-core-glow" cx="24" cy="24" r="12"/>' +
            '</svg>' +
            '<span class="li-emblem-icon">' + svg(iconName || 'network') + '</span>' +
            '</span>';
    }

    window.LessonIcons = { svg: svg, topic: topic, emblem: emblem, sigil: function (i) { return svg('sig' + (i % 5)); } };
})();
