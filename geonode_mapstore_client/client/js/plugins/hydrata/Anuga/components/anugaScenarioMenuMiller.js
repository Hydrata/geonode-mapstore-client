import React from "react";
import {connect} from "react-redux";
const PropTypes = require('prop-types');
import '../anuga.css';
import '../../SimpleView/simpleView.css';

import Message from '@mapstore/framework/components/I18N/Message';

/**
 * TASK-C-scenarios-miller W0 — placeholder Miller-columns container for the
 * upcoming ANUGA scenarios refactor. Mirrors the panel chrome shipped by
 * anugaInputMenu.js (Anuga-themed `.simple-view-panel--miller` shell) so the
 * W1/W2 rail + pane components have a stable mount target.
 *
 * Production rendering still flows through the legacy `AnugaScenarioMenu`
 * (table-driven, anugaScenarioMenu.js + ScenarioTableRow.js) — anugaContainer
 * has not been switched yet. This file is exercised by the W0 Karma scaffold
 * test only; W3 cutover replaces anugaScenarioMenu.js with this Miller shell.
 */
class AnugaScenarioMenuMillerClass extends React.Component {
  static propTypes = {
    scenarios: PropTypes.array
  };

  static defaultProps = {
    scenarios: []
  };

  render() {
    return (
      <div
        id={'anuga-scenario-menu'}
        className={'simple-view-panel anuga-panel simple-view-panel--miller anuga-scenario-miller'}
      >
        <div className={'menu-rows-container'}>
          <div className={"row menu-row menu-row-header anuga-section-header scenario-menu-header"}>
            <Message msgId="hydrata.anuga.scenarios" />
          </div>
          <div className={'sv-rail-pane-shell'}>
            <div className={'sv-category-rail anuga-scenario-rail'} role={'tablist'}>
              {/* W1 populates rail items */}
            </div>
            <div className={'menu-rows-pane anuga-pane anuga-scenario-pane'}>
              {/* W2 populates pane subtabs */}
            </div>
          </div>
        </div>
      </div>
    );
  }
}

const mapStateToProps = (state) => {
  const byId = state?.anuga?.scenarios?.byId || {};
  const allIds = state?.anuga?.scenarios?.allIds || [];
  const scenarios = allIds.map(id => byId[id]).filter(Boolean).sort((a, b) => {
    const aId = a.id || 0;
    const bId = b.id || 0;
    return aId - bId;
  });
  return {
    scenarios
  };
};

const mapDispatchToProps = () => ({});

const AnugaScenarioMenuMiller = connect(mapStateToProps, mapDispatchToProps)(AnugaScenarioMenuMillerClass);

export {
  AnugaScenarioMenuMiller,
  AnugaScenarioMenuMillerClass
};
