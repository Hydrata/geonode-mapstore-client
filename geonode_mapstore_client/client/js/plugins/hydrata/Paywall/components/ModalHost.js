/**
 * ModalHost — the ONE body-level modal host for the paywall/compute-meter
 * surfaces (epic 2425 W2 remediation).
 *
 * WHY IT IS SHARED, AND WHY IT PORTALS
 * ------------------------------------
 * TASK-2435 built this machinery inside ComputeMeterPanel.js as
 * `MeterModalHost` because the compute-meter refusal modal rendered below the
 * fold of a document that cannot scroll. The W2 review then found the paywall
 * upgrade modal had EXACTLY the same defect, one layer up: it is a
 * `position: fixed` overlay nested inside `.paywall-panel`, which carried
 * `position: relative; z-index: 2` — a STACKING CONTEXT. Measured live on the
 * map route at 1408x683, before this change:
 *
 *   .paywall-upgrade-modal-overlay  rect [0,49,1408,599]  computed z-index 100000
 *   document.elementFromPoint(centre) -> DIV.sv-anuga-scenario-pane-section
 *
 * i.e. the scenario pane (z-index 1025) painted OVER a "z-index: 100000"
 * overlay, because that 100000 was resolved inside a rank-2 context. Two
 * independent implementations of "put a dialog on top" produced two different
 * bugs, so there is now one implementation.
 *
 * Escaping the page's stacking/containing blocks needs BOTH halves:
 *   - createPortal(document.body): on the map route
 *     `.msgapi .page-map-viewer .gn-viewer-layout-body { transform: translate(0) }`
 *     is the containing block for `fixed` descendants, and `.gn-page-wrapper`
 *     carries z-index 99999. Anything rendered inside them is trapped.
 *   - z-index 100000 on the host itself (meter.css / paywall.css) — the
 *     codebase ceiling for body-level overlays.
 * `.msgapi` is on <body> itself (templates/index.html), so themePrefix-ed
 * rules still match a body-level portal.
 *
 * DIALOG SEMANTICS (a11y). role="dialog" + aria-modal + aria-labelledby, focus
 * entry on open, Tab/Shift+Tab cycling, document-level Escape, and focus
 * restore on close — the anugaScenarioOverflowMenu.js precedent.
 *
 * DELIBERATELY NOT dismiss-on-backdrop-click (unlike IdfCurveModal, an
 * informational chart): these are refusals and paid-action prompts the
 * customer has to read, and each carries an explicit Cancel/OK. A stray
 * backdrop click silently discarding "you have no balance" is the failure mode
 * this epic exists to remove. The corollary — an un-dismissable dialog is a
 * TRAP — is why every route OUT of a hosted dialog (including "View account")
 * must dismiss it; see ComputeMeterContainer / PaywallPanelContainer.
 */
import React, { useCallback, useLayoutEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
const PropTypes = require('prop-types');

/** Tab-cycle candidates inside an open modal; also the fallback-target filter. */
const FOCUSABLE = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])'
].join(',');

/**
 * THE INVOKER IS ALREADY GONE BY THE TIME WE MOUNT — a W2-review finding.
 *
 * `document.activeElement` at mount is NOT the control the customer pressed on
 * the real Run -> 402 path. scenarioHeaderActions.js's `fireDebounced`
 * disables the Run button SYNCHRONOUSLY on click (`startDebounce`), the
 * browser blurs a disabled element, and the refusal modal only mounts once the
 * server has answered — so activeElement is <body> and "focus returns to the
 * invoking control" was a no-op in production. The existing karma coverage
 * missed it because its synthetic invoker never disables.
 *
 * So the last control the customer ACTUALLY INTERACTED WITH is tracked
 * continuously, from module load — a listener installed at mount would be far
 * too late, the press has already happened by then.
 *
 * `mousedown`/`keydown`, NOT `focusin`, and that choice is load-bearing rather
 * than stylistic. Chrome does not dispatch focus/focusin AT ALL while the
 * document itself is unfocused, even though `.focus()` still moves
 * `document.activeElement` — measured in the full karma suite, where
 * `document.hasFocus()` is false and a focusin-based tracker recorded nothing
 * (the scoped run, whose window did have focus, passed and hid the problem).
 * Input events have no such dependency: mousedown fires before the click
 * handler can disable the button, and keydown covers Space/Enter activation
 * for keyboard users. One CAPTURE listener each (the `true` third argument),
 * one retained reference — capture so the record is taken before any handler
 * downstream can stopPropagation. They are NOT passive: an earlier version of
 * this comment said "passive listener", which is a different flag entirely
 * (`{passive: true}`, a promise not to preventDefault) and was never set here.
 * Neither listener calls preventDefault, so passive would in fact be
 * harmless — but the comment described an option that was not in the code.
 */
let lastInteractedElement = null;
function rememberInteraction(e) {
    const t = e.target;
    if (!t || t.nodeType !== 1 || t === document.body || t === document.documentElement) {
        return;
    }
    // A press often lands on an icon/label INSIDE the control; resolve to the
    // control itself so the restore target is something that can take focus.
    const control = typeof t.closest === 'function' ? t.closest(FOCUSABLE) : null;
    lastInteractedElement = control || t;
}
if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
    document.addEventListener('mousedown', rememberInteraction, true);
    document.addEventListener('keydown', rememberInteraction, true);
}

/** The control to return focus to when a dialog closes. */
function invokingControl() {
    const active = typeof document !== 'undefined' ? document.activeElement : null;
    if (active && active !== document.body && active !== document.documentElement) {
        return active;
    }
    return lastInteractedElement;
}

/**
 * Deterministic fallback when the invoker cannot take focus back — it was
 * disabled on click (the Run case above) or removed from the document.
 * Walks OUT from the invoker to the first ancestor containing any focusable
 * element, so focus lands in the same control cluster the customer was in
 * (for the run cluster: Build-and-Run / Build beside a debounced Run) rather
 * than being dumped on <body>, which is where a keyboard user loses their
 * place entirely.
 *
 * Returns null for a DETACHED invoker: everything around it is detached too,
 * and .focus() on a detached node is a silent no-op, so walking a dead subtree
 * would only find targets that cannot work. `firstFocusableInDocument` below
 * is the fallback for that case.
 */
function nearestFocusable(el) {
    if (!el || !el.parentElement || typeof document === 'undefined') {
        return null;
    }
    if (!document.contains(el)) {
        return null;
    }
    let node = el.parentElement;
    while (node && node !== document.body && node !== document.documentElement) {
        const candidate = node.querySelector(FOCUSABLE);
        if (candidate && candidate !== el) {
            return candidate;
        }
        node = node.parentElement;
    }
    return null;
}

/**
 * Last-resort target: the first focusable element in document order.
 *
 * W2 adversarial finding P1, and an HONEST correction to W2's claim that its
 * MAJOR#5 focus-restore fix was complete. It was complete only for the
 * DISABLED-invoker shape (the meter/Run path, where the button survives in the
 * DOM). For a REMOVED invoker — React swapping a portal out and deleting the
 * control that opened the dialog — invokingControl() returns a detached node,
 * restoreFocus skips it (document.contains is false), nearestFocusable bails,
 * and focus lands on <body>: precisely the outcome the fallback exists to
 * prevent.
 *
 * This is deliberately a "top of document" landing, not a guess at where the
 * customer was — once the invoker is gone there is nothing left to infer from.
 * It is still strictly better than <body>: a real element takes visible focus,
 * assistive tech announces something, and Tab resumes from a known place
 * rather than from nothing.
 */
function firstFocusableInDocument() {
    if (typeof document === 'undefined' || !document.body) {
        return null;
    }
    return document.body.querySelector(FOCUSABLE);
}

function restoreFocus(previous) {
    if (typeof document === 'undefined') {
        return;
    }
    if (previous && typeof previous.focus === 'function' && document.contains(previous)) {
        previous.focus();
        // A disabled element silently swallows .focus() — verify rather than
        // assume, which is precisely what the shipped implementation did not do.
        if (document.activeElement === previous) {
            return;
        }
    }
    const fallback = nearestFocusable(previous) || firstFocusableInDocument();
    if (fallback && typeof fallback.focus === 'function') {
        fallback.focus();
    }
}

/**
 * OPEN-HOST STACK (W2 adversarial finding R3, epic 2425 W2.5).
 *
 * PaywallAndMeterRoot renders PaywallPanelContainer and ComputeMeterContainer
 * as SIBLINGS, and `paywall.overlay === 'upgrade_prompt'` and
 * `computeMeter.modal !== null` are independent Redux slices — so two hosts
 * can be live at once. Each installed its own document-level keydown listener,
 * and on Tab BOTH fired: each preventDefault()ed and pulled focus to its own
 * first item, so every Tab press reset focus and the user could not cycle at
 * all. (Escape was unaffected — it exited both, which is fine.)
 *
 * Mount order, last === topmost. Only the topmost host handles Tab.
 *
 * ESCAPE IS DELIBERATELY LEFT UNGATED: with two dialogs open, one Escape
 * dismissing both is the safe direction — the failure mode this epic exists to
 * remove is a customer trapped behind a dialog, not one that closes too
 * eagerly. Gate Tab, which is broken; do not "fix" Escape, which is not.
 */
const openHosts = [];

/** Test seam — lets a test assert the stack does not leak across mounts. */
export const __openHostCount = () => openHosts.length;

/**
 * @param {node}   children   the dialog content (its own overlay/backdrop)
 * @param {func}   onDismiss  called on Escape
 * @param {string} testId     data-testid for the host element
 * @param {string} className  host className (its stylesheet supplies the fixed
 *                            full-viewport layer + z-index 100000)
 * @param {string} titleId    id of the heading that names the dialog
 */
function ModalHost({ children, onDismiss, testId, className, titleId }) {
    const hostRef = useRef(null);
    const previouslyFocusedRef = useRef(null);
    // The keydown listener is attached ONCE (mount) and must not be re-bound on
    // every render, but it still has to call the CURRENT onDismiss — hence a
    // ref rather than putting onDismiss in the effect's dependency list, which
    // would tear down and re-attach the listener (and re-run the focus-entry
    // logic) on every parent render.
    const onDismissRef = useRef(onDismiss);
    onDismissRef.current = onDismiss;

    const focusable = useCallback(() => {
        if (!hostRef.current) {
            return [];
        }
        return Array.prototype.slice.call(hostRef.current.querySelectorAll(FOCUSABLE));
    }, []);

    // useLayoutEffect, not useEffect, for the same synchronous-attach reason
    // anugaScenarioOverflowMenu.js documents: the handlers must be live before
    // the browser can deliver an Escape to the newly painted dialog.
    //
    // The listeners go on `document`, NOT on the host via onKeyDown, and that
    // is load-bearing. The backdrop is deliberately not dismiss-on-click, so a
    // customer who clicks it moves focus to <body> — outside the host. A
    // host-bound onKeyDown would then never see Escape again, leaving the
    // dialog un-closable by keyboard.
    useLayoutEffect(() => {
        previouslyFocusedRef.current = invokingControl();
        // R3 — identity token for this mount. An object rather than the DOM
        // node or the ref: hostRef.current is null at this point on some paths,
        // and a token cannot be confused with another host's node.
        const token = {};
        openHosts.push(token);
        const isTopmost = () => openHosts[openHosts.length - 1] === token;

        const items = focusable();
        if (items.length > 0) {
            items[0].focus();
        } else if (hostRef.current) {
            hostRef.current.focus();
        }

        const handleKeyDown = (e) => {
            if (e.key === 'Escape' || e.keyCode === 27) {
                // Intentionally NOT gated on isTopmost — see the openHosts
                // docstring. Escape closing every open dialog is the safe
                // direction; a trapped customer is the failure mode that matters.
                e.stopPropagation();
                onDismissRef.current();
                return;
            }
            if (e.key !== 'Tab' && e.keyCode !== 9) {
                return;
            }
            // R3 — only the topmost dialog cycles. Without this, two live hosts
            // each preventDefault and each pull focus to their own first item,
            // so Tab resets forever instead of cycling.
            if (!isTopmost()) {
                return;
            }
            const focusables = focusable();
            if (focusables.length === 0) {
                e.preventDefault();
                return;
            }
            const first = focusables[0];
            const last = focusables[focusables.length - 1];
            const host = hostRef.current;
            // Focus has escaped the dialog entirely (backdrop click) — pull it
            // back in rather than letting Tab walk into the map behind.
            if (host && !host.contains(document.activeElement)) {
                e.preventDefault();
                first.focus();
                return;
            }
            // Wrap at both ends so Tab can never walk out into the map behind.
            if (e.shiftKey && document.activeElement === first) {
                e.preventDefault();
                last.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault();
                first.focus();
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            const at = openHosts.indexOf(token);
            if (at !== -1) {
                openHosts.splice(at, 1);
            }
            restoreFocus(previouslyFocusedRef.current);
            previouslyFocusedRef.current = null;
        };
    }, [focusable]);

    if (typeof document === 'undefined') {
        return null;
    }

    return ReactDOM.createPortal(
        <div
            ref={hostRef}
            data-testid={testId}
            className={className}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            tabIndex={-1}
        >
            {children}
        </div>,
        document.body
    );
}

ModalHost.propTypes = {
    children: PropTypes.node,
    onDismiss: PropTypes.func,
    testId: PropTypes.string.isRequired,
    className: PropTypes.string.isRequired,
    titleId: PropTypes.string.isRequired
};

ModalHost.defaultProps = {
    onDismiss: () => {}
};

export default ModalHost;
