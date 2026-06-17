/**
 * NetworksPane — self-contained Redux-connected component for the Networks pane.
 *
 * TASK-1440 (W9, ISSUE 16 item 2): Networks were removed from the Anuga Inputs
 * rail by TASK-1425. This component extracts the same markup that lived in
 * AnugaInputMenuClass.renderNetworksPane() and carries its OWN connect() so it
 * can be dropped into any plugin (here: the Hydrology panel) without re-plumbing
 * 9 props in the host container.
 *
 * Behaviour is identical to the old renderNetworksPane:
 *   - Settings cog → opens NetworkMenu (setNetworkMenu) + closes Anuga menu.
 *   - + button → create input field → dispatch createNetwork(title).
 *   - Three sub-sections: Catchments, Nodes, Links (each a MenuRow list).
 *   - isCreatingAnugaLayer spinner replaces the create input while in-flight.
 *
 * TASK-1453 (W6): Terrain selector added at the top as step 1 of the future
 * network-delineation flow:
 *   - Lists project terrains from state.anuga.resources.terrain.
 *   - Mirrors the selected Scenario's chosen input terrain by default
 *     (read-only reflection + a "manage in Inputs" link).
 *   - Allows an independent override via a <select>.
 *   - Delineation / network creation are labelled placeholders for the future
 *     Networks epic; they are NOT built here.
 */
import React from 'react';
import {connect} from 'react-redux';
import PropTypes from 'prop-types';
const Spinner = require('react-spinkit');

import {MenuRow} from '../SimpleView/components/simpleViewMenuRow';
import Message from '@mapstore/framework/components/I18N/Message';
import {trackEvent} from '@js/utils/analytics';

import {
    createNetwork,
    setNetworkMenu,
    setAnugaInputMenu,
    setCreatingAnugaLayer
} from '../Anuga/actionsAnuga';
import {canEditAnugaMap, getSelectedScenario} from '../Anuga/selectorsAnuga';

// ---------------------------------------------------------------------------
// TerrainSelector — shown at the top of the Networks pane (step 1 framing).
// Pure functional component so it is independently testable.
// ---------------------------------------------------------------------------

export const TerrainSelector = ({
    terrainList,
    scenarioTerrainId,
    selectedTerrainId,
    onSelectTerrain,
    onManageInInputs
}) => {
    // TASK-1461 (fold-in): use explicit null/undefined checks — NEVER bare
    // truthiness — so a terrain with id=0 is a real selection, not treated as
    // "unset". null/undefined correctly means "no override set".
    // The effective terrain is the override (if set) or the scenario's terrain.
    // Note: `'' ` (empty string reset) is the sentinel for "use scenario default".
    const hasSelectedOverride = selectedTerrainId !== null && selectedTerrainId !== undefined;
    const hasScenarioTerrain = scenarioTerrainId !== null && scenarioTerrainId !== undefined;
    const effectiveId = hasSelectedOverride ? selectedTerrainId : (hasScenarioTerrain ? scenarioTerrainId : '');

    // Find the scenario terrain name for the read-only mirror label.
    const scenarioTerrain = (terrainList || []).find(t => t.id === scenarioTerrainId);

    // hasOverride = user has picked a terrain different from the scenario default.
    // id===0 is a valid selection; distinguish it from null/undefined (unset).
    const hasOverride = hasSelectedOverride && selectedTerrainId !== scenarioTerrainId;

    return (
        <div className="networks-terrain-selector" data-testid="networks-terrain-selector">
            {/* Step 1 heading */}
            <div className="networks-terrain-step-heading">
                <span className="glyphicon glyphicon-map-marker" aria-hidden="true" />
                &nbsp;
                <strong><Message msgId="hydrata.hydrology.networksStep1Terrain" /></strong>
            </div>

            {/* Read-only mirror of scenario terrain */}
            <div className="networks-terrain-mirror-row">
                <span className="networks-terrain-mirror-label">
                    <Message msgId="hydrata.hydrology.networksScenarioTerrain" />
                    {': '}
                </span>
                {scenarioTerrain
                    ? (
                        <span className="networks-terrain-mirror-value" data-testid="scenario-terrain-name">
                            {scenarioTerrain.title || scenarioTerrain.name}
                        </span>
                    )
                    : (
                        <em className="networks-terrain-mirror-none" data-testid="no-scenario-terrain">
                            <Message msgId="hydrata.hydrology.networksNoScenarioTerrain" />
                        </em>
                    )
                }
                {/* Manage-in-Inputs link (navigates user back to the Anuga Inputs tab) */}
                <a
                    href="#"
                    className="networks-terrain-manage-link"
                    data-testid="manage-in-inputs-link"
                    onClick={(e) => {
                        e.preventDefault();
                        if (onManageInInputs) onManageInInputs();
                        trackEvent('button', 'click', 'hydrology-networks-manage-in-inputs');
                    }}
                >
                    &nbsp;(<Message msgId="hydrata.hydrology.networksManageInInputs" />)
                </a>
            </div>

            {/* Override select */}
            <div className="networks-terrain-override-row">
                <label htmlFor="networks-terrain-override-select" className="networks-terrain-override-label">
                    <Message msgId="hydrata.hydrology.networksTerrainOverride" />
                </label>
                <select
                    id="networks-terrain-override-select"
                    className="networks-terrain-select form-control"
                    data-testid="terrain-override-select"
                    value={effectiveId}
                    onChange={(e) => {
                        const val = e.target.value;
                        if (onSelectTerrain) {
                            // Empty string = reset to scenario default (null override).
                            onSelectTerrain(val === '' ? null : Number(val));
                        }
                        trackEvent('select', 'change', 'hydrology-networks-terrain-override');
                    }}
                >
                    {/* Empty option = use scenario terrain (plain string; <Message> renders a span, invalid in <option>) */}
                    <option value="">—</option>
                    {/* TASK-1503: prefer title (human-readable) over name (raw GeoNode slug).
                        name is the BE-serialized field (= title) for FE compat. */}
                    {(terrainList || []).map(t => (
                        <option key={t.id} value={t.id}>
                            {t.title || t.name || `Terrain ${t.id}`}
                        </option>
                    ))}
                </select>
                {hasOverride && (
                    <span className="networks-terrain-override-badge" data-testid="override-badge">
                        <Message msgId="hydrata.hydrology.networksTerrainOverrideActive" />
                    </span>
                )}
            </div>

            {/* Empty-state hint when no terrains exist */}
            {(!terrainList || terrainList.length === 0) && (
                <div className="networks-terrain-empty-hint" data-testid="no-terrains-hint">
                    <em><Message msgId="hydrata.hydrology.networksNoTerrains" /></em>
                </div>
            )}

            {/* Deferred delineation placeholder — future Networks epic */}
            <div className="networks-delineation-placeholder" data-testid="delineation-placeholder">
                <span className="glyphicon glyphicon-info-sign" aria-hidden="true" />
                &nbsp;
                <em><Message msgId="hydrata.hydrology.networksDelineationPlaceholder" /></em>
            </div>
        </div>
    );
};

TerrainSelector.propTypes = {
    terrainList: PropTypes.array,
    scenarioTerrainId: PropTypes.number,
    selectedTerrainId: PropTypes.number,
    onSelectTerrain: PropTypes.func,
    // onManageInInputs: called when user clicks the "manage in Inputs" link.
    // NetworksPaneClass wires this to open the Anuga Inputs panel.
    onManageInInputs: PropTypes.func
};

TerrainSelector.defaultProps = {
    terrainList: [],
    scenarioTerrainId: null,
    selectedTerrainId: null,
    onManageInInputs: null
};

// ---------------------------------------------------------------------------
// NetworksPaneClass (TASK-1440 + TASK-1453)
// ---------------------------------------------------------------------------

class NetworksPaneClass extends React.Component {
    static propTypes = {
        // Terrain (TASK-1453)
        terrainList: PropTypes.array,
        scenarioTerrainId: PropTypes.number,
        // Catchments / nodes / links (TASK-1440)
        catchmentLayers: PropTypes.array,
        nodesLayers: PropTypes.array,
        linksLayers: PropTypes.array,
        // Actions
        createNetwork: PropTypes.func,
        setNetworkMenu: PropTypes.func,
        setAnugaInputMenu: PropTypes.func,
        setCreatingAnugaLayer: PropTypes.func,
        canEditAnugaMap: PropTypes.bool,
        isCreatingAnugaLayer: PropTypes.bool
    };

    static defaultProps = {};

    constructor(props) {
        super(props);
        this.state = {
            inputVisible: false,
            networkTitle: '',
            // TASK-1453: null = use scenario terrain (mirror); a number = override.
            selectedTerrainId: null
        };
    }

    _handleCreateClick = () => {
        if (!this.state.inputVisible) {
            this.setState({inputVisible: true});
        } else if (this.state.networkTitle) {
            this.props.setCreatingAnugaLayer(true);
            this.props.createNetwork(this.state.networkTitle);
            this.setState({networkTitle: ''});
            trackEvent('button', 'click', 'hydrology-networks-create-network');
        } else {
            this.setState({inputVisible: false});
        }
    };

    _handleEscape = () => {
        this.setState({inputVisible: false, networkTitle: ''});
    };

    _handleSelectTerrain = (terrainId) => {
        this.setState({selectedTerrainId: terrainId});
    };

    componentDidUpdate(prevProps) {
        // Close the input when createNetwork completes (isCreatingAnugaLayer falls back to false).
        if (prevProps.isCreatingAnugaLayer && !this.props.isCreatingAnugaLayer) {
            // eslint-disable-next-line react/no-did-update-set-state -- gated on flag flip
            this.setState({inputVisible: false});
        }
    }

    render() {
        const {inputVisible, networkTitle, selectedTerrainId} = this.state;
        const {canEditAnugaMap: canEdit, isCreatingAnugaLayer, terrainList, scenarioTerrainId} = this.props;

        const actions = (
            <React.Fragment>
                <span
                    className={'btn glyphicon sv-menu-row-glyph sv-glyph-settings glyphicon-cog'}
                    title="Network settings"
                    onClick={() => {
                        this.props.setNetworkMenu(true);
                        this.props.setAnugaInputMenu(false);
                        trackEvent('button', 'click', 'hydrology-networks-show-network-menu');
                    }}
                />
                {canEdit ? (
                    <React.Fragment>
                        <span
                            className={`btn glyphicon sv-menu-row-glyph sv-glyph-active ${inputVisible ? 'glyphicon-ok' : 'glyphicon-plus'}`}
                            onClick={this._handleCreateClick}
                            aria-label={inputVisible ? 'Save' : 'Add new'}
                        />
                        {isCreatingAnugaLayer ? (
                            <Spinner color="white" className="anuga-spinner" spinnerName="circle" noFadeIn/>
                        ) : inputVisible ? (
                            <input
                                id="networks-pane-network-input"
                                key="networks-pane-network-input"
                                className={'sv-data-title-input'}
                                type={'text'}
                                value={networkTitle}
                                onChange={(e) => this.setState({networkTitle: e.target.value})}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && networkTitle) {
                                        e.preventDefault();
                                        this._handleCreateClick();
                                    } else if (e.key === 'Escape') {
                                        e.preventDefault();
                                        this._handleEscape();
                                    }
                                }}
                                autoFocus
                            />
                        ) : null}
                    </React.Fragment>
                ) : null}
            </React.Fragment>
        );

        return (
            <div className="sv-menu-rows-pane anuga-pane hydrology-networks-pane">
                {/* TASK-1453: Terrain selector — step 1 of future network delineation */}
                <TerrainSelector
                    terrainList={terrainList}
                    scenarioTerrainId={scenarioTerrainId}
                    selectedTerrainId={selectedTerrainId}
                    onSelectTerrain={this._handleSelectTerrain}
                    onManageInInputs={() => this.props.setAnugaInputMenu(true)}
                />

                {/* Pane header — mirrors anugaInputMenu's renderPaneHead for 'networks' */}
                <div className="anuga-pane-toolbar">
                    <h3 className="anuga-pane-head-title">
                        <Message msgId="hydrata.anuga.networks" />
                    </h3>
                    <span className="anuga-pane-head-actions">{actions}</span>
                </div>

                {/* TASK-1440: Catchments / Nodes / Links read-only display */}
                <div className="anuga-pane-rows">
                    <div className={'sv-menu-row-mini-container'}>
                        <p className={'sv-menu-row-mini-heading'}><Message msgId="hydrata.anuga.catchments" /></p>
                        {(this.props.catchmentLayers || []).map(c => <MenuRow key={c?.name || c?.id} layer={c}/>)}
                    </div>
                    <div className={'sv-menu-row-mini-container'}>
                        <p className={'sv-menu-row-mini-heading'}><Message msgId="hydrata.anuga.nodes" /></p>
                        {(this.props.nodesLayers || []).map(n => <MenuRow key={n?.name || n?.id} layer={n}/>)}
                    </div>
                    <div className={'sv-menu-row-mini-container'}>
                        <p className={'sv-menu-row-mini-heading'}><Message msgId="hydrata.anuga.links" /></p>
                        {(this.props.linksLayers || []).map(l => <MenuRow key={l?.name || l?.id} layer={l}/>)}
                    </div>
                </div>
            </div>
        );
    }
}

const mapStateToProps = (state) => {
    const selectedScenario = getSelectedScenario(state);
    return {
        // TASK-1453: terrain list + scenario terrain (for mirror default).
        terrainList: state?.anuga?.resources?.terrain || [],
        // scenario.terrain is the terrain FK id (number or '' when unset).
        scenarioTerrainId: selectedScenario?.terrain ? Number(selectedScenario.terrain) : null,
        // TASK-1440: catchments / nodes / links.
        catchmentLayers: state?.layers?.flat?.filter(l => l?.group === 'Input Data.Catchments') || [],
        nodesLayers: state?.layers?.flat?.filter(l => l?.group === 'Input Data.Nodes') || [],
        linksLayers: state?.layers?.flat?.filter(l => l?.group === 'Input Data.Links') || [],
        isCreatingAnugaLayer: state?.anuga?.ui?.isCreatingAnugaLayer || false,
        canEditAnugaMap: canEditAnugaMap(state)
    };
};

const mapDispatchToProps = (dispatch) => ({
    createNetwork: (title) => dispatch(createNetwork(title)),
    setNetworkMenu: (visible) => dispatch(setNetworkMenu(visible)),
    setAnugaInputMenu: (visible) => dispatch(setAnugaInputMenu(visible)),
    setCreatingAnugaLayer: (v) => dispatch(setCreatingAnugaLayer(v))
});

const NetworksPane = connect(mapStateToProps, mapDispatchToProps)(NetworksPaneClass);

export {NetworksPane, NetworksPaneClass};
export default NetworksPane;
