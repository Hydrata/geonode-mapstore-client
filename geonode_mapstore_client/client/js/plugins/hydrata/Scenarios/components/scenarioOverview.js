import React from "react";
import {connect} from "react-redux";
const PropTypes = require('prop-types');
import { Button } from 'react-bootstrap';
import {
    fetchScenarioOverview,
    showScenarioOverview,
    hideScenarioOverview,
    updateScenario,
    saveScenario,
    createScenario,
    selectScenario,
    runScenario,
    deleteScenario
} from '../actionsScenarios';
import '../scenarios.css';

const scenarioOverviewPanelStyle = {
    position: "absolute",
    zIndex: 1021,
    top: "85px",
    left: "20px",
    minWidth: "760px",
    width: "95%",
    maxHeight: "92%",
    backgroundColor: "rgba(0,60,136,0.6)",
    borderColor: "rgb(255 255 255 / 70%)",
    borderWidth: "2px",
    paddingBottom: "10px",
    fontSize: "12px",
    lineHeight: "1.5",
    borderRadius: "4px",
    color: "white",
    textAlign: "right",
    overflowY: "auto",
    overflowX: "auto"
};

const formControlStyle = {
    border: 'none',
    textAlign: 'center',
    background: 'none',
    color: 'white'
};

class ScenarioOverviewClass extends React.Component {
    static propTypes = {
        data: PropTypes.array,
        mapId: PropTypes.number,
        fetchScenarioOverview: PropTypes.func,
        showScenarioOverview: PropTypes.func,
        hideScenarioOverview: PropTypes.func,
        updateScenario: PropTypes.func,
        scenarioOverview: PropTypes.object,
        scenarioList: PropTypes.array,
        datasetList: PropTypes.array,
        fields: PropTypes.array,
        saveScenario: PropTypes.func,
        createScenario: PropTypes.func,
        selectScenario: PropTypes.func,
        runScenario: PropTypes.func,
        deleteScenario: PropTypes.func,
        projectId: PropTypes.func
    };

    static defaultProps = {}

    constructor(props) {
        super(props);
        this.state = {};
        this.handleChange = this.handleChange.bind(this);
    }

    componentDidMount() {
        if (!this.props.mapId && !this.isFetching) {
            this.isFetching = false;
        }
        if (this.props.mapId && this.props.scenarioOverview?.slug && !(this.props.scenarioOverview?.scenario === {}) && !this.isFetching) {
            this.props.fetchScenarioOverview(this.props.mapId, this.props.scenarioOverview?.slug);
            this.isFetching = true;
        }
        if (this.props.mapId && this.props.scenarioOverview?.slug) {
            this.isFetching = false;
        }
    }

    componentDidUpdate() {
    }

    render() {
        return (
            <div style={scenarioOverviewPanelStyle} id={'ScenarioOverview'} className={'container'}>
                <div className={"row"}>
                    <h5
                        style={{textAlign: 'left', marginLeft: '10px'}}
                    >
                        Scenarios - {this.props.scenarioOverview.title}
                    </h5>
                </div>
                <span
                    className={"btn glyphicon glyphicon-remove"}
                    style={{
                        position: "absolute",
                        right: "0px",
                        color: "red"
                    }}
                    onClick={() => this.props.hideScenarioOverview()}
                />
                <div className={'scenario-table'}>
                    <div className={'scenario-table-header-group'}>
                        <div className={'scenario-table-row'}>
                            <div className={'scenario-table-cell'} key={'scenario-selector'}>
                                Select
                            </div>
                            {this.props?.fields?.filter((field) => field.widget !== 'resultButton').map((field) => {
                                return (
                                    <div className={'scenario-table-cell'} key={field.name}>
                                        {field.label}
                                    </div>);
                            })}
                            <div className={'scenario-table-cell'}>Save</div>
                            <div className={'scenario-table-cell'}>Run</div>
                            <div className={'scenario-table-cell'}>Delete</div>
                            {this.props?.fields?.filter((field) => field.widget === 'resultButton').map((field) => {
                                return (
                                    <div className={'scenario-table-cell'} key={field.name}>
                                        {field.label}
                                    </div>);
                            })}
                        </div>
                    </div>
                    {this.props.scenarioList?.map((scen) => {
                        return (
                            <div className={'scenario-table-row'}>
                                <div className={'scenario-table-cell'}>
                                    <input
                                        id={'scenario-selector-box'}
                                        style={formControlStyle}
                                        type={'radio'}
                                        name={'scenario-selector'}
                                        value={false}
                                        onChange={() => this.props.selectScenario(scen)}
                                    />
                                </div>
                                {this.props?.fields?.filter((field) => field.widget !== 'resultButton')
                                    .map((field) => {
                                        return (
                                            <div className={'scenario-table-cell'}>
                                                {(() => {
                                                    if (field.widget === 'select') {
                                                        return (
                                                            <select
                                                                id={field.name}
                                                                key={field.name}
                                                                style={formControlStyle}
                                                                value={this.props.scenarioList.filter((scenToCheck) => scen === scenToCheck)[0][field.name]}
                                                                onChange={(e) => this.handleChange(e, scen)}
                                                            >
                                                                {
                                                                    this.props.datasetList.map((dataset) => {
                                                                        return (
                                                                            <option value={dataset.id}>{dataset?.layer_title}</option>
                                                                        );
                                                                    })
                                                                }
                                                            </select>
                                                        );
                                                    }
                                                    return (
                                                        <input
                                                            id={field.name}
                                                            key={field.name}
                                                            style={formControlStyle}
                                                            type={field.widget}
                                                            value={
                                                                this.props.scenarioList.filter(
                                                                    (scenToCheck) => scen === scenToCheck
                                                                )[0][field.name]
                                                            }
                                                            onChange={(e) => this.handleChange(e, scen)}
                                                        />
                                                    );
                                                })()}
                                            </div>
                                        );
                                    })}
                                <div className={'scenario-button scenario-table-cell'}>
                                    <Button
                                        bsStyle="success"
                                        bsSize="xsmall"
                                        onClick={() => this.props.saveScenario(this.props.mapId, scen)}
                                        style={{'borderRadius': '3px'}}
                                        className={scen.unsaved ? null : 'disabled'}
                                    >
                                        Save
                                    </Button>
                                </div>
                                <div className={'scenario-button scenario-table-cell'}>
                                    <Button
                                        bsStyle="success"
                                        bsSize="xsmall"
                                        onClick={() => this.props.runScenario(this.props.mapId, scen)}
                                        style={{'borderRadius': '3px'}}
                                        className={scen.unsaved ? 'disabled' : null}
                                    >
                                        Run
                                    </Button>
                                </div>
                                <div className={'scenario-button scenario-table-cell'}>
                                    <Button
                                        bsStyle="danger"
                                        bsSize="xsmall"
                                        onClick={() => {if (window.confirm('Are you sure?')) { this.props.deleteScenario(this.props.mapId, scen);}}}
                                        style={{'borderRadius': '3px', 'opacity': 0.7}}
                                        className={scen.unsaved ? 'disabled' : null}
                                    >
                                        Delete
                                    </Button>
                                </div>
                                {this.props?.fields?.filter((field) => field.widget === 'resultButton')
                                    .map((field) => {
                                        return (
                                            <div className={'scenario-table-cell'}>
                                                <div style={{'maxHeight': '80px', 'overflowX': 'hidden', 'overflowY': 'auto', 'textAlign': 'left', 'paddingLeft': '5px'}}>
                                                    {
                                                        JSON.stringify(this.props.scenarioList.filter(
                                                            (scenToCheck) => scen === scenToCheck
                                                        )[0][field.name], null, 2)
                                                    }
                                                </div>
                                            </div>);
                                    })}
                            </div>
                        );
                    })}
                    <div className={'scenario-table-row'}>
                        <div className={'scenario-button scenario-table-cell'}>
                            <Button
                                bsStyle="success"
                                bsSize="xsmall"
                                onClick={() => this.props.createScenario(this.props.fields, this.props.projectId)}
                                style={{'borderRadius': '3px'}}
                            >
                                New
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    handleChange = (e, scenario) => {
        const kv = {};
        kv[e.target.id] = e.target.value;
        this.props.updateScenario(scenario, kv);
    }
}

const mapStateToProps = (state) => {
    return {
        mapId: state?.projectManager?.data?.base_map,
        projectId: state?.projectManager?.data?.id,
        scenarioOverview: state?.scenarios?.scenarioOverview,
        scenarioList: state?.scenarios?.scenarioOverview?.scenarios || [],
        selectedScenario: state?.scenario?.selectedScenario,
        datasetList: state?.projectManager?.data?.dataset_set,
        fields: state?.scenarios?.config?.filter((scen) => state?.scenarios?.scenarioOverview?.slug === scen.slug)[0]?.fields
    };
};

const mapDispatchToProps = ( dispatch ) => {
    return {
        fetchScenarioOverview: (mapId, slug) => dispatch(fetchScenarioOverview(mapId, slug)),
        showScenarioOverview: (slug) => dispatch(showScenarioOverview(slug)),
        updateScenario: (scenario, kv) => dispatch(updateScenario(scenario, kv)),
        saveScenario: (mapId, scenario) => dispatch(saveScenario(mapId, scenario)),
        runScenario: (mapId, scenario) => dispatch(runScenario(mapId, scenario)),
        deleteScenario: (mapId, scenario) => dispatch(deleteScenario(mapId, scenario)),
        selectScenario: (scenario) => dispatch(selectScenario(scenario)),
        createScenario: (fields, projectId) => dispatch(createScenario(fields, projectId)),
        hideScenarioOverview: () => dispatch(hideScenarioOverview())
    };
};

const ScenarioOverview = connect(mapStateToProps, mapDispatchToProps)(ScenarioOverviewClass);


export {
    ScenarioOverview
};
