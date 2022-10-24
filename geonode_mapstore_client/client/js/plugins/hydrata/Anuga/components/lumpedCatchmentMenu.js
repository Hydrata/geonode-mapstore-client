import React from "react";
import {connect} from "react-redux";
const PropTypes = require('prop-types');
const Spinner = require('react-spinkit');
import '../anuga.css';
import '../../SimpleView/simpleView.css';
import {
    setLumpedCatchmentMenu
} from "../actionsAnuga";
import {Table, Button} from "react-bootstrap";

class LumpedCatchmentMenuClass extends React.Component {
    static propTypes = {
        setLumpedCatchmentMenu: PropTypes.func,
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
                                    </tr>
                                </thead>
                                <tbody>
                                    {
                                        this.props.lumpedCatchments?.map(lumpedCatchment => {
                                            return (
                                                <tr className={'scenario-table-row'}>
                                                    <td>{lumpedCatchment.id}</td>
                                                    <td>
                                                        {lumpedCatchment.name}
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
}

const mapStateToProps = (state) => {
    return {
        lumpedCatchments: state?.anuga?.lumpedCatchments
    };
};

const mapDispatchToProps = ( dispatch ) => {
    return {
        setLumpedCatchmentMenu: (visible) => dispatch(setLumpedCatchmentMenu(visible))
    };
};

const LumpedCatchmentMenu = connect(mapStateToProps, mapDispatchToProps)(LumpedCatchmentMenuClass);


export {LumpedCatchmentMenu};
