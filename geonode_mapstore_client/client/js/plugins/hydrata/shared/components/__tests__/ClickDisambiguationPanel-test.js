/*
 * TASK-1993 (W2.1) — ClickDisambiguationPanel tests.
 *
 * Proof points:
 *   (a) presentational renders one row per candidate from candidate.label;
 *       empty candidates renders null (AC1).
 *   (b) row-click resolves the opener via getClickTarget(kind).buildOpenActions
 *       AT CLICK TIME and dispatches the resulting plain actions + HIDE — no
 *       function is ever held in state / dispatched (AC2, D6).
 *   (c) the connected container is state-gated to render only when there are
 *       >= 2 candidates (AC3).
 */
import React from 'react';
import expect from 'expect';
import { render, fireEvent } from '@testing-library/react';
import mountWithProviders from '../../../../../__tests__/helpers/mountWithProviders';
import ConnectedPanel, {
    ClickDisambiguationPanel,
    resolveCandidateOpenActions,
    resolveLayerTitle,
    mapStateToProps
} from '../ClickDisambiguationPanel';
import {
    registerClickTarget,
    cleanClickTargets
} from '../../clickTargetRegistry';
import { HIDE_CLICK_DISAMBIGUATION } from '../../../Anuga/actions/clickDisambiguationActions';

const candidate = (kind, featureId, label) => ({
    kind,
    featureId,
    layerName: featureId.slice(0, featureId.lastIndexOf('.')),
    label: label || { title: kind, subtitle: '', icon: '' }
});

// A redux-thunk-aware fake store: executes dispatched thunks (mirroring the
// real store's redux-thunk middleware) and records the plain actions.
const makeThunkStore = (state) => {
    const dispatched = [];
    const store = {
        getState: () => state,
        subscribe: () => () => {},
        dispatch: (action) => {
            if (typeof action === 'function') { return action(store.dispatch, store.getState); }
            dispatched.push(action);
            return action;
        }
    };
    return { store, dispatched };
};

// Deep walk collecting function paths (D6 guard).
const collectFunctionPaths = (obj, path = 'root', acc = []) => {
    if (!obj || typeof obj !== 'object') { return acc; }
    Object.keys(obj).forEach((k) => {
        const v = obj[k];
        if (typeof v === 'function') {
            acc.push(`${path}.${k}`);
        } else if (v && typeof v === 'object') {
            collectFunctionPaths(v, `${path}.${k}`, acc);
        }
    });
    return acc;
};

describe('ClickDisambiguationPanel (TASK-1993 W2.1)', () => {

    beforeEach(() => cleanClickTargets());
    afterEach(() => cleanClickTargets());

    describe('presentational', () => {

        it('renders one row per candidate from candidate.label (AC1)', () => {
            const candidates = [
                candidate('bdy_', 'bdy_1_b.5', { title: 'Boundary', subtitle: 'North wall', icon: 'pencil' }),
                candidate('inf_', 'inf_2_i.3', { title: 'Inflow', subtitle: '', icon: 'pencil' })
            ];
            const { container } = render(
                <ClickDisambiguationPanel candidates={candidates} onSelect={() => {}} onClose={() => {}} />
            );
            const rows = container.querySelectorAll('.click-disambiguation-row');
            expect(rows.length).toBe(2);
            expect(container.textContent).toContain('Boundary');
            expect(container.textContent).toContain('North wall');
            expect(container.textContent).toContain('Inflow');
        });

        it('renders null for empty candidates (AC1)', () => {
            const { container } = render(
                <ClickDisambiguationPanel candidates={[]} onSelect={() => {}} onClose={() => {}} />
            );
            expect(container.querySelector('.click-disambiguation-overlay')).toBe(null);
        });

        it('renders null for undefined candidates (AC1)', () => {
            const { container } = render(
                <ClickDisambiguationPanel onSelect={() => {}} onClose={() => {}} />
            );
            expect(container.innerHTML).toBe('');
        });

        it('row-click invokes onSelect with that candidate', () => {
            const selected = [];
            const candidates = [
                candidate('bdy_', 'bdy_1_b.5'),
                candidate('inf_', 'inf_2_i.3')
            ];
            const { container } = render(
                <ClickDisambiguationPanel candidates={candidates} onSelect={(c) => selected.push(c)} onClose={() => {}} />
            );
            const rows = container.querySelectorAll('.click-disambiguation-row');
            fireEvent.click(rows[1]);
            expect(selected.length).toBe(1);
            expect(selected[0].featureId).toBe('inf_2_i.3');
        });
    });

    describe('resolveCandidateOpenActions (D6 — opener resolved at click time)', () => {

        it('resolves the opener via getClickTarget(kind) and returns plain actions', () => {
            registerClickTarget('bdy_', {
                match: () => true,
                buildOpenActions: (feature) => [{ type: 'FAKE:OPEN', featureId: feature.id }]
            });
            const actions = resolveCandidateOpenActions(candidate('bdy_', 'bdy_1_b.5'));
            expect(actions).toEqual([{ type: 'FAKE:OPEN', featureId: 'bdy_1_b.5' }]);
            expect(collectFunctionPaths(actions)).toEqual([]);
        });

        it('returns [] for an unknown kind (no registered target)', () => {
            expect(resolveCandidateOpenActions(candidate('zzz_', 'zzz_1_x.1'))).toEqual([]);
        });

        it('returns [] when the opener throws (never crashes the panel)', () => {
            registerClickTarget('bad_', {
                match: () => true,
                buildOpenActions: () => { throw new Error('boom'); }
            });
            expect(resolveCandidateOpenActions(candidate('bad_', 'bad_1_x.1'))).toEqual([]);
        });
    });

    describe('connected container (state-gated)', () => {

        const stateWith = (candidates) => ({ anuga: { clickDisambiguation: { candidates } } });

        it('renders null with fewer than 2 candidates (W2 gate, AC3)', () => {
            const { store } = makeThunkStore(stateWith([candidate('bdy_', 'bdy_1_b.5')]));
            const { container } = mountWithProviders(<ConnectedPanel />, { store });
            expect(container.querySelector('.click-disambiguation-row')).toBe(null);
        });

        it('renders a row per candidate with >= 2 candidates (AC3)', () => {
            const { store } = makeThunkStore(stateWith([
                candidate('bdy_', 'bdy_1_b.5'),
                candidate('inf_', 'inf_2_i.3')
            ]));
            const { container } = mountWithProviders(<ConnectedPanel />, { store });
            expect(container.querySelectorAll('.click-disambiguation-row').length).toBe(2);
        });

        it('row-click dispatches the resolved opener actions + HIDE, no function in state (AC2)', () => {
            registerClickTarget('bdy_', {
                match: () => true,
                buildOpenActions: (feature) => [{ type: 'BDY:OPEN', featureId: feature.id }]
            });
            registerClickTarget('inf_', {
                match: () => true,
                buildOpenActions: (feature) => [{ type: 'INF:OPEN', featureId: feature.id }]
            });
            const { store, dispatched } = makeThunkStore(stateWith([
                candidate('bdy_', 'bdy_1_b.5'),
                candidate('inf_', 'inf_2_i.3')
            ]));
            const { container } = mountWithProviders(<ConnectedPanel />, { store });
            const rows = container.querySelectorAll('.click-disambiguation-row');
            fireEvent.click(rows[0]);
            expect(dispatched).toEqual([
                { type: 'BDY:OPEN', featureId: 'bdy_1_b.5' },
                { type: HIDE_CLICK_DISAMBIGUATION }
            ]);
            expect(collectFunctionPaths(dispatched)).toEqual([]);
        });
    });

    describe('mapStateToProps gate', () => {

        it('surfaces [] for 0 candidates (no state)', () => {
            expect(mapStateToProps({}).candidates).toEqual([]);
        });

        it('surfaces [] for fewer than 2 candidates (W2 gate)', () => {
            expect(mapStateToProps({
                anuga: { clickDisambiguation: { candidates: [candidate('bdy_', 'b.1')] } }
            }).candidates).toEqual([]);
        });

        it('enriches each candidate with layerTitle from state.layers.flat (S3)', () => {
            const two = [candidate('bdy_', 'bdy_1_b.1'), candidate('inf_', 'inf_2_i.2')];
            const state = {
                anuga: { clickDisambiguation: { candidates: two } },
                layers: { flat: [
                    { name: 'geonode:bdy_1_b', title: 'North Wall Boundary', visibility: true },
                    { name: 'geonode:inf_2_i', title: 'Upstream Inflow', visibility: true }
                ] }
            };
            const result = mapStateToProps(state);
            expect(result.candidates.length).toBe(2);
            expect(result.candidates[0].layerTitle).toBe('North Wall Boundary');
            expect(result.candidates[1].layerTitle).toBe('Upstream Inflow');
            // Other candidate fields are preserved
            expect(result.candidates[0].kind).toBe('bdy_');
            expect(result.candidates[1].featureId).toBe('inf_2_i.2');
        });

        it('sets layerTitle null when the layer is absent from state.layers.flat (falls back to label.title)', () => {
            const two = [candidate('bdy_', 'bdy_1_b.1'), candidate('inf_', 'inf_2_i.2')];
            const state = {
                anuga: { clickDisambiguation: { candidates: two } },
                layers: { flat: [] }
            };
            const result = mapStateToProps(state);
            expect(result.candidates[0].layerTitle).toBe(null);
            expect(result.candidates[1].layerTitle).toBe(null);
        });
    });

    describe('resolveLayerTitle (S3 helper)', () => {

        it('returns the title for an exact match (bare layerName vs namespace-qualified flat name)', () => {
            const state = { layers: { flat: [
                { name: 'geonode:ele_5_x_cog', title: 'Copernicus DEM', visibility: true }
            ] } };
            expect(resolveLayerTitle('ele_5_x_cog', state)).toBe('Copernicus DEM');
        });

        it('matches namespace-insensitively (bare candidate name vs workspace-qualified flat name)', () => {
            const state = { layers: { flat: [
                { name: 'geonode:ele_5_x_cog', title: 'Copernicus DEM', visibility: true }
            ] } };
            // candidate layerName is bare (no workspace prefix), flat has geonode: prefix
            expect(resolveLayerTitle('ele_5_x_cog', state)).toBe('Copernicus DEM');
            // also works when candidate already has a namespace prefix
            expect(resolveLayerTitle('geonode:ele_5_x_cog', state)).toBe('Copernicus DEM');
        });

        it('returns null when no layer matches', () => {
            const state = { layers: { flat: [
                { name: 'geonode:other_layer', title: 'Other', visibility: true }
            ] } };
            expect(resolveLayerTitle('ele_5_x_cog', state)).toBe(null);
        });

        it('returns null when state.layers.flat is absent', () => {
            expect(resolveLayerTitle('ele_5_x_cog', {})).toBe(null);
            expect(resolveLayerTitle('ele_5_x_cog', { layers: {} })).toBe(null);
        });

        it('returns null when the matching layer has no title', () => {
            const state = { layers: { flat: [{ name: 'geonode:ele_5_x_cog' }] } };
            expect(resolveLayerTitle('ele_5_x_cog', state)).toBe(null);
        });
    });
});

// TASK-2235 — the chooser rides the MovablePanel primitive (drag + resize +
// per-panelId persistence) while keeping its dim backdrop; only a click on the
// backdrop itself (not inside the panel) closes it.
describe('ClickDisambiguationPanel — movable (TASK-2235)', () => {

    beforeEach(() => cleanClickTargets());
    afterEach(() => cleanClickTargets());

    const two = () => [
        candidate('bdy_', 'bdy_1_b.5', { title: 'Boundary', subtitle: '', icon: '' }),
        candidate('inf_', 'inf_2_i.3', { title: 'Inflow', subtitle: '', icon: '' })
    ];

    it('renders the chooser rows inside a MovablePanel carrying the panel class', () => {
        render(<ClickDisambiguationPanel candidates={two()} onSelect={() => {}} onClose={() => {}} />);
        const panel = document.querySelector('[data-testid="movable-panel-clickDisambiguation"]');
        expect(panel).toExist();
        expect(panel.className).toInclude('sv-movable-panel');
        expect(panel.className).toInclude('click-disambiguation-panel');
        expect(panel.querySelectorAll('.click-disambiguation-row').length).toBe(2);
        expect(panel.querySelector('.sv-panel-header-close')).toExist();
    });

    it('backdrop click closes; a click inside the panel does not', () => {
        const onClose = expect.createSpy();
        const { container } = render(
            <ClickDisambiguationPanel candidates={two()} onSelect={() => {}} onClose={onClose} />
        );
        const title = document.querySelector('[data-testid="movable-panel-clickDisambiguation"] .sv-panel-header-title');
        fireEvent.click(title);
        expect(onClose).toNotHaveBeenCalled();
        fireEvent.click(container.querySelector('.click-disambiguation-overlay'));
        expect(onClose).toHaveBeenCalled();
    });

    it('applies a persisted position from panelState', () => {
        render(
            <ClickDisambiguationPanel
                candidates={two()}
                onSelect={() => {}}
                onClose={() => {}}
                panelState={{ position: { x: 33, y: 44 } }}
            />
        );
        const panel = document.querySelector('[data-testid="movable-panel-clickDisambiguation"]');
        expect(panel.style.transform).toInclude('33px');
        expect(panel.style.transform).toInclude('44px');
    });

    it('drag-end persists the position keyed by the clickDisambiguation panel id', () => {
        const onPanelStateChange = expect.createSpy();
        render(
            <ClickDisambiguationPanel
                candidates={two()}
                onSelect={() => {}}
                onClose={() => {}}
                onPanelStateChange={onPanelStateChange}
            />
        );
        const header = document.querySelector('[data-testid="movable-panel-clickDisambiguation"] .sv-movable-panel-header');
        header.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, clientX: 50, clientY: 50 }));
        document.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, cancelable: true, clientX: 90, clientY: 70 }));
        document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, clientX: 90, clientY: 70 }));
        expect(onPanelStateChange).toHaveBeenCalled();
        const args = onPanelStateChange.calls[onPanelStateChange.calls.length - 1].arguments;
        expect(args[0]).toBe('clickDisambiguation');
        expect(args[1].position).toExist();
    });

    it('mapStateToProps surfaces panelState from anuga.ui.movablePanels', () => {
        const state = {
            anuga: {
                clickDisambiguation: { candidates: [candidate('bdy_', 'b.1'), candidate('inf_', 'i.2')] },
                ui: { movablePanels: { clickDisambiguation: { position: { x: 1, y: 2 } } } }
            }
        };
        expect(mapStateToProps(state).panelState).toEqual({ position: { x: 1, y: 2 } });
    });
});
