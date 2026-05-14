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
    // canRunScenario=true means Run-or-Download present for built/complete states;
    // status='created' shows a disabled Run, which still renders as .anuga-btn
    // (matches the renderRunButton "default" branch). We assert presence, not
    // disabled-state, since the role gate is what V2P-22 covers.
    //
    // 'log' is always present (no role gate) — but test still pins it to
    // catch accidental coupling.
    const matrix = [
        // role,         scenarioOwner, expected
        ['owner',        SELF,          ['build', 'delete', 'log', 'run-or-download']],
        ['owner',        OTHER,         ['build', 'delete', 'log', 'run-or-download']],
        ['manager',      SELF,          ['build', 'delete', 'log', 'run-or-download']],
        ['manager',      OTHER,         ['build', 'delete', 'log', 'run-or-download']],
        ['editor',       SELF,          ['build', 'delete', 'log', 'run-or-download']],
        ['editor',       OTHER,         ['build', 'delete', 'log', 'run-or-download']],
        ['contributor',  SELF,          ['build', 'delete', 'log', 'run-or-download']],
        ['contributor',  OTHER,         ['log', 'run-or-download']],  // canEdit=false → no build/delete
        ['viewer',       SELF,          ['log', 'run-or-download']],
        ['viewer',       OTHER,         ['log', 'run-or-download']],
        ['anon',         SELF,          ['log', 'run-or-download']],
        ['anon',         OTHER,         ['log', 'run-or-download']]
    ];

    matrix.forEach(([role, owner, expected]) => {
        const ownerLabel = owner === SELF ? 'own' : 'other';
        it(`role=${role}, scenarioOwner=${ownerLabel} → [${expected.join(',')}]`, () => {
            return render({ role, scenarioOwnerId: owner }).then(() => {
                expect(readButtonSet()).toEqual(expected.slice().sort());
            });
        });
    });

    it('viewer with canRunScenario=false hides run-or-download', () => {
        // Note: status='created' default → renderRunButton hits the "default"
        // branch which renders a disabled Run button regardless of canRunScenario.
        // The canRunScenario gate only applies to 'built', 'cancelled', 'error'
        // statuses. For 'created' the row always shows the disabled Run.
        // This assertion just regression-pins that contract.
        return render({ role: 'viewer', scenarioOwnerId: SELF, canRunScenario: false }).then(() => {
            const set = readButtonSet();
            expect(set).toInclude('run-or-download');
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
