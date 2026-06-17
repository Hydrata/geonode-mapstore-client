import React from "react";
const PropTypes = require('prop-types');
import Message from '@mapstore/framework/components/I18N/Message';
import {ErrorStrip} from '../../SimpleView/components/primitives';
import {findScenarioStatus} from './scenarioHelpers';

/**
 * TASK-C-scenarios-miller Wave 3A — error-state strip for the
 * Status-and-actions Pane 3. Only renders when the scenario's resolved
 * lifecycle status is 'error'.
 *
 * TASK-1730 (Phase-C rollout) — PARITY-migrated onto the shared
 * {ErrorStrip} primitive. The primitive was harvested FROM this very
 * `.sv-anuga-scenario-error-strip` (left-border red + tinted bg + uppercase
 * head + monospace `<code>` payload), so the structure is unchanged: the
 * outer `role="alert"` div is preserved and still carries the
 * `sv-anuga-scenario-error-strip` class (via `extraClassName`) for the legacy
 * CSS + scenarioPane assertions, while the inner head/payload hooks
 * canonicalise to `sv-error-strip-head` / `sv-error-strip-payload`.
 *
 * Reads `scenario.latest_run.error_message` and surfaces it verbatim in
 * the `<code>` payload, mirroring the legacy table cell. When the
 * latest_run has no message we fall back to the localised
 * `hydrata.anuga.statusError` string so the strip still anchors the
 * user's attention (the primitive renders the fallback as a `<code>`
 * payload too — a one-element-name change from the legacy `<span>`,
 * structure otherwise identical).
 */

const ScenarioErrorStrip = ({scenario}) => {
    if (!scenario) return null;
    const status = findScenarioStatus(scenario);
    if (status !== 'error') return null;

    const latestRun = scenario.latest_run || {};
    const errorMessage = latestRun.error_message || null;

    return (
        <ErrorStrip
            extraClassName="sv-anuga-scenario-error-strip"
            head={<Message msgId="hydrata.anuga.runFailedHead" />}
            payload={errorMessage || <Message msgId="hydrata.anuga.statusError" />}
        />
    );
};

ScenarioErrorStrip.propTypes = {
    scenario: PropTypes.object
};

// Wave 3D Tier B7 — error strip is pure on its scenario prop and only
// renders when the scenario lifecycle resolves to 'error'. Default shallow
// comparator is sufficient.
const MemoScenarioErrorStrip = React.memo(ScenarioErrorStrip);

export {MemoScenarioErrorStrip as ScenarioErrorStrip};
