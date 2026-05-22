import React from "react";
const PropTypes = require('prop-types');
import Message from '@mapstore/framework/components/I18N/Message';
import {findScenarioStatus} from './scenarioHelpers';

/**
 * TASK-C-scenarios-miller Wave 3A — error-state strip for the
 * Status-and-actions Pane 3. Only renders when the scenario's resolved
 * lifecycle status is 'error'. Mirrors the Option A mockup's
 * `.error-strip` block (HTML lines 1505-1508) with uppercase head +
 * monospace `<code>` payload.
 *
 * Reads `scenario.latest_run.error_message` and surfaces it verbatim in
 * the `<code>` element, mirroring the legacy table cell. When the
 * latest_run has no message we fall back to the localised
 * `hydrata.anuga.statusError` string so the strip still anchors the
 * user's attention.
 */

const ScenarioErrorStrip = ({scenario}) => {
    if (!scenario) return null;
    const status = findScenarioStatus(scenario);
    if (status !== 'error') return null;

    const latestRun = scenario.latest_run || {};
    const errorMessage = latestRun.error_message || null;

    return (
        <div className="anuga-scenario-error-strip" role="alert">
            <div className="anuga-scenario-error-strip-head">
                <Message msgId="hydrata.anuga.runFailedHead" />
            </div>
            {errorMessage ? (
                <code className="anuga-scenario-error-strip-payload">{errorMessage}</code>
            ) : (
                <span className="anuga-scenario-error-strip-payload">
                    <Message msgId="hydrata.anuga.statusError" />
                </span>
            )}
        </div>
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
