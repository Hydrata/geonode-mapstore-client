/*
 * TASK-2961 (epic 2815 W3 restart) — the build-error toast renders the
 * server's `detail` verbatim.
 *
 * The BE pre-build admission gate refuses an over-ceiling mesh with
 * 422 {error_code: 'MESH_TOO_LARGE', estimate, ceiling, detail} where
 * `detail` is already a full, user-facing sentence. buildScenarioError's
 * generic (non-409) branch must put THAT sentence in the toast — not the
 * axios status text ("Request failed with status code 422") and not a
 * JSON blob of the payload.
 *
 * Both error shapes the thunk can receive are covered:
 *   - the RAW axios error  ({response: {status, data}, message}) — what
 *     axios-mock-adapter and a same-origin network failure produce;
 *   - the INTERCEPTOR shape ({status, data, originalError}) — what the live
 *     app receives, because MapStore2/web/client/libs/ajax.js spreads
 *     error.response onto the rejection (see utils/apiErrorUtils.js).
 */
import expect from 'expect';
import { SHOW_NOTIFICATION } from '../../../../../../MapStore2/web/client/actions/notifications';
import { buildScenarioError, BUILD_SCENARIO_ERROR } from '../comparisonActions';

// Runs a redux-thunk action creator's dispatched actions through a fake
// dispatch that recurses into nested thunks, collecting every PLAIN action
// (same idiom as Anuga/__tests__/crudEpicsLayer1Layer4-test.js).
const collectDispatched = (thunkOrAction) => {
    const collected = [];
    const dispatch = (a) => {
        if (typeof a === 'function') {
            a(dispatch);
        } else {
            collected.push(a);
        }
    };
    dispatch(thunkOrAction);
    return collected;
};

const MESH_TOO_LARGE_DETAIL = 'This mesh would be ~28,734,818 triangles, above the 7,737,436-triangle limit. '
    + 'Coarsen the resolution or reduce the extent.';

const MESH_TOO_LARGE_PAYLOAD = {
    error_code: 'MESH_TOO_LARGE',
    estimate: 28734818,
    ceiling: 7737436,
    detail: MESH_TOO_LARGE_DETAIL
};

const findToast = (dispatched) => dispatched.find(a => a.type === SHOW_NOTIFICATION);
const findBuildError = (dispatched) => dispatched.find(a => a.type === BUILD_SCENARIO_ERROR);

describe('comparisonActions — buildScenarioError toast wording (TASK-2961)', () => {

    it('renders the server detail verbatim for a raw axios-shaped 422 (error.response.data)', () => {
        const error = {
            response: { status: 422, data: MESH_TOO_LARGE_PAYLOAD },
            message: 'Request failed with status code 422'
        };
        const dispatched = collectDispatched(buildScenarioError(42, error));

        const toast = findToast(dispatched);
        expect(toast).toExist();
        expect(toast.level).toBe('error');
        expect(toast.message).toBe(MESH_TOO_LARGE_DETAIL);

        const errorAction = findBuildError(dispatched);
        expect(errorAction).toExist();
        expect(errorAction.scenarioId).toBe(42);
        expect(errorAction.conflict).toBe(false);
    });

    it('renders the server detail verbatim for the live interceptor shape (status/data spread onto the error)', () => {
        const error = {
            status: 422,
            data: MESH_TOO_LARGE_PAYLOAD,
            originalError: new Error('Request failed with status code 422')
        };
        const dispatched = collectDispatched(buildScenarioError(42, error));

        const toast = findToast(dispatched);
        expect(toast).toExist();
        expect(toast.message).toBe(MESH_TOO_LARGE_DETAIL);

        const errorAction = findBuildError(dispatched);
        expect(errorAction).toExist();
        expect(errorAction.conflict).toBe(false);
    });

    it('falls back to the prefixed message when there is no response at all (a network error)', () => {
        const dispatched = collectDispatched(buildScenarioError(42, { message: 'Network Error' }));

        const toast = findToast(dispatched);
        expect(toast).toExist();
        expect(toast.message).toInclude('Error starting build:');
        expect(toast.message).toInclude('Network Error');
    });

    it('still treats a 409 as benign — no toast, conflict flagged with the in-flight run (TASK-2079 unchanged)', () => {
        const error = {
            status: 409,
            data: { status: 'building', run_id: 501, detail: 'A build is already in progress for this scenario.' }
        };
        const dispatched = collectDispatched(buildScenarioError(55, error));

        expect(findToast(dispatched)).toNotExist();

        const errorAction = findBuildError(dispatched);
        expect(errorAction).toExist();
        expect(errorAction.scenarioId).toBe(55);
        expect(errorAction.conflict).toBe(true);
        expect(errorAction.runId).toBe(501);
        expect(errorAction.runStatus).toBe('building');
        expect(errorAction.detail).toBe('A build is already in progress for this scenario.');
    });
});
