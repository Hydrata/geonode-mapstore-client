import React from "react";
import {connect} from "react-redux";
const PropTypes = require('prop-types');
const Spinner = require('react-spinkit');
import '../anuga.css';
import '../../SimpleView/simpleView.css';
import {
    setNetworkMenu,
    updateNetwork,
    runNetwork
} from "../actionsAnuga";
import {Table, Button} from "react-bootstrap";

class NetworkMenuClass extends React.Component {
    static propTypes = {
        setNetworkMenu: PropTypes.func,
        updateNetwork: PropTypes.func,
        runNetwork: PropTypes.func,
        nodes: PropTypes.array,
        links: PropTypes.array,
        inflows: PropTypes.array,
        elevations: PropTypes.array,
        networks: PropTypes.array
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
            <div id={'anuga-network-container'} className={'simple-view-panel'} style={{top: "70px", height: "80%", width: "80%"}}>
                <div className={'menu-rows-container'}>
                    <div className={"row menu-row-header"}>
                        <h3>Hydrology</h3>
                        <span
                            className={"btn glyphicon glyphicon-remove legend-close"}
                            onClick={() => {
                                this.props.setNetworkMenu(false);
                            }}
                        />
                        <div>
                            <Table className={"network-table"}>
                                <thead>
                                    <tr className={"network-table-header"}>
                                        <th>Id</th>
                                        <th>Name</th>
                                        <th>Elevation</th>
                                        <th>Nodes</th>
                                        <th>Links</th>
                                        <th>Method</th>
                                        <th>Inflow Dataset<br/>to Store Results</th>
                                        <th></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {
                                        this.props.networks?.map(network => {
                                            return (
                                                <tr className={'scenario-table-row'}>
                                                    <td>{network.id}</td>
                                                    <td>
                                                        {network.title}
                                                    </td>
                                                    <td>
                                                        <select
                                                            id={'elevation'}
                                                            key={`elevation-${network.id}`}
                                                            value={network?.elevation}
                                                            className={'scenario-select'}
                                                            onChange={(e) => this.handleIntChange(e, network)}
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
                                                            id={'node'}
                                                            key={`node-${network.id}`}
                                                            value={network?.node}
                                                            className={'scenario-select'}
                                                            onChange={(e) => this.handleIntChange(e, network)}
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
                                                            id={'links'}
                                                            key={`links-${network.id}`}
                                                            value={network?.links}
                                                            className={'scenario-select'}
                                                            onChange={(e) => this.handleIntChange(e, network)}
                                                        >
                                                            <option value={""}>-</option>
                                                            {
                                                                this.props.links?.map((link) => {
                                                                    return (
                                                                        <option
                                                                            value={link?.id}>{link?.title}</option>
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
                                                            key={`inflow-${network.id}`}
                                                            value={network?.inflow}
                                                            className={'scenario-select'}
                                                            onChange={(e) => this.handleIntChange(e, network)}
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
                                                                this.props.runNetwork(network);
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

    handleTextChange = (e, network) => {
        const kv = {};
        kv[e.target.id] = e.target.value;
        this.props.updateNetwork(network, kv);
    }

    handleBoolChange = (e, network) => {
        const kv = {};
        kv[e.target.id] = !network[e.target.id];
        this.props.updateNetwork(network, kv);
    }

    handleIntChange = (e, network) => {
        const kv = {};
        kv[e.target.id] = parseInt(e.target.value, 10);
        this.props.updateNetwork(network, kv);
    }

    handleNumberChange = (e, network) => {
        const kv = {};
        kv[e.target.id] = parseFloat(e.target.value);
        this.props.updateNetwork(network, kv);
    }
}

const mapStateToProps = (state) => {
    let networks = state?.anuga?.networks?.sort((a, b) => a.id - b.id);
    return {
        networks: networks,
        elevations: state?.anuga?.elevations,
        nodes: state?.anuga?.nodes,
        links: state?.anuga?.links,
        inflows: state?.anuga?.inflows
    };
};

const mapDispatchToProps = ( dispatch ) => {
    return {
        setNetworkMenu: (visible) => dispatch(setNetworkMenu(visible)),
        updateNetwork: (network, kv) => dispatch(updateNetwork(network, kv)),
        runNetwork: (network) => dispatch(runNetwork(network))
    };
};

const NetworkMenu = connect(mapStateToProps, mapDispatchToProps)(NetworkMenuClass);


export {NetworkMenu};
