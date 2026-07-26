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
 * @param {node}   children   the dialog content (its own overlay/backdrop)
 * @param {func}   onDismiss  called on Escape
 * @param {string} testId     data-testid for the host element
 * @param {string} className  host className (its stylesheet supplies the fixed
 *                            full-viewport layer + z-index 100000)
 * @param {string} titleId    id of the heading that names the dialog
 */
function ModalHost({ children, onDismiss, testId, className, titleId }) {
    const hostRef = useRef(null);
    // Captured synchronously at mount, restored at unmount — the "returns to
    // the invoking control" half of TASK-2435 AC#2. There is no in-DOM trigger
    // for these dialogs (they arrive as Redux actions from a refused Run
    // dispatch or a 402 visibility PATCH), so the invoking control is whatever
    // had focus when the refusal landed.
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
        previouslyFocusedRef.current = document.activeElement;
        const items = focusable();
        if (items.length > 0) {
            items[0].focus();
        } else if (hostRef.current) {
            hostRef.current.focus();
        }

        const handleKeyDown = (e) => {
            if (e.key === 'Escape' || e.keyCode === 27) {
                e.stopPropagation();
                onDismissRef.current();
                return;
            }
            if (e.key !== 'Tab' && e.keyCode !== 9) {
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
            const previous = previouslyFocusedRef.current;
            // Only restore if the invoking control is still in the document
            // and still focusable — otherwise leave focus where the browser
            // put it rather than throwing it to <body>.
            if (previous && typeof previous.focus === 'function' && document.contains(previous)) {
                previous.focus();
            }
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
