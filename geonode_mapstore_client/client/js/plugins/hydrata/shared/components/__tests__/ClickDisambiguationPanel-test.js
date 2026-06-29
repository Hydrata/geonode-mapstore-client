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
        if (typeof v === 'function') { acc.push(`${path}.${k}`); }
        else if (v && typeof v === 'object') { collectFunctionPaths(v, `${path}.${k}`, acc); }
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

        it('surfaces [] below 2 candidates and the list at >= 2', () => {
            expect(mapStateToProps({}).candidates).toEqual([]);
            expect(mapStateToProps({ anuga: { clickDisambiguation: { candidates: [candidate('bdy_', 'b.1')] } } }).candidates).toEqual([]);
            const two = [candidate('bdy_', 'b.1'), candidate('inf_', 'i.2')];
            expect(mapStateToProps({ anuga: { clickDisambiguation: { candidates: two } } }).candidates).toEqual(two);
        });
    });
});
