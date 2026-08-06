/**
 * TASK-2194 (epic 2190 W2) — compute-target site-config hydration.
 *
 * Covers:
 *   - loadAnugaComputeConfigEpic: first INIT_ANUGA -> GET /api/v2/anuga/config/
 *     -> SET_ANUGA_COMPUTE_CONFIG carrying the payload; take(1) dedupe.
 *   - uiReducer: hydrates availableComputeTargets / defaultComputeTarget from
 *     the action; shape-tolerant (malformed payload -> empty allowlist so the
 *     staff selector stays hidden); initial state is null (config not loaded).
 *
 * Epic-test harness mirrors computeMeterEpics-test.js (mockActions Subject +
 * axios-mock-adapter on the SAME ajax singleton anugaApi.js imports).
 */
import expect from 'expect';
import Rx from 'rxjs';
import MockAdapter from 'axios-mock-adapter';
import axios from '../../../../../MapStore2/web/client/libs/ajax';

import {loadAnugaComputeConfigEpic} from '../epics/crudEpics';
import {INIT_ANUGA, SET_ANUGA_COMPUTE_CONFIG, setAnugaComputeConfig} from '../actionsAnuga';
import uiReducer from '../reducers/uiReducer';

const CONFIG_URL = '/api/v2/anuga/config/';

const mockActions = (actions) => {
    const subject = new Rx.Subject();
    const action$ = subject.asObservable();
    action$.ofType = (...types) => action$.filter(a => types.includes(a.type));
    setTimeout(() => {
        actions.forEach(a => subject.next(a));
        subject.complete();
    }, 0);
    return action$;
};

describe('TASK-2194 loadAnugaComputeConfigEpic', () => {
    let mockAxios;
    beforeEach(() => { mockAxios = new MockAdapter(axios); });
    afterEach(() => { mockAxios.restore(); });

    it('first INIT_ANUGA -> GET config -> SET_ANUGA_COMPUTE_CONFIG with the payload', (done) => {
        const payload = {
            default_compute_backend: 'batch',
            celery_anuga_enabled: true,
            available_compute_targets: ['local', 'batch-x32'],
            default_compute_target: 'batch-x32'
        };
        mockAxios.onGet(CONFIG_URL).reply(200, payload);
        const emitted = [];
        loadAnugaComputeConfigEpic(mockActions([{type: INIT_ANUGA}]))
            .subscribe(a => emitted.push(a), done, () => {
                expect(emitted.length).toBe(1);
                expect(emitted[0].type).toBe(SET_ANUGA_COMPUTE_CONFIG);
                expect(emitted[0].config.available_compute_targets).toEqual(['local', 'batch-x32']);
                expect(emitted[0].config.default_compute_target).toBe('batch-x32');
                done();
            });
    });

    it('a second INIT_ANUGA in the same session is deduped (take(1))', (done) => {
        mockAxios.onGet(CONFIG_URL).reply(200, {available_compute_targets: ['local'], default_compute_target: 'local'});
        const emitted = [];
        loadAnugaComputeConfigEpic(mockActions([{type: INIT_ANUGA}, {type: INIT_ANUGA}]))
            .subscribe(a => emitted.push(a), done, () => {
                expect(emitted.length).toBe(1);
                done();
            });
    });

    it('network error settles to the empty-allowlist fallback (selector stays hidden)', (done) => {
        mockAxios.onGet(CONFIG_URL).networkError();
        const emitted = [];
        loadAnugaComputeConfigEpic(mockActions([{type: INIT_ANUGA}]))
            .subscribe(a => emitted.push(a), done, () => {
                // getAnugaConfig catches internally, so the epic still emits —
                // with the safe empty-allowlist shape.
                expect(emitted.length).toBe(1);
                expect(emitted[0].config.available_compute_targets).toEqual([]);
                expect(emitted[0].config.default_compute_target).toBe(null);
                done();
            });
    });
});

describe('TASK-2194 uiReducer SET_ANUGA_COMPUTE_CONFIG', () => {
    it('initial state: config not loaded (null allowlist, null default)', () => {
        const state = uiReducer(undefined, {type: '@@INIT'});
        expect(state.availableComputeTargets).toBe(null);
        expect(state.defaultComputeTarget).toBe(null);
    });

    it('hydrates the allowlist + default from the action payload', () => {
        const state = uiReducer(undefined, setAnugaComputeConfig({
            available_compute_targets: ['local', 'batch-x32', 'batch-gpu-a10g'],
            default_compute_target: 'batch-x32'
        }));
        expect(state.availableComputeTargets).toEqual(['local', 'batch-x32', 'batch-gpu-a10g']);
        expect(state.defaultComputeTarget).toBe('batch-x32');
    });

    it('is shape-tolerant: a malformed payload yields an EMPTY allowlist (selector hidden)', () => {
        const state = uiReducer(undefined, setAnugaComputeConfig({
            available_compute_targets: 'not-a-list',
            default_compute_target: 42
        }));
        expect(state.availableComputeTargets).toEqual([]);
        expect(state.defaultComputeTarget).toBe(null);
        const stateNull = uiReducer(undefined, setAnugaComputeConfig(null));
        expect(stateNull.availableComputeTargets).toEqual([]);
        expect(stateNull.defaultComputeTarget).toBe(null);
    });

    // TASK-2211 (W3.2, epic 2204, AC#4) — meshDivergenceThreshold hydration.
    it('initial state: meshDivergenceThreshold not loaded (null)', () => {
        const state = uiReducer(undefined, {type: '@@INIT'});
        expect(state.meshDivergenceThreshold).toBe(null);
    });

    it('hydrates meshDivergenceThreshold from the action payload', () => {
        const state = uiReducer(undefined, setAnugaComputeConfig({
            available_compute_targets: ['local'],
            default_compute_target: 'local',
            mesh_divergence_threshold: 3.5
        }));
        expect(state.meshDivergenceThreshold).toBe(3.5);
    });

    it('is shape-tolerant: a non-numeric mesh_divergence_threshold yields null (falls back to the FE default)', () => {
        const state = uiReducer(undefined, setAnugaComputeConfig({
            mesh_divergence_threshold: 'not-a-number'
        }));
        expect(state.meshDivergenceThreshold).toBe(null);
        const stateMissing = uiReducer(undefined, setAnugaComputeConfig({}));
        expect(stateMissing.meshDivergenceThreshold).toBe(null);
    });

    // TASK-2644 (epic 2635 W1) — canSelectComputeTarget: the gn_anuga
    // tester capability, NOT is_staff (2635-D3, no back-compat bridge).
    describe('TASK-2644 canSelectComputeTarget', () => {
        it('initial state: not hydrated yet (false, fail-closed default)', () => {
            const state = uiReducer(undefined, {type: '@@INIT'});
            expect(state.canSelectComputeTarget).toBe(false);
        });

        it('hydrates true from can_select_compute_target: true', () => {
            const state = uiReducer(undefined, setAnugaComputeConfig({
                available_compute_targets: ['local'],
                default_compute_target: 'local',
                can_select_compute_target: true
            }));
            expect(state.canSelectComputeTarget).toBe(true);
        });

        it('is shape-tolerant: anything but a literal true yields false', () => {
            expect(uiReducer(undefined, setAnugaComputeConfig({
                can_select_compute_target: 'true'
            })).canSelectComputeTarget).toBe(false);
            expect(uiReducer(undefined, setAnugaComputeConfig({
                can_select_compute_target: 1
            })).canSelectComputeTarget).toBe(false);
            expect(uiReducer(undefined, setAnugaComputeConfig({})).canSelectComputeTarget).toBe(false);
            expect(uiReducer(undefined, setAnugaComputeConfig(null)).canSelectComputeTarget).toBe(false);
        });
    });
});
