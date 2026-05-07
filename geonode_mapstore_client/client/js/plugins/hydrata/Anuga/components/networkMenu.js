import React from "react";
import {connect} from "react-redux";
const PropTypes = require('prop-types');
import '../anuga.css';
import '../../SimpleView/simpleView.css';
import {
    setNetworkMenu,
    updateNetwork,
    saveNetwork,
    runNetwork
} from "../actionsAnuga";
import {Table, Button} from "react-bootstrap";
import Message from '@mapstore/framework/components/I18N/Message';

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
            <div id={'anuga-network-container'} className={'simple-view-panel anuga-panel'}>
                <div className={'menu-rows-container'}>
                    <div className={"row menu-row-header"}>
                        <h3><Message msgId="hydrata.anuga.hydrology" /></h3>
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
                                        <th><Message msgId="hydrata.anuga.id" /></th>
                                        <th><Message msgId="hydrata.anuga.name" /></th>
                                        <th><Message msgId="hydrata.anuga.elevation" /></th>
                                        <th><Message msgId="hydrata.anuga.nodes" /></th>
                                        <th><Message msgId="hydrata.anuga.links" /></th>
                                        <th><Message msgId="hydrata.anuga.method" /></th>
                                        <th><Message msgId="hydrata.anuga.inflowDataset" /><br/><Message msgId="hydrata.anuga.toStoreResults" /></th>
                                        <th></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {
                                        this.props.networks?.map(network => {
                                            return (
                                                <tr key={network.id} className={'scenario-table-row'}>
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
                                                                        <option key={elevation?.id}
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
                                                                        <option key={node?.id}
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
                                                                        <option key={link?.id}
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
                                                                        <option key={inflow?.id}
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
                                                            className={"anuga-btn" + (network?.unsaved ? '' : ' disabled')}
                                                            onClick={() => {
                                                                if (network?.unsaved) {
                                                                    this.props.saveNetwork(network);
                                                                }
                                                            }}
                                                        >
                                                            <Message msgId="hydrata.anuga.save" />
                                                        </Button>
                                                        <Button
                                                            bsStyle={'success'}
                                                            bsSize={'xsmall'}
                                                            className="anuga-btn"
                                                            onClick={() => {
                                                                this.props.runNetwork(network);
                                                            }}
                                                        >
                                                            <Message msgId="hydrata.anuga.run" />
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
    let networks = (state?.anuga?.resources?.networks || []).slice().sort((a, b) => a.id - b.id);
    return {
        networks: networks,
        elevations: state?.anuga?.resources?.elevations,
        nodes: state?.anuga?.resources?.nodes,
        links: state?.anuga?.resources?.links,
        inflows: state?.anuga?.resources?.inflows
    };
};

const mapDispatchToProps = ( dispatch ) => {
    return {
        setNetworkMenu: (visible) => dispatch(setNetworkMenu(visible)),
        updateNetwork: (network, kv) => dispatch(updateNetwork(network, kv)),
        saveNetwork: (network) => dispatch(saveNetwork(network)),
        runNetwork: (network) => dispatch(runNetwork(network))
    };
};

const NetworkMenu = connect(mapStateToProps, mapDispatchToProps)(NetworkMenuClass);


export {NetworkMenu};
