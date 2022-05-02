import React from 'react';
import {connect} from 'react-redux';
const PropTypes = require('prop-types');
import {Button} from "react-bootstrap";

import {
    initAnuga,
    setAnugaInputMenu,
    setAnugaScenarioMenu,
    setAnugaResultMenu,
    startAnugaScenarioPolling,
    stopAnugaScenarioPolling
} from '../actionsAnuga';
import {AnugaInputMenu} from './AnugaInputMenu';
import {AnugaScenarioMenu} from './AnugaScenarioMenu';
import {AnugaScenarioLogViewer} from "./anugaScenarioLogViewer";
import {setOpenMenuGroupId} from "../../SimpleView/actionsSimpleView";
import '../anuga.css';
import '../../SimpleView/simpleView.css';
import {updateCustomEditorsOptions} from "../../../../../MapStore2/web/client/actions/featuregrid";

class AnugaContainer extends React.Component {
    static propTypes = {
        initAnuga: PropTypes.func,
        showAnugaInputMenu: PropTypes.bool,
        setAnugaInputMenu: PropTypes.func,
        showAnugaScenarioMenu: PropTypes.bool,
        setAnugaScenarioMenu: PropTypes.func,
        showAnugaResultMenu: PropTypes.bool,
        setAnugaResultMenu: PropTypes.func,
        isAnugaMenuOpen: PropTypes.bool,
        openMenuGroupId: PropTypes.string,
        numberOfMenus: PropTypes.number,
        setOpenMenuGroupId: PropTypes.func,
        showAddAnugaElevationData: PropTypes.bool,
        setAddAnugaElevation: PropTypes.func,
        visibleAnugaScenarioLogId: PropTypes.number,
        startAnugaScenarioPolling: PropTypes.func,
        stopAnugaScenarioPolling: PropTypes.func,
        updateCustomEditorsOptions: PropTypes.func,
        logText: PropTypes.string
    };

    static defaultProps = {
    };

    editorOptions = {
        "rules": [
            {
                "regex": {
                    "attribute": "boundary",
                    "typeName": "^geonode:bdy_"
                },
                "editor": "BoundaryTypeEditor",
                "editorProps": {
                    "values": ["Dirichlet", "Transmissive", "Reflective"],
                    "forceSelection": true,
                    "defaultOption": "Dirichlet",
                    "allowEmpty": false
                }
            },
            {
                "regex": {
                    "attribute": "location",
                    "typeName": "^geonode:bdy_"
                },
                "editor": "BoundaryLocationEditor",
                "editorProps": {
                    "values": ["External", "Internal"],
                    "forceSelection": true,
                    "defaultOption": "External",
                    "allowEmpty": false
                }
            },
            {
                "regex": {
                    "attribute": "type",
                    "typeName": "^geonode:inf_"
                },
                "editor": "InflowEditor",
                "editorProps": {
                    "values": ["Rainfall", "Surface"],
                    "forceSelection": true,
                    "defaultOption": "Rainfall",
                    "allowEmpty": false
                }
            },
            {
                "regex": {
                    "attribute": "method",
                    "typeName": "^geonode:str_"
                },
                "editor": "StructureEditor",
                "editorProps": {
                    "values": ["Holes", "Reflective", "Mannings"],
                    "forceSelection": true,
                    "defaultOption": "Mannings",
                    "allowEmpty": false
                }
            },
        ]
    }

    constructor(props) {
        super(props);
    }

    componentDidMount() {
        this.props.initAnuga();
        this.props.updateCustomEditorsOptions(this.editorOptions);
    }

    render() {
        return this.props.isAnugaProject ?
            (
                <div id={"anuga-container"}>
                    <div id={"anuga-inputs"}>
                        <button
                            key="anuga-input-button"
                            className={'simple-view-menu-button'}
                            style={{left: (this.props.numberOfMenus * 100) + 20}}
                            onClick={() => {
                                this.props.setAnugaInputMenu(!this.props.showAnugaInputMenu);
                                this.props.setOpenMenuGroupId(null);
                            }}
                        >
                            Inputs
                        </button>
                    </div>
                    {
                        this.props.showAnugaInputMenu ?
                            <AnugaInputMenu/>
                            : null
                    }
                    <div id={"anuga-scenario"}>
                        <button
                            key="anuga-scenario-button"
                            className={'simple-view-menu-button'}
                            style={{left: (this.props.numberOfMenus * 100) + 120}}
                            onClick={() => {
                                this.props.setAnugaScenarioMenu(!this.props.showAnugaScenarioMenu);
                                this.props.showAnugaScenarioMenu ? this.props.stopAnugaScenarioPolling() : this.props.startAnugaScenarioPolling();
                                this.props.setOpenMenuGroupId(null);
                            }}
                        >
                            Scenarios
                        </button>
                        {
                            this.props.showAnugaScenarioMenu ?
                                <AnugaScenarioMenu/>
                                : null
                        }
                    </div>
                    {
                        this.props.visibleAnugaScenarioLogId ?
                            <AnugaScenarioLogViewer logText={this.props.logText}/>
                            : null
                    }
                </div>
            ) :
            null;
    }
}

const mapStateToProps = (state) => {
    console.log('state for Anuga:', state);
    const isLatestRunValid = state?.anuga?.scenarios?.filter((scenario) => state?.anuga?.visibleAnugaScenarioLogId === scenario.id)[0]?.is_latest_run_valid;
    const logText = isLatestRunValid ?
        state?.anuga?.scenarios?.filter((scenario) => state?.anuga?.visibleAnugaScenarioLogId === scenario.id)[0]?.latest_run?.log || '-' :
        state?.anuga?.scenarios?.filter((scenario) => state?.anuga?.visibleAnugaScenarioLogId === scenario.id)[0]?.log || '-';
    // console.log('logText', logText);
    return {
        logText: logText,
        isAnugaProject: state?.anuga?.project?.id,
        anugaInputMenuGroupId: state?.layers?.groups?.filter((group) => group.title === "Input Data")[0]?.id,
        showAnugaInputMenu: state?.anuga?.showAnugaInputMenu,
        showAnugaScenarioMenu: state?.anuga?.showAnugaScenarioMenu,
        showAnugaResultMenu: state?.anuga?.showAnugaResultMenu,
        isAnugaMenuOpen: state?.anuga?.showAnugaInputMenu || state?.anuga?.showAnugaScenarioMenu || state?.anuga?.showAnugaResultMenu,
        openMenuGroupId: state?.simpleView?.openMenuGroupId,
        numberOfMenus: state?.layers?.groups?.length || 1,
        showAddAnugaElevationData: state?.anuga?.showAddAnugaElevationData,
        visibleAnugaScenarioLogId: state?.anuga?.visibleAnugaScenarioLogId
    };
};

const mapDispatchToProps = ( dispatch ) => {
    return {
        initAnuga: () => dispatch(initAnuga()),
        setAnugaInputMenu: (visible) => dispatch(setAnugaInputMenu(visible)),
        setAnugaScenarioMenu: (visible) => dispatch(setAnugaScenarioMenu(visible)),
        setAnugaResultMenu: (visible) => dispatch(setAnugaResultMenu(visible)),
        setOpenMenuGroupId: (menuGroup) => dispatch(setOpenMenuGroupId(menuGroup)),
        startAnugaScenarioPolling: () => dispatch(startAnugaScenarioPolling()),
        stopAnugaScenarioPolling: () => dispatch(stopAnugaScenarioPolling()),
        updateCustomEditorsOptions: (payload) => dispatch(updateCustomEditorsOptions(payload))
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(AnugaContainer);
