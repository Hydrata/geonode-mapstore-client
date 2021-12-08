import React from 'react';
import {connect} from 'react-redux';
const PropTypes = require('prop-types');
import {Button} from "react-bootstrap";

import {
    initAnuga,
    setAnugaInputMenu,
    setAnugaScenarioMenu,
    setAnugaResultMenu,
    setAddAnugaElevation
} from '../actionsAnuga';
import {AnugaScenarioMenu} from './AnugaScenarioMenu';
import {AnugaResultMenu} from './AnugaResultMenu';
import {AnugaAddElevationData} from "./anugaAddElevationData";
import {AnugaScenarioLogViewer} from "./anugaScenarioLogViewer";
import {setOpenMenuGroupId} from "../../SimpleView/actionsSimpleView";
import '../anuga.css';
import '../../SimpleView/simpleView.css';

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
        visibleAnugaScenarioLog: PropTypes.object
    };

    static defaultProps = {
    };

    constructor(props) {
        super(props);
    }

    componentDidMount() {
        this.props.initAnuga();
    }

    render() {
        return this.props.isAnugaProject ?
            (
                <div id={"anuga-container"}>
                    <div id={"anuga-inputs"}>
                        {
                            this.props.showAnugaInputMenu ?
                                <button
                                    key="anuga-input-button"
                                    className={'simple-view-menu-button'}
                                    style={{left: (this.props.numberOfMenus + 1) * 100 + 20}}
                                    onClick={() => {
                                        this.props.setAddAnugaElevation(true);
                                        this.props.setOpenMenuGroupId(null);
                                    }}
                                >
                                    Add Data
                                </button> :
                                null
                        }
                        {
                            (this.props.openMenuGroupId && this.props.anugaInputMenuGroupId === this.props.openMenuGroupId) ?
                                <Button
                                    bsStyle={'success'}
                                    bsSize={'xsmall'}
                                    style={{margin: "2px", borderRadius: "2px", top: "75px", left: "446px", position: "absolute", zIndex: 2000}}
                                    onClick={() => {
                                        this.props.setAddAnugaElevation(true);
                                        this.props.setOpenMenuGroupId(null);
                                    }}
                                >
                                    Add Data
                                </Button>
                                : null
                        }
                    </div>
                    <div id={"anuga-scenario"}>
                        <button
                            key="anuga-scenario-button"
                            className={'simple-view-menu-button'}
                            style={{left: (this.props.numberOfMenus + (this.props.showAnugaInputMenu ? 2 : 1)) * 100 + 20}}
                            onClick={() => {
                                this.props.setAnugaScenarioMenu(!this.props.showAnugaScenarioMenu);
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
                    <div id={"anuga-results"}>
                        <button
                            key="anuga-result-button"
                            className={'simple-view-menu-button'}
                            style={{left: (this.props.numberOfMenus + (this.props.showAnugaInputMenu ? 3 : 2)) * 100 + 20}}
                            onClick={() => {
                                this.props.setAnugaResultMenu(!this.props.showAnugaResultMenu);
                                this.props.setOpenMenuGroupId(null);
                            }}
                        >
                            Results
                        </button>
                        {
                            this.props.showAnugaResultMenu ?
                                <AnugaResultMenu/>
                                : null
                        }
                    </div>
                    {
                        (this.props.showAddAnugaElevationData && !this.props.isAnugaMenuOpen) ?
                            <AnugaAddElevationData/>
                            : null
                    }
                    {
                        this.props.visibleAnugaScenarioLog ?
                            <AnugaScenarioLogViewer/>
                            : null
                    }
                </div>
            ) :
            null;
    }
}

const mapStateToProps = (state) => {
    console.log('state for Anuga:', state);
    return {
        isAnugaProject: state?.anuga?.project?.id,
        anugaInputMenuGroupId: state?.layers?.groups?.filter((group) => group.title === "Input Data")[0]?.id,
        showAnugaInputMenu: !state?.layers?.groups?.filter((group) => group.title === "Input Data").length,
        showAnugaScenarioMenu: state?.anuga?.showAnugaScenarioMenu,
        showAnugaResultMenu: state?.anuga?.showAnugaResultMenu,
        isAnugaMenuOpen: state?.anuga?.showAnugaInputMenu || state?.anuga?.showAnugaScenarioMenu || state?.anuga?.showAnugaResultMenu,
        openMenuGroupId: state?.simpleView?.openMenuGroupId,
        numberOfMenus: state?.layers?.groups.length,
        showAddAnugaElevationData: state?.anuga?.showAddAnugaElevationData,
        visibleAnugaScenarioLog: state?.anuga?.visibleAnugaScenarioLog
    };
};

const mapDispatchToProps = ( dispatch ) => {
    return {
        initAnuga: () => dispatch(initAnuga()),
        setAddAnugaElevation: (visible) => dispatch(setAddAnugaElevation(visible)),
        setAnugaInputMenu: (visible) => dispatch(setAnugaInputMenu(visible)),
        setAnugaScenarioMenu: (visible) => dispatch(setAnugaScenarioMenu(visible)),
        setAnugaResultMenu: (visible) => dispatch(setAnugaResultMenu(visible)),
        setOpenMenuGroupId: (menuGroup) => dispatch(setOpenMenuGroupId(menuGroup))
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(AnugaContainer);
