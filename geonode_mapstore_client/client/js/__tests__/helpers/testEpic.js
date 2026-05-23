/*
 * Test helper: testEpic
 *
 * RxJS 5 epic test helper. Wraps the project's standard "dispatch input
 * action(s), collect N output actions, run an assertion callback" pattern.
 * The MapStore2 submodule already ships the canonical implementation at
 * web/client/epics/__tests__/epicTestUtils.js (`testEpic`); this helper re-uses
 * it (no parallel re-implementation) and surfaces assertion failures
 * synchronously when no `done` callback is supplied — the callback is run in
 * the subscribe handler so a thrown expectation propagates immediately.
 *
 * Signature matches the upstream util:
 *   testEpic(epic, count, action, callback, state?, done?, withCompleteAction?)
 *
 * No `-test` suffix → excluded from the karma collection glob.
 * Standalone module: imports only the MapStore2 epicTestUtils (a sibling test
 * util in the submodule, not one of our six helpers).
 */
import {
    testEpic as msTestEpic,
    addTimeoutEpic,
    TEST_TIMEOUT,
    testCombinedEpicStream
} from '../../../MapStore2/web/client/epics/__tests__/epicTestUtils';

/**
 * Test a single epic.
 * @param {function} epic   the epic under test.
 * @param {number|function} count number of output actions to await (or a
 *                                takeWhile predicate on each action).
 * @param {object|object[]} action the action(s) to dispatch into the epic.
 * @param {function} callback called with the collected output actions array.
 * @param {object|function} [state={}] redux state (or a getter).
 * @param {function} [done]  mocha async done; omit for synchronous assertion.
 * @param {boolean} [withCompleteAction=false] append a sentinel EPIC_COMPLETED.
 * @returns {object} the mock store used to drive the epic.
 */
export default function testEpic(epic, count, action, callback, state, done, withCompleteAction) {
    return msTestEpic(epic, count, action, callback, state, done, withCompleteAction);
}

// Re-export the companion utilities for convenience (combined-stream + timeout).
export { addTimeoutEpic, TEST_TIMEOUT, testCombinedEpicStream };
