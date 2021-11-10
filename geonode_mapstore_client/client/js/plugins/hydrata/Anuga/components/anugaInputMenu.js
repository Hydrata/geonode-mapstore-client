import React from "react";
import {connect} from "react-redux";
const PropTypes = require('prop-types');
import '../anuga.css';
import '../../SimpleView/simpleView.css';
import {
    setAddAnugaElevation,
    addAnugaBoundary,
    addAnugaFriction,
    addAnugaInflow,
    addAnugaStructure
} from "../actionsAnuga";

class AnugaInputMenuClass extends React.Component {
    static propTypes = {
        anugaGroupLength: PropTypes.number,
        elevations: PropTypes.array,
        setAddAnugaElevation: PropTypes.func,
        showAddAnugaElevationData: PropTypes.bool,
        boundaries: PropTypes.array,
        addAnugaBoundary: PropTypes.func,
        frictions: PropTypes.array,
        addAnugaFriction: PropTypes.func,
        inflows: PropTypes.array,
        addAnugaInflow: PropTypes.func,
        structures: PropTypes.array,
        addAnugaStructure: PropTypes.func
    };

    static defaultProps = {}

    constructor(props) {
        super(props);
        this.state = {};
    }


    render() {
        return (
            <React.Fragment>
                <div id={'anuga-input-menu'} className={'simple-view-panel'} style={{top: "70px", width: "480px"}}>
                    <div className={'menu-rows-container'}>
                        <div className={"row menu-row menu-row-header"} style={{width: "480px", textAlign: "left"}}>
                            <span className={"pull-left .menu-row-button"}>
                                <span
                                    className={"btn glyphicon menu-row-glyph glyphicon-plus"}
                                    style={{"color": "limegreen", "fontSize": "smaller"}}
                                    onClick={() => {this.props.setAddAnugaElevation(!this.props.showAddAnugaElevationData);}}
                                />
                                <span className="menu-row-text">Elevations</span>
                            </span>
                        </div>
                        {
                            this.props.elevations?.map(elevation => (
                                <div className={"row menu-row menu-row"} style={{width: "480px", textAlign: "left"}}>
                                    {elevation.name}
                                </div>
                            ))
                        }
                        {
                            this.props.elevations?.length === 0 ?
                                <div className={"row menu-row menu-row"} style={{width: "480px", textAlign: "left"}}>
                                    No Elevations available
                                </div>
                                : null
                        }
                    </div>
                    <div className={'menu-rows-container'}>
                        <div className={"row menu-row menu-row-header"} style={{width: "480px", textAlign: "left"}}>
                            <span className={"pull-left .menu-row-button"}>
                                <span
                                    className={"btn glyphicon menu-row-glyph glyphicon-plus"}
                                    style={{"color": "limegreen", "fontSize": "smaller"}}
                                    onClick={() => {this.props.addAnugaBoundary();}}
                                />
                                <span className="menu-row-text">Boundaries</span>
                            </span>
                        </div>
                        {
                            this.props.boundaries?.map(boundary => (
                                <div className={"row menu-row menu-row"} style={{width: "480px", textAlign: "left"}}>
                                    {boundary.name}
                                </div>
                            ))
                        }
                        {
                            this.props.boundaries?.length === 0 ?
                                <div className={"row menu-row menu-row"} style={{width: "480px", textAlign: "left"}}>
                                    No Boundaries available
                                </div>
                                : null
                        }
                    </div>
                    <div className={'menu-rows-container'}>
                        <div className={"row menu-row menu-row-header"} style={{width: "480px", textAlign: "left"}}>
                            <span className={"pull-left .menu-row-button"}>
                                <span
                                    className={"btn glyphicon menu-row-glyph glyphicon-plus"}
                                    style={{"color": "limegreen", "fontSize": "smaller"}}
                                    onClick={() => {this.props.addAnugaFriction();}}
                                />
                                <span className="menu-row-text">Friction Maps</span>
                            </span>
                        </div>
                        {
                            this.props.frictions?.map(friction => (
                                <div className={"row menu-row menu-row"} style={{width: "480px", textAlign: "left"}}>
                                    {friction.name}
                                </div>
                            ))
                        }
                        {
                            this.props.frictions?.length === 0 ?
                                <div className={"row menu-row menu-row"} style={{width: "480px", textAlign: "left"}}>
                                    No Friction Maps available
                                </div>
                                : null
                        }
                    </div>
                    <div className={'menu-rows-container'}>
                        <div className={"row menu-row menu-row-header"} style={{width: "480px", textAlign: "left"}}>
                            <span className={"pull-left .menu-row-button"}>
                                <span
                                    className={"btn glyphicon menu-row-glyph glyphicon-plus"}
                                    style={{"color": "limegreen", "fontSize": "smaller"}}
                                    onClick={() => {this.props.addAnugaInflow();}}
                                />
                                <span className="menu-row-text">Inflows</span>
                            </span>
                        </div>
                        {
                            this.props.inflows?.map(inflow => (
                                <div className={"row menu-row menu-row"} style={{width: "480px", textAlign: "left"}}>
                                    {inflow.name}
                                </div>
                            ))
                        }
                        {
                            this.props.inflows?.length === 0 ?
                                <div className={"row menu-row menu-row"} style={{width: "480px", textAlign: "left"}}>
                                    No Inflows available
                                </div>
                                : null
                        }
                    </div>
                    <div className={'menu-rows-container'}>
                        <div className={"row menu-row menu-row-header"} style={{width: "480px", textAlign: "left"}}>
                            <span className={"pull-left .menu-row-button"}>
                                <span
                                    className={"btn glyphicon menu-row-glyph glyphicon-plus"}
                                    style={{"color": "limegreen", "fontSize": "smaller"}}
                                    onClick={() => {this.props.addAnugaStructure();}}
                                />
                                <span className="menu-row-text">Structures</span>
                            </span>
                        </div>
                        {
                            this.props.structures?.map(structure => (
                                <div className={"row menu-row menu-row"} style={{width: "480px", textAlign: "left"}}>
                                    {structure.name}
                                </div>
                            ))
                        }
                        {
                            this.props.structures?.length === 0 ?
                                <div className={"row menu-row menu-row"} style={{width: "480px", textAlign: "left"}}>
                                    No Structures available
                                </div>
                                : null
                        }
                    </div>
                </div>
            </React.Fragment>
        );
    }
}

const mapStateToProps = (state) => {
    return {
        showAddAnugaElevationData: state?.anuga?.showAddAnugaElevationData,
        boundaries: state?.anuga?.boundaries,
        elevations: state?.anuga?.elevations,
        frictions: state?.anuga?.frictions,
        inflows: state?.anuga?.inflows,
        structures: state?.anuga?.structures
    };
};

const mapDispatchToProps = ( dispatch ) => {
    return {
        setAddAnugaElevation: (visible) => dispatch(setAddAnugaElevation(visible)),
        addAnugaBoundary: () => dispatch(addAnugaBoundary()),
        addAnugaFriction: () => dispatch(addAnugaFriction()),
        addAnugaInflow: () => dispatch(addAnugaInflow()),
        addAnugaStructure: () => dispatch(addAnugaStructure())
    };
};

const AnugaInputMenu = connect(mapStateToProps, mapDispatchToProps)(AnugaInputMenuClass);


export default AnugaInputMenu;
