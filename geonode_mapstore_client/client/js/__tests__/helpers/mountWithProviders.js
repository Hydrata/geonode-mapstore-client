/*
 * Test helper: mountWithProviders
 *
 * Wraps @testing-library/react's `render` with a redux <Provider>. Pass either
 * an existing `store`, or a `state` object (a minimal passthrough store is
 * built for read-only components, matching the `createStore(() => state)`
 * convention used elsewhere in the suite). All other render options are passed
 * through to @testing-library/react untouched.
 *
 * @testing-library/react@12.1.5 ships via the MapStore2 submodule.
 *
 * No `-test` suffix → excluded from the karma collection glob.
 * Standalone module: imports only react / react-redux / @testing-library/react.
 */
import React from 'react';
import { Provider } from 'react-redux';
import { render } from '@testing-library/react';

/**
 * @param {React.ReactElement} ui   the element under test.
 * @param {object} [options]
 * @param {import('redux').Store} [options.store]  an existing redux store.
 * @param {object} [options.state]  state for a passthrough store (used only
 *                                  when `store` is not supplied).
 * @param {...any} [options.renderOptions] forwarded to render (container, etc).
 * @returns {object} the @testing-library/react render result, plus `store`.
 */
export default function mountWithProviders(ui, {
    store,
    state = {},
    ...renderOptions
} = {}) {
    const reduxStore = store || {
        getState: () => state,
        subscribe: () => () => {},
        dispatch: () => {}
    };
    const Wrapper = ({ children }) => (
        <Provider store={reduxStore}>{children}</Provider>
    );
    const result = render(ui, { wrapper: Wrapper, ...renderOptions });
    return { ...result, store: reduxStore };
}
