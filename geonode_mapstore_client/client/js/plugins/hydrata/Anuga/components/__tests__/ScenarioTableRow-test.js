/*
 * V2P-22 — ScenarioTableRow regression for canEditScenarioByRole.
 *
 * The spec says: "ScenarioTableRow.js — already imports helpers (V2P-02), wire
 * them into existing role checks", and "consume helpers without rewriting
 * canEditScenarioByRole's stable contract" (TASK-61). Per spec V2P-22 line
 * 596 the row was already V2P-02 wired; this test pins the per-role
 * exact-button-set so future refactors can't quietly degrade it.
 *
 * The row owns a tab-driven button matrix:
 *   - "Build" button (canEdit-gated, manage tab)
 *   - "Run/Retry" button (canRunScenario-gated, status-dependent — covered
 *     by anugaScenarioMenu tests and not re-asserted here)
 *   - "Log" button (always present when manage tab on)
 *   - Delete button (visible when canCancelRun || canDeleteScenario; both
 *     reduce to canEdit for non-cancellable status)
 *   - Compare-toggle glyph (compare tab, always present)
 *
 * canEditScenarioByRole rules (TASK-61, stable):
 *   owner / manager / editor : true (regardless of scenario.created_by)
 *   contributor              : true ONLY if currentUserId === scenario.created_by
 *   viewer                   : false
 *   anon (myRole=null)       : false
 *
 * For this test we use scenarioOwnerId = currentUserId for the "own"
 * scenario, and scenarioOwnerId = otherUserId for the "other" scenario.
 */
import expect from 'expect';
import React from 'react';
import ReactDOM from 'react-dom';

const ScenarioTableRow = require('../ScenarioTableRow').default;

const SELF = 9999;
const OTHER = 7777;

function makeScenario({ id = 1, ownerId = SELF } = {}) {
    return {
        id,
        name: `scenario_${id}`,
        created_by: ownerId,
        created_by_username: ownerId === SELF ? 'me' : `user_${ownerId}`,
        terrain: 1,
        boundary: null,
        inflow: null,
        friction: null,
        structure: null,
        mesh_region: null,
        network: null,
        resolution: 5,
        duration: 3600,
        unsaved: false,
        latest_run: null
        // findScenarioStatus: 'created' (no run, no built/built_at)
        // see scenarioHelpers.js
    };
}

describe('V2P-22 ScenarioTableRow per-role exact-button-set', () => {
    let container;
    let table;

    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
        // Components return a <tr>; mount inside a table-tbody to keep the
        // browser DOM happy under jsdom.
        table = document.createElement('table');
        const tbody = document.createElement('tbody');
        table.appendChild(tbody);
        container.appendChild(table);
    });

    afterEach(() => {
        ReactDOM.unmountComponentAtNode(table.querySelector('tbody'));
        document.body.removeChild(container);
    });

    function render({ role, scenarioOwnerId, canRunScenario = true }) {
        const tbody = table.querySelector('tbody');
        return new Promise((resolve) => {
            ReactDOM.render(
                <ScenarioTableRow
                    scenario={makeScenario({ ownerId: scenarioOwnerId })}
                    scenarioTableTabs={['manage']}
                    terrain={[]} boundaries={[]} inflows={[]}
                    frictions={[]} structures={[]} meshRegions={[]} networks={[]}
                    updateAnugaScenario={() => {}}
                    saveAnugaScenario={() => {}}
                    setOpenMenuGroupId={() => {}}
                    selectAnugaScenario={() => {}}
                    showAnugaRunMenu={() => {}}
                    setAnugaScenarioMenu={() => {}}
                    deleteAnugaScenario={() => {}}
                    cancelAnugaRun={() => {}}
                    toggleScenarioSelected={() => {}}
                    canRunScenario={canRunScenario}
                    myRole={role === 'anon' ? null : role}
                    currentUserId={SELF}
                />,
                tbody,
                () => resolve(tbody)
            );
        });
    }

    function readButtonSet() {
        const tbody = table.querySelector('tbody');
        const buttons = [];
        // Identify each .anuga-btn by its msgId-rendered text. Without an
        // IntlProvider the <Message> falls back to `<span>{msgId}</span>`,
        // so each button's textContent is the literal msgId (e.g.
        // "hydrata.anuga.build"). Match on the trailing token.
        const anugaBtns = tbody.querySelectorAll('.anuga-btn');
        anugaBtns.forEach(btn => {
            const txt = (btn.textContent || '').trim();
            if (/\.build$/i.test(txt)) buttons.push('build');
            else if (/\.log$/i.test(txt)) buttons.push('log');
            else if (/\.run$/i.test(txt) || btn.querySelector('.glyphicon-download')) buttons.push('run-or-download');
        });
        const deleteBtn = tbody.querySelector('.anuga-btn-delete');
        if (deleteBtn) buttons.push('delete');
        return buttons.sort();
    }

    // EXACT matrix — each role × {own scenario, other scenario}.
    // Status='created' (default fixture) → not cancellable → Delete = canEdit.
    // Per F-003 (TASK-949 W0.1) the run-column for status='created' now
    // renders a Build button gated by canRunScenario, instead of the old
    // disabled-Run fall-through. So for canRunScenario=true rows with
    // canEdit=true two Build buttons render: one from renderBuildCell() in
    // the Build column and one from renderRunButton() 'created' case in the
    // Run column. For canEdit=false but canRunScenario=true rows, only the
    // run-column Build button renders (no Build column for them).
    //
    // 'log' is always present (no role gate) — but test still pins it to
    // catch accidental coupling.
    const matrix = [
        // role,         scenarioOwner, expected
        ['owner',        SELF,          ['build', 'build', 'delete', 'log']],
        ['owner',        OTHER,         ['build', 'build', 'delete', 'log']],
        ['manager',      SELF,          ['build', 'build', 'delete', 'log']],
        ['manager',      OTHER,         ['build', 'build', 'delete', 'log']],
        ['editor',       SELF,          ['build', 'build', 'delete', 'log']],
        ['editor',       OTHER,         ['build', 'build', 'delete', 'log']],
        ['contributor',  SELF,          ['build', 'build', 'delete', 'log']],
        ['contributor',  OTHER,         ['build', 'log']],  // canEdit=false → no Build-column build/delete; F-003 run-column build still renders
        ['viewer',       SELF,          ['build', 'log']],
        ['viewer',       OTHER,         ['build', 'log']],
        ['anon',         SELF,          ['build', 'log']],
        ['anon',         OTHER,         ['build', 'log']]
    ];

    matrix.forEach(([role, owner, expected]) => {
        const ownerLabel = owner === SELF ? 'own' : 'other';
        it(`role=${role}, scenarioOwner=${ownerLabel} → [${expected.join(',')}]`, () => {
            return render({ role, scenarioOwnerId: owner }).then(() => {
                expect(readButtonSet()).toEqual(expected.slice().sort());
            });
        });
    });

    it('viewer with canRunScenario=false renders no run-column button', () => {
        // F-003 (TASK-949 W0.1) contract: renderRunButton for status='created'
        // returns null when !canRunScenario. The viewer role also has
        // canEdit=false, so no Build-column button renders either. Only the
        // always-present Log button remains in the .anuga-btn set, and no
        // 'run-or-download' or 'build' label is produced.
        return render({ role: 'viewer', scenarioOwnerId: SELF, canRunScenario: false }).then(() => {
            const set = readButtonSet();
            expect(set).toNotInclude('run-or-download');
            expect(set).toNotInclude('build');
            expect(set).toEqual(['log']);
        });
    });
});

/*
 * TASK-871 — Confirm prompts for the delete/cancel buttons must include the
 * scenario's name so operators with multiple in-flight runs can confirm they
 * are about to act on the right row. Pre-fix copy was generic
 * ("Cancel Run?" / "Delete Scenario?"). The new copy is built from a
 * template literal with `scenario.name || 'this scenario'` as a graceful
 * fallback when the name is empty or undefined.
 */
describe('TASK-871 ScenarioTableRow confirm prompts include scenario name', () => {
    let container;
    let table;
    let originalConfirm;
    let confirmCalls;

    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
        table = document.createElement('table');
        const tbody = document.createElement('tbody');
        table.appendChild(tbody);
        container.appendChild(table);
        // Capture window.confirm calls and always answer "false" so the test
        // doesn't dispatch the delete/cancel callbacks under the bench.
        confirmCalls = [];
        originalConfirm = window.confirm;
        window.confirm = (msg) => { confirmCalls.push(msg); return false; };
    });

    afterEach(() => {
        window.confirm = originalConfirm;
        ReactDOM.unmountComponentAtNode(table.querySelector('tbody'));
        document.body.removeChild(container);
    });

    function renderRow({ name = 'scenario_1', computedStatus = 'created' } = {}) {
        const tbody = table.querySelector('tbody');
        const scenario = {
            id: 42,
            name,
            created_by: SELF,
            created_by_username: 'me',
            terrain: 1,
            boundary: null,
            inflow: null,
            friction: null,
            structure: null,
            mesh_region: null,
            network: null,
            resolution: 5,
            duration: 3600,
            unsaved: false,
            latest_run: computedStatus === 'queued' ? { id: 99 } : null,
            computed_status: computedStatus
        };
        return new Promise((resolve) => {
            ReactDOM.render(
                <ScenarioTableRow
                    scenario={scenario}
                    scenarioTableTabs={['manage']}
                    terrain={[]} boundaries={[]} inflows={[]}
                    frictions={[]} structures={[]} meshRegions={[]} networks={[]}
                    updateAnugaScenario={() => {}}
                    saveAnugaScenario={() => {}}
                    setOpenMenuGroupId={() => {}}
                    selectAnugaScenario={() => {}}
                    showAnugaRunMenu={() => {}}
                    setAnugaScenarioMenu={() => {}}
                    deleteAnugaScenario={() => {}}
                    cancelAnugaRun={() => {}}
                    toggleScenarioSelected={() => {}}
                    canRunScenario
                    myRole={'owner'}
                    currentUserId={SELF}
                />,
                tbody,
                () => resolve(tbody)
            );
        });
    }

    it('delete prompt includes the scenario name', () => {
        return renderRow({ name: 'my_great_scenario', computedStatus: 'created' }).then((tbody) => {
            const deleteBtn = tbody.querySelector('.anuga-btn-delete');
            expect(deleteBtn).toExist();
            deleteBtn.click();
            expect(confirmCalls.length).toBe(1);
            expect(confirmCalls[0]).toContain('my_great_scenario');
            expect(confirmCalls[0].toLowerCase()).toContain('delete');
        });
    });

    it('cancel-run prompt includes the scenario name', () => {
        // computed_status='queued' → isCancellable=true → button fires the
        // cancel branch which calls confirm('Cancel run for "<name>"?').
        return renderRow({ name: 'queued_scenario', computedStatus: 'queued' }).then((tbody) => {
            const deleteBtn = tbody.querySelector('.anuga-btn-delete');
            expect(deleteBtn).toExist();
            deleteBtn.click();
            expect(confirmCalls.length).toBe(1);
            expect(confirmCalls[0]).toContain('queued_scenario');
            expect(confirmCalls[0].toLowerCase()).toContain('cancel');
        });
    });

    it('delete prompt falls back to "this scenario" when name is empty', () => {
        return renderRow({ name: '', computedStatus: 'created' }).then((tbody) => {
            const deleteBtn = tbody.querySelector('.anuga-btn-delete');
            expect(deleteBtn).toExist();
            deleteBtn.click();
            expect(confirmCalls.length).toBe(1);
            expect(confirmCalls[0]).toContain('this scenario');
        });
    });
});

/*
 * Duplicate button on ScenarioTableRow.
 *
 * Contract:
 *   - Rendered when canDuplicateScenario=true AND scenario has an id AND
 *     scenario is not in a cancellable state (queued/computing/building).
 *   - Hidden when canDuplicateScenario=false (viewer, anonymous).
 *   - Hidden when scenario.id is falsy (unsaved draft — BE has no row to clone).
 *   - On click: confirm prompt includes scenario name → dispatches
 *     duplicateAnugaScenario(scenario) on confirm.
 */
describe('TASK-879 ScenarioTableRow Duplicate button', () => {
    let container;
    let table;

    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
        table = document.createElement('table');
        const tbody = document.createElement('tbody');
        table.appendChild(tbody);
        container.appendChild(table);
    });

    afterEach(() => {
        ReactDOM.unmountComponentAtNode(table.querySelector('tbody'));
        document.body.removeChild(container);
    });

    function renderRow({
        scenarioId = 42,
        scenarioName = 'source',
        computedStatus = 'created',
        canDuplicate = true,
        myRole = 'editor',
        duplicateAnugaScenario = () => {}
    } = {}) {
        const tbody = table.querySelector('tbody');
        const scenario = {
            id: scenarioId,
            name: scenarioName,
            created_by: SELF,
            created_by_username: 'me',
            terrain: 1,
            boundary: null,
            inflow: null,
            friction: null,
            structure: null,
            mesh_region: null,
            network: null,
            resolution: 5,
            duration: 3600,
            unsaved: false,
            latest_run: computedStatus === 'queued' ? { id: 99 } : null,
            computed_status: computedStatus
        };
        return new Promise((resolve) => {
            ReactDOM.render(
                <ScenarioTableRow
                    scenario={scenario}
                    scenarioTableTabs={['manage']}
                    terrain={[]} boundaries={[]} inflows={[]}
                    frictions={[]} structures={[]} meshRegions={[]} networks={[]}
                    updateAnugaScenario={() => {}}
                    saveAnugaScenario={() => {}}
                    setOpenMenuGroupId={() => {}}
                    selectAnugaScenario={() => {}}
                    showAnugaRunMenu={() => {}}
                    setAnugaScenarioMenu={() => {}}
                    deleteAnugaScenario={() => {}}
                    duplicateAnugaScenario={duplicateAnugaScenario}
                    canDuplicateScenario={canDuplicate}
                    cancelAnugaRun={() => {}}
                    toggleScenarioSelected={() => {}}
                    canRunScenario
                    myRole={myRole}
                    currentUserId={SELF}
                />,
                tbody,
                () => resolve(tbody)
            );
        });
    }

    it('renders the Duplicate button when canDuplicate=true + saved + not cancellable', () => {
        return renderRow().then((tbody) => {
            const btn = tbody.querySelector('.anuga-btn-duplicate');
            expect(btn).toExist();
            expect(btn.querySelector('.glyphicon-duplicate')).toExist();
        });
    });

    it('hides the Duplicate button when canDuplicateScenario=false', () => {
        return renderRow({ canDuplicate: false }).then((tbody) => {
            const btn = tbody.querySelector('.anuga-btn-duplicate');
            expect(btn).toNotExist();
        });
    });

    it('hides the Duplicate button when scenario.id is falsy (unsaved draft)', () => {
        return renderRow({ scenarioId: null }).then((tbody) => {
            const btn = tbody.querySelector('.anuga-btn-duplicate');
            expect(btn).toNotExist();
        });
    });

    it('hides the Duplicate button while the scenario is queued/computing/building', () => {
        return renderRow({ computedStatus: 'queued' }).then((tbody) => {
            const btn = tbody.querySelector('.anuga-btn-duplicate');
            expect(btn).toNotExist();
        });
    });

    // Inline-confirm dialog (replaces window.confirm). The Duplicate button
    // opens the dialog; the .save-confirm-btn.confirm inside the dialog
    // actually dispatches. Dialog DOM is always rendered (TASK-723 pattern).
    it('opens inline confirm dialog with scenario name in the message', () => {
        return renderRow({ scenarioName: 'my_great_scenario' }).then((tbody) => {
            const btn = tbody.querySelector('.anuga-btn-duplicate');
            expect(btn).toExist();
            btn.click();
            const dialog = tbody.querySelector('.anuga-scenario-row-confirm.is-open');
            expect(dialog).toExist();
            const text = dialog.querySelector('.menu-row-delete-confirm-text').textContent;
            expect(text).toContain('my_great_scenario');
            expect(text.toLowerCase()).toContain('duplicate');
        });
    });

    it('dispatches duplicateAnugaScenario(scenario) on dialog Confirm click', () => {
        const dispatched = [];
        const duplicateAnugaScenario = (s) => dispatched.push(s);
        return renderRow({
            scenarioId: 77, scenarioName: 'pick_me', duplicateAnugaScenario
        }).then((tbody) => {
            tbody.querySelector('.anuga-btn-duplicate').click();
            const confirmBtn = tbody.querySelector('.anuga-scenario-row-confirm .save-confirm-btn.confirm');
            expect(confirmBtn).toExist();
            confirmBtn.click();
            expect(dispatched.length).toBe(1);
            expect(dispatched[0].id).toBe(77);
            expect(dispatched[0].name).toBe('pick_me');
        });
    });

    it('does NOT dispatch when dialog Cancel is clicked', () => {
        const dispatched = [];
        const duplicateAnugaScenario = (s) => dispatched.push(s);
        return renderRow({ duplicateAnugaScenario }).then((tbody) => {
            tbody.querySelector('.anuga-btn-duplicate').click();
            const cancelBtn = tbody.querySelector('.anuga-scenario-row-confirm .save-confirm-btn.cancel');
            expect(cancelBtn).toExist();
            cancelBtn.click();
            expect(dispatched.length).toBe(0);
        });
    });

    it('does NOT call window.confirm (regression guard against browser-modal interruption)', () => {
        // Failed in pre-fix: window.confirm fired on every click. Post-fix
        // the dialog is React-rendered, not browser-native.
        const calls = [];
        const original = window.confirm;
        window.confirm = (msg) => { calls.push(msg); return false; };
        return renderRow({ scenarioName: 'no_native_modal' }).then((tbody) => {
            tbody.querySelector('.anuga-btn-duplicate').click();
            window.confirm = original;
            expect(calls.length).toBe(0);
        }).catch((err) => {
            window.confirm = original;
            throw err;
        });
    });
});

/*
 * Archive/Unarchive button on ScenarioTableRow.
 *
 * Contract:
 *   - Archive button renders when canEdit && saved scenario && not cancellable
 *     AND scenario is NOT archived (archived_at falsy).
 *   - Unarchive button renders when canEdit && saved scenario && not cancellable
 *     AND scenario IS archived (archived_at truthy).
 *   - Both share the same DOM cell — toggled by archived_at.
 *   - Confirm prompt includes scenario name; dispatches archive/unarchive on yes.
 */
describe('TASK-880 ScenarioTableRow Archive button', () => {
    let container;
    let table;

    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
        table = document.createElement('table');
        const tbody = document.createElement('tbody');
        table.appendChild(tbody);
        container.appendChild(table);
    });

    afterEach(() => {
        ReactDOM.unmountComponentAtNode(table.querySelector('tbody'));
        document.body.removeChild(container);
    });

    function renderRow({
        scenarioId = 42,
        scenarioName = 'source',
        computedStatus = 'created',
        archivedAt = null,
        myRole = 'editor',
        archiveAnugaScenario = () => {},
        unarchiveAnugaScenario = () => {}
    } = {}) {
        const tbody = table.querySelector('tbody');
        const scenario = {
            id: scenarioId,
            name: scenarioName,
            created_by: SELF,
            created_by_username: 'me',
            terrain: 1,
            boundary: null,
            inflow: null,
            friction: null,
            structure: null,
            mesh_region: null,
            network: null,
            resolution: 5,
            duration: 3600,
            unsaved: false,
            archived_at: archivedAt,
            latest_run: computedStatus === 'queued' ? { id: 99 } : null,
            computed_status: computedStatus
        };
        return new Promise((resolve) => {
            ReactDOM.render(
                <ScenarioTableRow
                    scenario={scenario}
                    scenarioTableTabs={['manage']}
                    terrain={[]} boundaries={[]} inflows={[]}
                    frictions={[]} structures={[]} meshRegions={[]} networks={[]}
                    updateAnugaScenario={() => {}}
                    saveAnugaScenario={() => {}}
                    setOpenMenuGroupId={() => {}}
                    selectAnugaScenario={() => {}}
                    showAnugaRunMenu={() => {}}
                    setAnugaScenarioMenu={() => {}}
                    deleteAnugaScenario={() => {}}
                    duplicateAnugaScenario={() => {}}
                    canDuplicateScenario
                    archiveAnugaScenario={archiveAnugaScenario}
                    unarchiveAnugaScenario={unarchiveAnugaScenario}
                    cancelAnugaRun={() => {}}
                    toggleScenarioSelected={() => {}}
                    canRunScenario
                    myRole={myRole}
                    currentUserId={SELF}
                />,
                tbody,
                () => resolve(tbody)
            );
        });
    }

    it('renders Archive button for an active scenario when canEdit + saved', () => {
        return renderRow().then((tbody) => {
            expect(tbody.querySelector('.anuga-btn-archive')).toExist();
            expect(tbody.querySelector('.anuga-btn-unarchive')).toNotExist();
        });
    });

    it('renders Unarchive button when scenario.archived_at is set', () => {
        return renderRow({ archivedAt: '2026-05-14T13:00:00Z' }).then((tbody) => {
            expect(tbody.querySelector('.anuga-btn-unarchive')).toExist();
            expect(tbody.querySelector('.anuga-btn-archive')).toNotExist();
        });
    });

    it('hides the Archive button for non-editor roles (viewer)', () => {
        return renderRow({ myRole: 'viewer' }).then((tbody) => {
            expect(tbody.querySelector('.anuga-btn-archive')).toNotExist();
        });
    });

    it('hides the Archive button when scenario.id is falsy (unsaved draft)', () => {
        return renderRow({ scenarioId: null }).then((tbody) => {
            expect(tbody.querySelector('.anuga-btn-archive')).toNotExist();
        });
    });

    it('hides Archive while the scenario is queued/computing/building (cancellable)', () => {
        return renderRow({ computedStatus: 'queued' }).then((tbody) => {
            expect(tbody.querySelector('.anuga-btn-archive')).toNotExist();
        });
    });

    // Inline-confirm dialog (replaces window.confirm). The Archive button
    // opens the dialog; the .save-confirm-btn.confirm inside the dialog
    // actually dispatches. Dialog DOM is always rendered (TASK-723 pattern).
    it('Archive opens inline confirm dialog with scenario name', () => {
        return renderRow({ scenarioName: 'mighty' }).then((tbody) => {
            tbody.querySelector('.anuga-btn-archive').click();
            const dialog = tbody.querySelector('.anuga-scenario-row-confirm.is-open');
            expect(dialog).toExist();
            const text = dialog.querySelector('.menu-row-delete-confirm-text').textContent;
            expect(text).toContain('mighty');
            expect(text.toLowerCase()).toContain('archive');
        });
    });

    it('Archive dispatches archiveAnugaScenario(scenario) on dialog Confirm click', () => {
        const dispatched = [];
        const archiveAnugaScenario = (s) => dispatched.push(s);
        return renderRow({
            scenarioId: 77, scenarioName: 'pick_me', archiveAnugaScenario
        }).then((tbody) => {
            tbody.querySelector('.anuga-btn-archive').click();
            const confirmBtn = tbody.querySelector('.anuga-scenario-row-confirm .save-confirm-btn.confirm');
            expect(confirmBtn).toExist();
            confirmBtn.click();
            expect(dispatched.length).toBe(1);
            expect(dispatched[0].id).toBe(77);
            expect(dispatched[0].name).toBe('pick_me');
        });
    });

    it('Archive does NOT dispatch when dialog Cancel is clicked', () => {
        const dispatched = [];
        const archiveAnugaScenario = (s) => dispatched.push(s);
        return renderRow({ archiveAnugaScenario }).then((tbody) => {
            tbody.querySelector('.anuga-btn-archive').click();
            const cancelBtn = tbody.querySelector('.anuga-scenario-row-confirm .save-confirm-btn.cancel');
            expect(cancelBtn).toExist();
            cancelBtn.click();
            expect(dispatched.length).toBe(0);
        });
    });

    it('Unarchive dispatches unarchiveAnugaScenario(scenario) on dialog Confirm click', () => {
        const dispatched = [];
        const unarchiveAnugaScenario = (s) => dispatched.push(s);
        return renderRow({
            scenarioId: 88, scenarioName: 'restore_me',
            archivedAt: '2026-05-14T13:00:00Z',
            unarchiveAnugaScenario
        }).then((tbody) => {
            tbody.querySelector('.anuga-btn-unarchive').click();
            const confirmBtn = tbody.querySelector('.anuga-scenario-row-confirm .save-confirm-btn.confirm');
            expect(confirmBtn).toExist();
            confirmBtn.click();
            expect(dispatched.length).toBe(1);
            expect(dispatched[0].id).toBe(88);
        });
    });

    it('Unarchive opens dialog with restore/unarchive wording + scenario name', () => {
        return renderRow({
            scenarioName: 'restore_me', archivedAt: '2026-05-14T13:00:00Z'
        }).then((tbody) => {
            tbody.querySelector('.anuga-btn-unarchive').click();
            const dialog = tbody.querySelector('.anuga-scenario-row-confirm.is-open');
            expect(dialog).toExist();
            const text = dialog.querySelector('.menu-row-delete-confirm-text').textContent;
            expect(text).toContain('restore_me');
            expect(text.toLowerCase()).toMatch(/restore|unarchive/);
        });
    });

    it('Archive does NOT call window.confirm (regression guard against browser-modal interruption)', () => {
        const calls = [];
        const original = window.confirm;
        window.confirm = (msg) => { calls.push(msg); return false; };
        return renderRow({ scenarioName: 'no_native_modal' }).then((tbody) => {
            tbody.querySelector('.anuga-btn-archive').click();
            window.confirm = original;
            expect(calls.length).toBe(0);
        }).catch((err) => {
            window.confirm = original;
            throw err;
        });
    });
});
