import React, {useState, useRef, useLayoutEffect, useCallback} from "react";
const PropTypes = require('prop-types');
import ReactDOM from "react-dom";
import Message from '@mapstore/framework/components/I18N/Message';
import {getMessageById} from '@mapstore/framework/utils/LocaleUtils';
import {trackEvent} from "@js/utils/analytics";

/**
 * TASK-2240 (epic 2237 W1.2) — a small CUSTOM, portaled overflow menu for the
 * scenario-scoped bulk actions (New scenario / Duplicate / Archive-Restore /
 * Delete), triggered by a kebab (⋮) in the Scenarios section header.
 *
 * Amendment A3 (binding) — react-bootstrap 0.31 Dropdown/MenuItem is
 * FORBIDDEN here: its DropdownMenu clips inside the
 * `.sv-menu-rows-container` overflow chain (simpleView.css:429), and
 * MenuItem puts the className on the <li> while onClick lives on the inner
 * <a>, which breaks the analytics-parity suite's click-target assumption
 * (every legacy classname + Umami label must live ON THE CLICKABLE
 * element). This component uses plain <button role="menuitem"> elements —
 * class, disabled state, and onClick all live on the SAME node — and
 * portals the open menu straight to `document.body` (via
 * `ReactDOM.createPortal`) with `position: fixed` coordinates derived from
 * the trigger's `getBoundingClientRect()`, so it always escapes the
 * scrollable rows-container ancestor instead of being clipped inside it.
 *
 * Scenario-INDEPENDENT rendering (acceptance #4): the kebab trigger itself
 * is gated ONLY on `canCreateScenario` (mirrors the pre-2240 New Scenario
 * button's own gate) — it is NOT hidden just because no scenario is
 * selected. Every scenario-SCOPED item (Duplicate / Archive-Restore /
 * Delete) instead renders always-present but `disabled` when there is no
 * selected scenario, so "New scenario" survives the empty-project case.
 *
 * Keyboard: Enter/Space on the trigger toggles the menu; ArrowDown while
 * closed opens it. Once open, ArrowUp/ArrowDown rove focus between items
 * (wrapping), Home/End jump to the first/last item, and Escape closes the
 * menu and returns focus to the trigger. A document-level mousedown
 * listener closes the menu on any outside click while it is open.
 *
 * Umami analytics: labels fire from the SAME handler this component's
 * predecessor used (scenarioHeaderActions.js's Archive/Unarchive/Delete
 * blocks, pre-2240) — byte-identical label strings, now fired from this
 * component's <button> onClick instead. New Scenario's label already fires
 * inside the container's `onNewScenario` handler (unchanged) so it is not
 * re-fired here.
 */
const AnugaScenarioOverflowMenu = (props, context) => {
    const {
        canCreateScenario,
        scenario,
        canEdit,
        inFlight,
        onNewScenario,
        onDuplicateClick,
        onArchiveClick,
        onUnarchiveClick,
        onDeleteClick
    } = props;

    const [open, setOpen] = useState(false);
    const triggerRef = useRef(null);
    const menuRef = useRef(null);
    const itemRefs = useRef([]);

    const tr = (msgId, fallback) => {
        const messages = (context && context.messages) || {};
        const resolved = getMessageById(messages, msgId);
        return resolved === msgId ? fallback : resolved;
    };

    const close = useCallback(() => setOpen(false), []);

    const focusTrigger = () => {
        if (triggerRef.current && typeof triggerRef.current.focus === 'function') {
            triggerRef.current.focus();
        }
    };

    // Outside-click + Escape close the menu while it is open. Attached only
    // while open (removed on close/unmount) so this never leaks a listener.
    // useLayoutEffect (not useEffect) — must attach synchronously in the
    // SAME flush as the open-state re-render so a synchronous test (or a
    // real fast double-keystroke) can never dispatch Escape/an outside
    // click into a window where the listener isn't registered yet.
    useLayoutEffect(() => {
        // Every path returns a cleanup FUNCTION (a no-op when closed) — single
        // return "shape" keeps eslint's consistent-return happy (same idiom as
        // terrainUploadCrsPanel.js's _resolveCrsOverride) while still matching
        // exactly what useLayoutEffect expects.
        if (!open) {
            return () => {};
        }
        const handleDocMouseDown = (e) => {
            const target = e.target;
            if (menuRef.current && menuRef.current.contains(target)) return;
            if (triggerRef.current && triggerRef.current.contains(target)) return;
            close();
        };
        const handleDocKeyDown = (e) => {
            if (e.key === 'Escape' || e.keyCode === 27) {
                close();
                focusTrigger();
            }
        };
        document.addEventListener('mousedown', handleDocMouseDown);
        document.addEventListener('keydown', handleDocKeyDown);
        return () => {
            document.removeEventListener('mousedown', handleDocMouseDown);
            document.removeEventListener('keydown', handleDocKeyDown);
        };
    }, [open, close]);

    // Move initial focus onto the first (non-disabled-aware — roving focus
    // still lands on it; activating a disabled item is a no-op) menu item
    // the moment the menu opens, so keyboard users don't have to Tab in.
    // useLayoutEffect for the same synchronous-flush reason as above.
    useLayoutEffect(() => {
        if (open && itemRefs.current[0]) {
            itemRefs.current[0].focus();
        }
    }, [open]);

    const toggle = () => setOpen((prev) => !prev);

    const handleTriggerKeyDown = (e) => {
        if (e.key === 'Enter' || e.key === ' ' || e.keyCode === 13 || e.keyCode === 32) {
            e.preventDefault();
            toggle();
        } else if (e.key === 'ArrowDown' || e.keyCode === 40) {
            e.preventDefault();
            setOpen(true);
        }
    };

    const focusableItems = () => itemRefs.current.filter(Boolean);

    const moveFocus = (currentIndex, delta) => {
        const items = focusableItems();
        if (items.length === 0) return;
        const next = (currentIndex + delta + items.length) % items.length;
        items[next].focus();
    };

    const handleItemKeyDown = (index) => (e) => {
        if (e.key === 'ArrowDown' || e.keyCode === 40) {
            e.preventDefault();
            moveFocus(index, 1);
        } else if (e.key === 'ArrowUp' || e.keyCode === 38) {
            e.preventDefault();
            moveFocus(index, -1);
        } else if (e.key === 'Home') {
            e.preventDefault();
            const items = focusableItems();
            if (items[0]) items[0].focus();
        } else if (e.key === 'End') {
            e.preventDefault();
            const items = focusableItems();
            if (items.length) items[items.length - 1].focus();
        } else if (e.key === 'Escape' || e.keyCode === 27) {
            close();
            focusTrigger();
        }
    };

    // Scenario-INDEPENDENT (acceptance #4): the kebab itself only requires
    // create permission — never hidden by scenario selection.
    if (!canCreateScenario) return null;

    const hasSelected = !!(scenario && scenario.id);
    const isArchived = !!(scenario && scenario.archived_at);
    const canDuplicateNow = hasSelected;
    const canArchiveNow = hasSelected && canEdit && !inFlight;
    const canDeleteNow = hasSelected && canEdit && !inFlight;
    const archiveBlockedByRun = hasSelected && canEdit && !!inFlight;

    let refIndex = -1;
    const nextRef = () => {
        refIndex += 1;
        const capturedIndex = refIndex;
        return (el) => { itemRefs.current[capturedIndex] = el; };
    };

    const fireLabel = (label) => trackEvent('button', 'click', label);

    const menuStyle = (() => {
        if (!triggerRef.current || typeof triggerRef.current.getBoundingClientRect !== 'function') {
            return {position: 'fixed', top: 0, left: 0, zIndex: 100000};
        }
        const rect = triggerRef.current.getBoundingClientRect();
        return {
            position: 'fixed',
            top: rect.bottom + 4,
            left: Math.max(rect.right - 180, 4),
            zIndex: 100000
        };
    })();

    itemRefs.current = [];

    return (
        <span className="sv-anuga-scenario-overflow">
            <button
                type="button"
                ref={triggerRef}
                className={"sv-anuga-btn sv-anuga-scenario-overflow-trigger" + (open ? ' is-open' : '')}
                aria-haspopup="true"
                aria-expanded={open}
                aria-label={tr('hydrata.anuga.scenarioMenuAriaLabel', 'Scenario actions menu')}
                onClick={toggle}
                onKeyDown={handleTriggerKeyDown}
            >
                <span aria-hidden="true">&#8942;</span>
            </button>
            {open ? ReactDOM.createPortal(
                <span
                    ref={menuRef}
                    role="menu"
                    aria-label={tr('hydrata.anuga.scenarioMenuAriaLabel', 'Scenario actions menu')}
                    className="sv-anuga-scenario-overflow-menu"
                    style={menuStyle}
                >
                    <button
                        type="button"
                        role="menuitem"
                        ref={nextRef()}
                        className="sv-anuga-scenario-overflow-item sv-anuga-scenario-overflow-new"
                        onKeyDown={handleItemKeyDown(refIndex)}
                        onClick={() => {
                            close();
                            focusTrigger();
                            if (onNewScenario) onNewScenario();
                        }}
                    >
                        <Message msgId="hydrata.anuga.newScenario" />
                    </button>
                    <button
                        type="button"
                        role="menuitem"
                        disabled={!canDuplicateNow}
                        ref={nextRef()}
                        title={canDuplicateNow
                            ? tr('hydrata.anuga.duplicateSelectedTooltip', 'Duplicate the selected scenario')
                            : tr('hydrata.anuga.duplicateDisabledTooltip', 'Select a saved scenario to duplicate')}
                        className={"sv-anuga-scenario-overflow-item sv-anuga-scenario-overflow-duplicate"
                            + (!canDuplicateNow ? ' disabled' : '')}
                        onKeyDown={handleItemKeyDown(refIndex)}
                        onClick={() => {
                            if (!canDuplicateNow) return;
                            close();
                            focusTrigger();
                            if (onDuplicateClick) onDuplicateClick(scenario);
                        }}
                    >
                        <Message msgId="hydrata.anuga.btnDuplicate" />
                    </button>
                    <button
                        type="button"
                        role="menuitem"
                        disabled={!canArchiveNow}
                        title={archiveBlockedByRun
                            ? tr('hydrata.anuga.archiveDisabledWhileRunning',
                                'Cannot archive while a run is in progress. Cancel the run first.')
                            : undefined}
                        ref={nextRef()}
                        className={"sv-anuga-scenario-overflow-item "
                            + (isArchived ? 'sv-anuga-scenario-overflow-unarchive' : 'sv-anuga-scenario-overflow-archive')
                            + (!canArchiveNow ? ' disabled' : '')}
                        onKeyDown={handleItemKeyDown(refIndex)}
                        onClick={() => {
                            if (!canArchiveNow) return;
                            close();
                            focusTrigger();
                            if (isArchived) {
                                if (onUnarchiveClick) onUnarchiveClick(scenario);
                                fireLabel('anuga-scenario-menu-unarchive-scenario');
                            } else {
                                if (onArchiveClick) onArchiveClick(scenario);
                                fireLabel('anuga-scenario-menu-archive-scenario');
                            }
                        }}
                    >
                        <Message msgId={isArchived ? 'hydrata.anuga.btnRestore' : 'hydrata.anuga.btnArchive'} />
                    </button>
                    <button
                        type="button"
                        role="menuitem"
                        disabled={!canDeleteNow}
                        title={archiveBlockedByRun
                            ? tr('hydrata.anuga.deleteDisabledWhileRunning',
                                'Cannot delete while a run is in progress. Cancel the run first.')
                            : undefined}
                        ref={nextRef()}
                        className={"sv-anuga-btn-delete sv-anuga-scenario-overflow-item sv-anuga-scenario-overflow-delete"
                            + (!canDeleteNow ? ' disabled' : '')}
                        onKeyDown={handleItemKeyDown(refIndex)}
                        onClick={() => {
                            if (!canDeleteNow) return;
                            close();
                            focusTrigger();
                            if (onDeleteClick) onDeleteClick(scenario);
                            fireLabel('anuga-scenario-menu-delete-scenario');
                        }}
                    >
                        <Message msgId="hydrata.anuga.btnDelete" />
                    </button>
                </span>,
                document.body
            ) : null}
        </span>
    );
};

AnugaScenarioOverflowMenu.propTypes = {
    canCreateScenario: PropTypes.bool,
    scenario: PropTypes.object,
    canEdit: PropTypes.bool,
    inFlight: PropTypes.bool,
    onNewScenario: PropTypes.func,
    onDuplicateClick: PropTypes.func,
    onArchiveClick: PropTypes.func,
    onUnarchiveClick: PropTypes.func,
    onDeleteClick: PropTypes.func
};

AnugaScenarioOverflowMenu.defaultProps = {
    canCreateScenario: false,
    canEdit: false,
    inFlight: false
};

AnugaScenarioOverflowMenu.contextTypes = {
    messages: PropTypes.object
};

export {AnugaScenarioOverflowMenu};
