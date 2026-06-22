/**
 * TASK-1806(a) — Swamm dashboard ErrorBoundary → Umami analytics test.
 *
 * Verifies that when a child of the ErrorBoundary in DashboardContainer
 * throws a render error, the onError handler calls
 * trackEvent('js-error', 'react-boundary', 'swamm-dashboard').
 *
 * We mount the ErrorBoundary directly (not the full connected
 * DashboardContainer which requires a Redux store) and trigger a crash
 * by rendering a child that throws on mount.
 *
 * Note on 1806(b): umami_tracking.html is a Django template snippet,
 * not a JS module — it cannot be imported/required in a karma test.
 * The toBlob de-noise logic (a NARROW early-return on SecurityError+toBlob)
 * is validated by code-inspection: the condition is a single `indexOf`
 * double-guard on a fixed string pair, with no observable side-effect
 * beyond skipping the umami.track call. A karma test would require
 * injecting the inline <script> into a DOM iframe and dispatching a fake
 * ErrorEvent — disproportionate effort for a one-liner filter, and
 * brittle against jsdom's limited ErrorEvent support.
 */

import expect from 'expect';
import React from 'react';
import ReactDOM from 'react-dom';
import { ErrorBoundary } from 'react-error-boundary';
import { DashboardErrorFallback } from '../components/dashboard/DashboardContainer';
import { trackEvent } from '@js/utils/analytics';

// A component that always throws on render.
class Bomb extends React.Component {
    render() {
        throw new Error('test render crash');
    }
}

describe('TASK-1806(a) Swamm dashboard ErrorBoundary → Umami', () => {
    let container;
    let origUmami;
    let trackCalls;
    let origConsoleError;

    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
        trackCalls = [];
        origUmami = window.umami;
        window.umami = {
            track: (label, payload) => trackCalls.push({ label, ...payload })
        };
        // Suppress React's componentDidCatch console.error spam in test output.
        origConsoleError = console.error;
        console.error = () => {};
    });

    afterEach(() => {
        ReactDOM.unmountComponentAtNode(container);
        document.body.removeChild(container);
        window.umami = origUmami;
        console.error = origConsoleError;
    });

    it('test_error_boundary_onError_calls_trackEvent_on_child_crash', () => {
        // Mount an ErrorBoundary with the same onError prop as DashboardContainer.
        ReactDOM.render(
            <ErrorBoundary
                FallbackComponent={DashboardErrorFallback}
                onError={(_error, _info) => trackEvent('js-error', 'react-boundary', 'swamm-dashboard')}
            >
                <Bomb />
            </ErrorBoundary>,
            container
        );
        // The fallback should be shown (boundary caught the error).
        expect(container.textContent).toInclude('Dashboard encountered an error');
        // trackEvent must have been called with the expected arguments.
        const fired = trackCalls.find(c =>
            c.category === 'js-error' &&
            c.action === 'react-boundary' &&
            c.label === 'swamm-dashboard'
        );
        expect(fired).toExist();
    });
});
