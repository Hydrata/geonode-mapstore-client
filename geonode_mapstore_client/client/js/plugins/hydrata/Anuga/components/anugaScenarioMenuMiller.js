import React from "react";
import {connect} from "react-redux";
const PropTypes = require('prop-types');
import '../anuga.css';
import '../../SimpleView/simpleView.css';

import Message from '@mapstore/framework/components/I18N/Message';
import {
  selectAnugaScenario,
  toggleScenarioSelected
} from "../actionsAnuga";
import {getSelectedScenario} from "../selectorsAnuga";
import {ScenarioRail} from './scenarioRail';

/**
 * TASK-C-scenarios-miller — Miller-columns container for the ANUGA scenarios
 * panel. Mirrors the panel chrome shipped by anugaInputMenu.js (Anuga-themed
 * `.simple-view-panel--miller` shell). The container owns:
 *
 *   - `selectedCategoryId` local state (Inputs / Advanced / Run / Actions
 *     subtabs — W2 wires the pane).
 *   - `compareMode` local state (rail-item checkboxes visibility).
 *   - Container-level inline-confirm dialog state — W2 wires the dialogs.
 *
 * Redux reads (W1 scope): scenarios array, selectedId, currentUserId.
 * Redux dispatches (W1 scope): selectAnugaScenario, toggleScenarioSelected.
 *
 * W3 cutover replaces anugaScenarioMenu.js with this Miller shell and
 * removes the legacy table + ScenarioTableRow.
 */
class AnugaScenarioMenuMillerClass extends React.Component {
  static propTypes = {
    scenarios: PropTypes.array,
    selectedScenario: PropTypes.object,
    currentUserId: PropTypes.number,
    selectAnugaScenario: PropTypes.func,
    toggleScenarioSelected: PropTypes.func
  };

  static defaultProps = {
    scenarios: []
  };

  constructor(props) {
    super(props);
    this.state = {
      // Default subtab — operators land on Inputs (terrain/boundary/inflow/rainfall).
      selectedCategoryId: 'inputs',
      // Compare-mode toggle — header chip flips this; rail items render
      // a checkbox on the leading edge when true.
      compareMode: false
    };
  }

  // eslint-disable-next-line react/no-deprecated -- componentWillMount-free; we use componentDidMount.
  componentDidMount() {
    // R: when the panel mounts and the rail has at least one scenario, but
    // the redux selectedId is unset, pre-select the first scenario so the
    // pane is never blank for the operator. The legacy table did not have
    // a selected concept (every row was always visible), so this is new
    // behaviour gated on Miller-layout only.
    const {scenarios, selectedScenario} = this.props;
    if (!selectedScenario && scenarios && scenarios.length > 0) {
      if (this.props.selectAnugaScenario) {
        this.props.selectAnugaScenario(scenarios[0]);
      }
    }
  }

  componentDidUpdate(prevProps) {
    // After polling refreshes the scenarios slice, if the previously-selected
    // scenario has been removed (e.g. delete) and there's no current
    // selection, auto-select the first remaining scenario.
    const {scenarios, selectedScenario} = this.props;
    if (!selectedScenario && scenarios && scenarios.length > 0) {
      const hadNoScenarios = !prevProps.scenarios || prevProps.scenarios.length === 0;
      const hadDifferentSelected = prevProps.selectedScenario && !selectedScenario;
      if (hadNoScenarios || hadDifferentSelected) {
        if (this.props.selectAnugaScenario) {
          this.props.selectAnugaScenario(scenarios[0]);
        }
      }
    }
  }

  handleSelect = (scenario) => {
    if (this.props.selectAnugaScenario) {
      this.props.selectAnugaScenario(scenario);
    }
  };

  handleToggleSelected = (scenario) => {
    if (this.props.toggleScenarioSelected) {
      this.props.toggleScenarioSelected(scenario);
    }
  };

  renderRail() {
    const {scenarios, selectedScenario, currentUserId} = this.props;
    const selectedId = selectedScenario ? (selectedScenario.id || selectedScenario._tempId) : null;
    return (
      <ScenarioRail
        scenarios={scenarios}
        selectedId={selectedId}
        compareMode={this.state.compareMode}
        currentUserId={currentUserId}
        onSelect={this.handleSelect}
        onToggleSelected={this.handleToggleSelected}
      />
    );
  }

  renderPane() {
    // W2 replaces this with the per-category pane content. Today it's a
    // structural placeholder so the rail-pane shell has a sibling and W1
    // tests can assert the .menu-rows-pane selector.
    const {selectedScenario} = this.props;
    return (
      <div className={'menu-rows-pane anuga-pane anuga-scenario-pane'}>
        {selectedScenario ?
          <div className={'anuga-scenario-pane-placeholder'}>
            <span>{selectedScenario.name || ''}</span>
          </div> :
          <div className={'anuga-scenario-empty-pane'}>
            <Message msgId="hydrata.anuga.scenarios" />
          </div>
        }
      </div>
    );
  }

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
            {this.renderRail()}
            {this.renderPane()}
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
    scenarios,
    selectedScenario: getSelectedScenario(state),
    currentUserId: state?.security?.user?.pk
  };
};

const mapDispatchToProps = (dispatch) => ({
  selectAnugaScenario: (scenario) => dispatch(selectAnugaScenario(scenario)),
  toggleScenarioSelected: (scenario) => dispatch(toggleScenarioSelected(scenario))
});

const AnugaScenarioMenuMiller = connect(mapStateToProps, mapDispatchToProps)(AnugaScenarioMenuMillerClass);

export {
  AnugaScenarioMenuMiller,
  AnugaScenarioMenuMillerClass
};
