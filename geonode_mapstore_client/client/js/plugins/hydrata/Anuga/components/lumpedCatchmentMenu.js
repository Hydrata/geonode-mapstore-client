import React from "react";
import {connect} from "react-redux";
const PropTypes = require('prop-types');
const Spinner = require('react-spinkit');
import '../anuga.css';
import '../../SimpleView/simpleView.css';
import {
    setLumpedCatchmentMenu,
    updateLumpedCatchment,
    runLumpedCatchment
} from "../actionsAnuga";
import {Table, Button} from "react-bootstrap";

class LumpedCatchmentMenuClass extends React.Component {
    static propTypes = {
        setLumpedCatchmentMenu: PropTypes.func,
        updateLumpedCatchment: PropTypes.func,
        runLumpedCatchment: PropTypes.func,
        nodes: PropTypes.array,
        inflows: PropTypes.array,
        elevations: PropTypes.array,
        lumpedCatchments: PropTypes.array
    };

    static defaultProps = {}

    constructor(props) {
        super(props);
        this.state = {};
    }

    componentDidMount() {
    }


    render() {
        return (
            <div id={'anuga-lumped-catchment-container'} className={'simple-view-panel'} style={{top: "70px", height: "80%", width: "80%"}}>
                <div className={'menu-rows-container'}>
                    <div className={"row menu-row-header"}>
                        <h3>Hydrology</h3>
                        <span
                            className={"btn glyphicon glyphicon-remove legend-close"}
                            onClick={() => {
                                this.props.setLumpedCatchmentMenu(false);
                            }}
                        />
                        <div>
                            <Table className={"lumped-catchment-table"}>
                                <thead>
                                    <tr className={"lumped-catchment-table-header"}>
                                        <th>Id</th>
                                        <th>Name</th>
                                        <th>Nodes</th>
                                        <th>Elevation</th>
                                        <th>Method</th>
                                        <th>Inflow Dataset<br/>to Store Results</th>
                                        <th></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {
                                        this.props.lumpedCatchments?.map(lumpedCatchment => {
                                            return (
                                                <tr className={'scenario-table-row'}>
                                                    <td>{lumpedCatchment.id}</td>
                                                    <td>
                                                        {lumpedCatchment.title}
                                                    </td>
                                                    <td>
                                                        <select
                                                            id={'node'}
                                                            key={`node-${lumpedCatchment.id}`}
                                                            value={lumpedCatchment?.node}
                                                            className={'scenario-select'}
                                                            onChange={(e) => this.handleIntChange(e, lumpedCatchment)}
                                                        >
                                                            <option value={""}>-</option>
                                                            {
                                                                this.props.nodes?.map((node) => {
                                                                    return (
                                                                        <option
                                                                            value={node?.id}>{node?.title}</option>
                                                                    );
                                                                })
                                                            }
                                                        </select>
                                                    </td>
                                                    <td>
                                                        <select
                                                            id={'elevation'}
                                                            key={`elevation-${lumpedCatchment.id}`}
                                                            value={lumpedCatchment?.elevation}
                                                            className={'scenario-select'}
                                                            onChange={(e) => this.handleIntChange(e, lumpedCatchment)}
                                                        >
                                                            <option value={""}>-</option>
                                                            {
                                                                this.props.elevations?.map((elevation) => {
                                                                    return (
                                                                        <option
                                                                            value={elevation?.id}>{elevation?.title}</option>
                                                                    );
                                                                })
                                                            }
                                                        </select>
                                                    </td>
                                                    <td>
                                                        <select
                                                            id={'method'}
                                                            key={`method`}
                                                            value={'rational'}
                                                            className={'scenario-select'}
                                                        >
                                                            <option value={"rational"}>rational</option>
                                                        </select>
                                                    </td>
                                                    <td>
                                                        <select
                                                            id={'inflow'}
                                                            key={`inflow-${lumpedCatchment.id}`}
                                                            value={lumpedCatchment?.inflow}
                                                            className={'scenario-select'}
                                                            onChange={(e) => this.handleIntChange(e, lumpedCatchment)}
                                                        >
                                                            <option value={""}>-</option>
                                                            {
                                                                this.props.inflows?.map((inflow) => {
                                                                    return (
                                                                        <option
                                                                            value={inflow?.id}>{inflow?.title}</option>
                                                                    );
                                                                })
                                                            }
                                                        </select>
                                                    </td>
                                                    <td>
                                                        <Button
                                                            bsStyle={'success'}
                                                            bsSize={'xsmall'}
                                                            style={{margin: "2px", borderRadius: "2px"}}
                                                            onClick={() => {
                                                                this.props.runLumpedCatchment(lumpedCatchment);
                                                            }}
                                                        >
                                                            Run
                                                        </Button>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    }
                                </tbody>
                            </Table>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    handleTextChange = (e, lumpedCatchment) => {
        const kv = {};
        kv[e.target.id] = e.target.value;
        this.props.updateLumpedCatchment(lumpedCatchment, kv);
    }

    handleBoolChange = (e, lumpedCatchment) => {
        const kv = {};
        kv[e.target.id] = !lumpedCatchment[e.target.id];
        this.props.updateLumpedCatchment(lumpedCatchment, kv);
    }

    handleIntChange = (e, lumpedCatchment) => {
        const kv = {};
        kv[e.target.id] = parseInt(e.target.value, 10);
        this.props.updateLumpedCatchment(lumpedCatchment, kv);
    }

    handleNumberChange = (e, lumpedCatchment) => {
        const kv = {};
        kv[e.target.id] = parseFloat(e.target.value);
        this.props.updateLumpedCatchment(lumpedCatchment, kv);
    }
}

const mapStateToProps = (state) => {
    let lumpedCatchments = state?.anuga?.lumpedCatchments?.sort((a, b) => a.id - b.id);
    return {
        lumpedCatchments: lumpedCatchments,
        elevations: state?.anuga?.elevations,
        nodes: state?.anuga?.nodes,
        inflows: state?.anuga?.inflows
    };
};

const mapDispatchToProps = ( dispatch ) => {
    return {
        setLumpedCatchmentMenu: (visible) => dispatch(setLumpedCatchmentMenu(visible)),
        updateLumpedCatchment: (lumpedCatchment, kv) => dispatch(updateLumpedCatchment(lumpedCatchment, kv)),
        runLumpedCatchment: (lumpedCatchment) => dispatch(runLumpedCatchment(lumpedCatchment))
    };
};

const LumpedCatchmentMenu = connect(mapStateToProps, mapDispatchToProps)(LumpedCatchmentMenuClass);


export {LumpedCatchmentMenu};
