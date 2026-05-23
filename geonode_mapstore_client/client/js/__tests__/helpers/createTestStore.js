/*
 * Test helper: createTestStore
 *
 * Factory returning a redux store for unit tests. Matches the most common
 * hand-rolled shape across the suite (a `reducers` map + optional preloaded
 * state + optional extra middleware). Reducers may be supplied as a single
 * reducer function, a map of slice reducers (combined here), or omitted (in
 * which case a frozen-state passthrough store is returned, mirroring the
 * `createStore(() => state)` pattern in simpleViewUploader-test.js).
 *
 * No `-test` suffix → excluded from the karma `/-test\.jsx?$/` collection glob.
 * Standalone module: imports only redux, never another helper.
 */
import { createStore, combineReducers, applyMiddleware } from 'redux';

/**
 * @param {object} [options]
 * @param {function|object} [options.reducers]   single reducer fn, or a map of
 *                                                slice reducers to combine. If
 *                                                omitted, the store replays
 *                                                `preloadedState` verbatim.
 * @param {object}          [options.preloadedState] initial state tree.
 * @param {function[]}      [options.middleware] redux middleware (e.g. an
 *                                                epic middleware) to apply.
 * @returns {import('redux').Store} a real redux store usable with <Provider>.
 */
export default function createTestStore({
    reducers,
    preloadedState = {},
    middleware = []
} = {}) {
    let rootReducer;
    if (typeof reducers === 'function') {
        rootReducer = reducers;
    } else if (reducers && typeof reducers === 'object') {
        rootReducer = combineReducers(reducers);
    } else {
        // Passthrough: state never changes, dispatch is a no-op reducer.
        // Mirrors `createStore(() => state)` used by existing tests for
        // components that only read from the store.
        rootReducer = (state = preloadedState) => state;
    }
    const enhancer = middleware && middleware.length
        ? applyMiddleware(...middleware)
        : undefined;
    return createStore(rootReducer, preloadedState, enhancer);
}
