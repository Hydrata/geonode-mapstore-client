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
import {canEditAnugaMap} from '../Anuga/selectorsAnuga';

class NetworksPaneClass extends React.Component {
    static propTypes = {
        catchmentLayers: PropTypes.array,
        nodesLayers: PropTypes.array,
        linksLayers: PropTypes.array,
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
            networkTitle: ''
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

    componentDidUpdate(prevProps) {
        // Close the input when createNetwork completes (isCreatingAnugaLayer falls back to false).
        if (prevProps.isCreatingAnugaLayer && !this.props.isCreatingAnugaLayer) {
            // eslint-disable-next-line react/no-did-update-set-state -- gated on flag flip
            this.setState({inputVisible: false});
        }
    }

    render() {
        const {inputVisible, networkTitle} = this.state;
        const {canEditAnugaMap: canEdit, isCreatingAnugaLayer} = this.props;

        const actions = (
            <React.Fragment>
                <span
                    className={'btn glyphicon menu-row-glyph glyph-settings glyphicon-cog'}
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
                            className={`btn glyphicon menu-row-glyph glyph-active ${inputVisible ? 'glyphicon-ok' : 'glyphicon-plus'}`}
                            onClick={this._handleCreateClick}
                            aria-label={inputVisible ? 'Save' : 'Add new'}
                        />
                        {isCreatingAnugaLayer ? (
                            <Spinner color="white" className="anuga-spinner" spinnerName="circle" noFadeIn/>
                        ) : inputVisible ? (
                            <input
                                id="networks-pane-network-input"
                                key="networks-pane-network-input"
                                className={'data-title-input'}
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
            <div className="menu-rows-pane anuga-pane hydrology-networks-pane">
                {/* Pane header — mirrors anugaInputMenu's renderPaneHead for 'networks' */}
                <div className="anuga-pane-toolbar">
                    <h3 className="anuga-pane-head-title">
                        <Message msgId="hydrata.anuga.networks" />
                    </h3>
                    <span className="anuga-pane-head-actions">{actions}</span>
                </div>
                <div className="anuga-pane-rows">
                    <div className={'menu-row-mini-container'}>
                        <p className={'menu-row-mini-heading'}><Message msgId="hydrata.anuga.catchments" /></p>
                        {(this.props.catchmentLayers || []).map(c => <MenuRow key={c?.name || c?.id} layer={c}/>)}
                    </div>
                    <div className={'menu-row-mini-container'}>
                        <p className={'menu-row-mini-heading'}><Message msgId="hydrata.anuga.nodes" /></p>
                        {(this.props.nodesLayers || []).map(n => <MenuRow key={n?.name || n?.id} layer={n}/>)}
                    </div>
                    <div className={'menu-row-mini-container'}>
                        <p className={'menu-row-mini-heading'}><Message msgId="hydrata.anuga.links" /></p>
                        {(this.props.linksLayers || []).map(l => <MenuRow key={l?.name || l?.id} layer={l}/>)}
                    </div>
                </div>
            </div>
        );
    }
}

const mapStateToProps = (state) => ({
    catchmentLayers: state?.layers?.flat?.filter(l => l?.group === 'Input Data.Catchments') || [],
    nodesLayers: state?.layers?.flat?.filter(l => l?.group === 'Input Data.Nodes') || [],
    linksLayers: state?.layers?.flat?.filter(l => l?.group === 'Input Data.Links') || [],
    isCreatingAnugaLayer: state?.anuga?.ui?.isCreatingAnugaLayer || false,
    canEditAnugaMap: canEditAnugaMap(state)
});

const mapDispatchToProps = (dispatch) => ({
    createNetwork: (title) => dispatch(createNetwork(title)),
    setNetworkMenu: (visible) => dispatch(setNetworkMenu(visible)),
    setAnugaInputMenu: (visible) => dispatch(setAnugaInputMenu(visible)),
    setCreatingAnugaLayer: (v) => dispatch(setCreatingAnugaLayer(v))
});

const NetworksPane = connect(mapStateToProps, mapDispatchToProps)(NetworksPaneClass);

export {NetworksPane, NetworksPaneClass};
export default NetworksPane;
