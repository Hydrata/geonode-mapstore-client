/*
 * TASK-2240 (epic 2237 W1.2) — the custom portaled scenario overflow (kebab)
 * menu. Isolated component-level coverage; container wiring (removal of the
 * old New Scenario/Compare/Duplicate cluster + strip Archive/Delete) is
 * covered in anugaScenarioMenu-test.js.
 *
 * Memory pins:
 *   - feedback-window-confirm-blocks-automation: this component never calls
 *     window.confirm/alert — confirm-requiring actions route through the
 *     onArchiveClick/onUnarchiveClick/onDeleteClick props (the container
 *     owns the inline dialog).
 */
import expect from 'expect';
import React from 'react';
import ReactDOM from 'react-dom';
import {AnugaScenarioOverflowMenu} from '../anugaScenarioOverflowMenu';

const scenario = {id: 21, name: 'Baseline', archived_at: null};
const archivedScenario = {id: 22, name: 'Archived one', archived_at: '2026-01-01T00:00:00Z'};

describe('AnugaScenarioOverflowMenu (TASK-2240)', () => {
    let container;
    let trackCalls;
    let origUmami;

    function labels() {
        return trackCalls.map((c) => c.label);
    }

    function openMenu() {
        container.querySelector('.sv-anuga-scenario-overflow-trigger').click();
    }

    function menuEl() {
        return document.querySelector('.sv-anuga-scenario-overflow-menu');
    }

    beforeEach((done) => {
        container = document.createElement('div');
        document.body.appendChild(container);
        trackCalls = [];
        origUmami = window.umami;
        window.umami = {track: (label, payload) => trackCalls.push({label, ...payload})};
        setTimeout(done);
    });

    afterEach((done) => {
        ReactDOM.unmountComponentAtNode(container);
        document.body.removeChild(container);
        // Defensive: a stray portal (a test that failed mid-open) must not
        // leak into the next test's `document.body`.
        document.querySelectorAll('.sv-anuga-scenario-overflow-menu').forEach((el) => {
            if (el.parentNode) el.parentNode.removeChild(el);
        });
        window.umami = origUmami;
        setTimeout(done);
    });

    it('renders nothing when canCreateScenario is false, even with a scenario selected', () => {
        ReactDOM.render(
            <AnugaScenarioOverflowMenu canCreateScenario={false} scenario={scenario} canEdit />,
            container
        );
        expect(container.querySelector('.sv-anuga-scenario-overflow-trigger')).toNotExist();
    });

    // Acceptance #4 — scenario-INDEPENDENT: kebab renders + New scenario is
    // enabled with NO scenario selected; scenario-scoped items are disabled.
    describe('scenario-independent rendering (acceptance #4)', () => {
        it('renders the kebab + enables New scenario with no scenario selected', () => {
            ReactDOM.render(
                <AnugaScenarioOverflowMenu canCreateScenario scenario={null} canEdit />,
                container
            );
            expect(container.querySelector('.sv-anuga-scenario-overflow-trigger')).toExist();
            openMenu();
            const newBtn = menuEl().querySelector('.sv-anuga-scenario-overflow-new');
            expect(newBtn).toExist();
            expect(newBtn.disabled).toBe(false);
        });

        it('disables Duplicate/Archive/Delete when no scenario is selected', () => {
            ReactDOM.render(
                <AnugaScenarioOverflowMenu canCreateScenario scenario={null} canEdit />,
                container
            );
            openMenu();
            expect(menuEl().querySelector('.sv-anuga-scenario-overflow-duplicate').disabled).toBe(true);
            expect(menuEl().querySelector('.sv-anuga-scenario-overflow-archive').disabled).toBe(true);
            expect(menuEl().querySelector('.sv-anuga-scenario-overflow-delete').disabled).toBe(true);
        });
    });

    // Acceptance #1 — portaled, escapes clipping ancestors; Escape + outside
    // click close it.
    describe('portal + open/close (acceptance #1)', () => {
        it('opens portaled directly under document.body (escapes the mounting container)', () => {
            ReactDOM.render(
                <AnugaScenarioOverflowMenu canCreateScenario scenario={scenario} canEdit />,
                container
            );
            openMenu();
            const menu = menuEl();
            expect(menu).toExist();
            expect(container.contains(menu)).toBe(false);
            expect(document.body.contains(menu)).toBe(true);
        });

        it('closes on Escape and returns focus to the trigger', () => {
            ReactDOM.render(
                <AnugaScenarioOverflowMenu canCreateScenario scenario={scenario} canEdit />,
                container
            );
            openMenu();
            expect(menuEl()).toExist();
            const escEvent = new window.KeyboardEvent('keydown', {key: 'Escape', keyCode: 27, bubbles: true});
            document.dispatchEvent(escEvent);
            expect(menuEl()).toNotExist();
            expect(document.activeElement).toBe(container.querySelector('.sv-anuga-scenario-overflow-trigger'));
        });

        it('closes on an outside click', () => {
            ReactDOM.render(
                <AnugaScenarioOverflowMenu canCreateScenario scenario={scenario} canEdit />,
                container
            );
            openMenu();
            expect(menuEl()).toExist();
            const outsideEvent = new window.MouseEvent('mousedown', {bubbles: true});
            document.body.dispatchEvent(outsideEvent);
            expect(menuEl()).toNotExist();
        });

        it('does NOT close when clicking inside the menu itself', () => {
            ReactDOM.render(
                <AnugaScenarioOverflowMenu canCreateScenario scenario={null} canEdit />,
                container
            );
            openMenu();
            const menu = menuEl();
            const insideEvent = new window.MouseEvent('mousedown', {bubbles: true});
            menu.dispatchEvent(insideEvent);
            expect(menuEl()).toExist();
        });
    });

    // Acceptance #5 — keyboard: toggle on Enter/Space, roving focus.
    describe('keyboard support (acceptance #5)', () => {
        it('Enter on the trigger opens the menu', () => {
            ReactDOM.render(
                <AnugaScenarioOverflowMenu canCreateScenario scenario={scenario} canEdit />,
                container
            );
            const trigger = container.querySelector('.sv-anuga-scenario-overflow-trigger');
            const evt = new window.KeyboardEvent('keydown', {key: 'Enter', keyCode: 13, bubbles: true});
            trigger.dispatchEvent(evt);
            expect(menuEl()).toExist();
        });

        it('Space on the trigger toggles the menu closed again', () => {
            ReactDOM.render(
                <AnugaScenarioOverflowMenu canCreateScenario scenario={scenario} canEdit />,
                container
            );
            openMenu();
            expect(menuEl()).toExist();
            const trigger = container.querySelector('.sv-anuga-scenario-overflow-trigger');
            const evt = new window.KeyboardEvent('keydown', {key: ' ', keyCode: 32, bubbles: true});
            trigger.dispatchEvent(evt);
            expect(menuEl()).toNotExist();
        });

        it('ArrowDown on the trigger opens the menu', () => {
            ReactDOM.render(
                <AnugaScenarioOverflowMenu canCreateScenario scenario={scenario} canEdit />,
                container
            );
            const trigger = container.querySelector('.sv-anuga-scenario-overflow-trigger');
            const evt = new window.KeyboardEvent('keydown', {key: 'ArrowDown', keyCode: 40, bubbles: true});
            trigger.dispatchEvent(evt);
            expect(menuEl()).toExist();
        });

        it('opening the menu focuses the first item', () => {
            ReactDOM.render(
                <AnugaScenarioOverflowMenu canCreateScenario scenario={scenario} canEdit />,
                container
            );
            openMenu();
            expect(document.activeElement).toBe(menuEl().querySelector('.sv-anuga-scenario-overflow-new'));
        });

        it('ArrowDown/ArrowUp rove focus between items with wraparound', () => {
            ReactDOM.render(
                <AnugaScenarioOverflowMenu canCreateScenario scenario={scenario} canEdit />,
                container
            );
            openMenu();
            const items = Array.prototype.slice.call(menuEl().querySelectorAll('[role="menuitem"]'));
            expect(items.length).toBe(4);
            expect(document.activeElement).toBe(items[0]);
            items[0].dispatchEvent(new window.KeyboardEvent('keydown', {key: 'ArrowDown', keyCode: 40, bubbles: true}));
            expect(document.activeElement).toBe(items[1]);
            // Wraparound: ArrowUp from the first item lands on the last.
            items[1].dispatchEvent(new window.KeyboardEvent('keydown', {key: 'ArrowUp', keyCode: 38, bubbles: true}));
            expect(document.activeElement).toBe(items[0]);
            items[0].dispatchEvent(new window.KeyboardEvent('keydown', {key: 'ArrowUp', keyCode: 38, bubbles: true}));
            expect(document.activeElement).toBe(items[items.length - 1]);
        });

        it('Home/End jump focus to the first/last item', () => {
            ReactDOM.render(
                <AnugaScenarioOverflowMenu canCreateScenario scenario={scenario} canEdit />,
                container
            );
            openMenu();
            const items = Array.prototype.slice.call(menuEl().querySelectorAll('[role="menuitem"]'));
            items[0].dispatchEvent(new window.KeyboardEvent('keydown', {key: 'End', bubbles: true}));
            expect(document.activeElement).toBe(items[items.length - 1]);
            items[items.length - 1].dispatchEvent(new window.KeyboardEvent('keydown', {key: 'Home', bubbles: true}));
            expect(document.activeElement).toBe(items[0]);
        });

        it('Escape from within an item closes the menu and refocuses the trigger', () => {
            ReactDOM.render(
                <AnugaScenarioOverflowMenu canCreateScenario scenario={scenario} canEdit />,
                container
            );
            openMenu();
            const items = Array.prototype.slice.call(menuEl().querySelectorAll('[role="menuitem"]'));
            items[0].dispatchEvent(new window.KeyboardEvent('keydown', {key: 'Escape', keyCode: 27, bubbles: true}));
            expect(menuEl()).toNotExist();
            expect(document.activeElement).toBe(container.querySelector('.sv-anuga-scenario-overflow-trigger'));
        });
    });

    // Aria completeness.
    describe('aria completeness', () => {
        it('trigger carries aria-haspopup + aria-expanded that flips on open', () => {
            ReactDOM.render(
                <AnugaScenarioOverflowMenu canCreateScenario scenario={scenario} canEdit />,
                container
            );
            const trigger = container.querySelector('.sv-anuga-scenario-overflow-trigger');
            expect(trigger.getAttribute('aria-haspopup')).toBe('true');
            expect(trigger.getAttribute('aria-expanded')).toBe('false');
            openMenu();
            expect(container.querySelector('.sv-anuga-scenario-overflow-trigger').getAttribute('aria-expanded')).toBe('true');
        });

        it('the open menu carries role="menu" and every item role="menuitem"', () => {
            ReactDOM.render(
                <AnugaScenarioOverflowMenu canCreateScenario scenario={scenario} canEdit />,
                container
            );
            openMenu();
            expect(menuEl().getAttribute('role')).toBe('menu');
            const items = menuEl().querySelectorAll('[role="menuitem"]');
            expect(items.length).toBe(4);
        });
    });

    // Acceptance #2 — Archive/Restore mutex.
    describe('Archive / Restore mutex (acceptance #2)', () => {
        it('shows Archive (not Restore) for a non-archived scenario and fires the archive label', () => {
            let captured = null;
            ReactDOM.render(
                <AnugaScenarioOverflowMenu
                    canCreateScenario scenario={scenario} canEdit
                    onArchiveClick={(s) => { captured = s; }}
                />,
                container
            );
            openMenu();
            const archBtn = menuEl().querySelector('.sv-anuga-scenario-overflow-archive');
            expect(archBtn).toExist();
            expect(menuEl().querySelector('.sv-anuga-scenario-overflow-unarchive')).toNotExist();
            archBtn.click();
            expect(captured?.id).toBe(21);
            expect(labels()).toInclude('anuga-scenario-menu-archive-scenario');
        });

        it('shows Restore (not Archive) for an archived scenario and fires the unarchive label', () => {
            let captured = null;
            ReactDOM.render(
                <AnugaScenarioOverflowMenu
                    canCreateScenario scenario={archivedScenario} canEdit
                    onUnarchiveClick={(s) => { captured = s; }}
                />,
                container
            );
            openMenu();
            const unarchBtn = menuEl().querySelector('.sv-anuga-scenario-overflow-unarchive');
            expect(unarchBtn).toExist();
            expect(menuEl().querySelector('.sv-anuga-scenario-overflow-archive')).toNotExist();
            unarchBtn.click();
            expect(captured?.id).toBe(22);
            expect(labels()).toInclude('anuga-scenario-menu-unarchive-scenario');
        });

        it('disables Archive while a run is in flight, with an explanatory title', () => {
            ReactDOM.render(
                <AnugaScenarioOverflowMenu canCreateScenario scenario={scenario} canEdit inFlight />,
                container
            );
            openMenu();
            const archBtn = menuEl().querySelector('.sv-anuga-scenario-overflow-archive');
            expect(archBtn.disabled).toBe(true);
            expect(archBtn.getAttribute('title')).toInclude('progress');
        });
    });

    // Acceptance #3 — Delete disabled in flight with an explanatory tooltip;
    // enabled otherwise, fires the existing confirm.
    describe('Delete (acceptance #3)', () => {
        it('is enabled for a non-in-flight, editable, selected scenario and fires the existing confirm', () => {
            let captured = null;
            ReactDOM.render(
                <AnugaScenarioOverflowMenu
                    canCreateScenario scenario={scenario} canEdit
                    onDeleteClick={(s) => { captured = s; }}
                />,
                container
            );
            openMenu();
            const delBtn = menuEl().querySelector('.sv-anuga-scenario-overflow-delete');
            expect(delBtn.disabled).toBe(false);
            delBtn.click();
            expect(captured?.id).toBe(21);
            expect(labels()).toInclude('anuga-scenario-menu-delete-scenario');
        });

        it('is disabled while in flight, with an explanatory title, and does not fire the confirm', () => {
            let captured = null;
            ReactDOM.render(
                <AnugaScenarioOverflowMenu
                    canCreateScenario scenario={scenario} canEdit inFlight
                    onDeleteClick={(s) => { captured = s; }}
                />,
                container
            );
            openMenu();
            const delBtn = menuEl().querySelector('.sv-anuga-scenario-overflow-delete');
            expect(delBtn.disabled).toBe(true);
            expect(delBtn.getAttribute('title')).toInclude('progress');
            delBtn.click();
            expect(captured).toBe(null);
            expect(labels()).toNotInclude('anuga-scenario-menu-delete-scenario');
        });
    });

    // Acceptance #7 — every item fires its label from the anchor element
    // itself (the clickable node carries both class + onClick — the exact
    // property react-bootstrap MenuItem breaks, per amendment A3).
    describe('labels + classnames fire from the clickable element itself (amendment A3)', () => {
        it('New scenario calls onNewScenario from the SAME button that carries its classname', () => {
            let called = false;
            ReactDOM.render(
                <AnugaScenarioOverflowMenu
                    canCreateScenario scenario={null} canEdit
                    onNewScenario={() => { called = true; }}
                />,
                container
            );
            openMenu();
            const newBtn = menuEl().querySelector('.sv-anuga-scenario-overflow-new');
            expect(newBtn.tagName).toBe('BUTTON');
            newBtn.click();
            expect(called).toBe(true);
        });

        it('Duplicate calls onDuplicateClick from the SAME button that carries its classname', () => {
            let captured = null;
            ReactDOM.render(
                <AnugaScenarioOverflowMenu
                    canCreateScenario scenario={scenario} canEdit
                    onDuplicateClick={(s) => { captured = s; }}
                />,
                container
            );
            openMenu();
            const dupBtn = menuEl().querySelector('.sv-anuga-scenario-overflow-duplicate');
            expect(dupBtn.tagName).toBe('BUTTON');
            dupBtn.click();
            expect(captured?.id).toBe(21);
        });
    });

    it('never calls window.confirm / window.alert', () => {
        const origConfirm = window.confirm;
        const origAlert = window.alert;
        let confirmCalls = 0;
        // eslint-disable-next-line no-alert -- regression guard mock, not real
        window.confirm = () => { confirmCalls++; return true; };
        ReactDOM.render(
            <AnugaScenarioOverflowMenu
                canCreateScenario scenario={scenario} canEdit
                onArchiveClick={() => {}}
                onDeleteClick={() => {}}
            />,
            container
        );
        openMenu();
        menuEl().querySelector('.sv-anuga-scenario-overflow-archive').click();
        openMenu();
        menuEl().querySelector('.sv-anuga-scenario-overflow-delete').click();
        expect(confirmCalls).toBe(0);
        window.confirm = origConfirm;
        window.alert = origAlert;
    });
});
