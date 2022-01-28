import React from "react";
import {connect} from "react-redux";
const PropTypes = require('prop-types');
import '../anuga.css';
import '../../SimpleView/simpleView.css';
import {
    setVisibleUploaderPanel
} from "../../SimpleView/actionsSimpleView";
import {
    createAnugaBoundary,
    createAnugaFriction,
    createAnugaInflow,
    createAnugaStructure
} from "../actionsAnuga";

class AnugaInputMenuClass extends React.Component {
    static propTypes = {
        setVisibleUploaderPanel: PropTypes.func,
        anugaGroupLength: PropTypes.number,
        elevations: PropTypes.array,
        setAddAnugaElevation: PropTypes.func,
        showAddAnugaElevationData: PropTypes.bool,
        boundaries: PropTypes.array,
        createAnugaBoundary: PropTypes.func,
        createAnugaFriction: PropTypes.func,
        createAnugaInflow: PropTypes.func,
        createAnugaStructure: PropTypes.func,
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
        this.state = {
            boundaryTitle: '',
            frictionTitle: '',
            inflowTitle: '',
            structureTitle: ''
        };
    }


    render() {
        return (
            <div id={'anuga-input-menu'} className={'simple-view-panel'} style={{top: "70px", width: "480px"}}>
                <div
                    className={'menu-rows-container'}
                    style={{
                        "border": "1px solid rgba(255, 255, 255, 1)",
                        "borderRadius": "3px",
                        "margin": "3px 0"
                    }}>
                    <div
                        className={"row menu-row menu-row-header"}
                        style={{
                            width: "480px",
                            textAlign: "left",
                            border: "none"
                        }}
                    >
                        <span className="menu-row-text">Elevations</span>
                        <span
                            className={"btn pull-right glyphicon menu-row-glyph glyphicon-upload"}
                            style={{"color": "limegreen", "fontSize": "smaller", "textAlign": "right", "marginRight": "8px"}}
                            onClick={() => {this.props.setVisibleUploaderPanel(true);}}
                        />
                    </div>
                    {
                        this.props.elevations?.map(elevation => (
                            <div className={"row menu-row menu-row"} style={{width: "480px", textAlign: "left", border: "none"}}>
                                {elevation.title}
                            </div>
                        ))
                    }
                    {
                        this.props.elevations?.length === 0 ?
                            <div className={"row menu-row menu-row"} style={{width: "480px", textAlign: "left", border: "none"}}>
                                No Elevations available
                            </div>
                            : null
                    }
                </div>
                <div
                    className={'menu-rows-container'}
                    style={{
                        "border": "1px solid rgba(255, 255, 255, 1)",
                        "borderRadius": "3px",
                        "margin": "3px 0"
                    }}>
                    <div
                        className={"row menu-row menu-row-header"}
                        style={{
                            width: "480px",
                            textAlign: "left",
                            border: "none"
                        }}
                    >
                        <span className="pull-left menu-row-text">Boundaries</span>
                        <span
                            className={`btn glyphicon menu-row-glyph glyphicon-edit${this.state.boundaryTitle ? "" : " disabled"}`}
                            style={{"color": "limegreen", "fontSize": "smaller", "textAlign": "right", "marginRight": "8px", "float": "right"}}
                            onClick={() => this.props.createAnugaBoundary(this.state.boundaryTitle)}
                        />
                        <input
                            id={'boundary-input'}
                            key={'boundary-input'}
                            className={'data-title-input'}
                            type={'text'}
                            value={this.state.boundaryTitle}
                            onChange={(e) => this.setState({boundaryTitle: e.target.value})}
                        />
                    </div>
                    {
                        this.props.boundaries?.map(boundary => (
                            <div className={"row menu-row menu-row"} style={{width: "480px", textAlign: "left", border: "none"}}>
                                {boundary.name}
                            </div>
                        ))
                    }
                    {
                        this.props.boundaries?.length === 0 ?
                            <div className={"row menu-row menu-row"} style={{width: "480px", textAlign: "left", border: "none"}}>
                                No Boundaries available
                            </div>
                            : null
                    }
                </div>
                <div
                    className={'menu-rows-container'}
                    style={{
                        "border": "1px solid rgba(255, 255, 255, 1)",
                        "borderRadius": "3px",
                        "margin": "3px 0"
                    }}>
                    <div
                        className={"row menu-row menu-row-header"}
                        style={{
                            width: "480px",
                            textAlign: "left",
                            border: "none"
                        }}
                    >
                        <span className="pull-left menu-row-text">Friction Maps</span>
                        <span
                            className={"btn pull-right glyphicon menu-row-glyph glyphicon-edit"}
                            style={{"color": "limegreen", "fontSize": "smaller", "textAlign": "right", "marginRight": "8px"}}
                            onClick={() => {this.props.createAnugaFriction();}}
                        />
                    </div>
                    {
                        this.props.frictions?.map(friction => (
                            <div className={"row menu-row menu-row"} style={{width: "480px", textAlign: "left", border: "none"}}>
                                {friction.name}
                            </div>
                        ))
                    }
                    {
                        this.props.frictions?.length === 0 ?
                            <div className={"row menu-row menu-row"} style={{width: "480px", textAlign: "left", border: "none"}}>
                                No Friction Maps available
                            </div>
                            : null
                    }
                </div>
                <div
                    className={'menu-rows-container'}
                    style={{
                        "border": "1px solid rgba(255, 255, 255, 1)",
                        "borderRadius": "3px",
                        "margin": "3px 0"
                    }}>
                    <div
                        className={"row menu-row menu-row-header"}
                        style={{
                            width: "480px",
                            textAlign: "left",
                            border: "none"
                        }}
                    >
                        <span className="pull-left menu-row-text">Inflows</span>
                        <span
                            className={"btn pull-right glyphicon menu-row-glyph glyphicon-edit"}
                            style={{"color": "limegreen", "fontSize": "smaller", "textAlign": "right", "marginRight": "8px"}}
                            onClick={() => {this.props.createAnugaInflow();}}
                        />
                    </div>
                    {
                        this.props.inflows?.map(inflow => (
                            <div className={"row menu-row menu-row"} style={{width: "480px", textAlign: "left", border: "none"}}>
                                {inflow.name}
                            </div>
                        ))
                    }
                    {
                        this.props.inflows?.length === 0 ?
                            <div className={"row menu-row menu-row"} style={{width: "480px", textAlign: "left", border: "none"}}>
                                No Inflows available
                            </div>
                            : null
                    }
                </div>
                <div
                    className={'menu-rows-container'}
                    style={{
                        "border": "1px solid rgba(255, 255, 255, 1)",
                        "borderRadius": "3px",
                        "margin": "3px 0"
                    }}>
                    <div
                        className={"row menu-row menu-row-header"}
                        style={{
                            width: "480px",
                            textAlign: "left",
                            border: "none"
                        }}
                    >
                        <span className="pull-left menu-row-text">Structures</span>
                        <span
                            className={"btn pull-right glyphicon menu-row-glyph glyphicon-edit"}
                            style={{"color": "limegreen", "fontSize": "smaller", "textAlign": "right", "marginRight": "8px"}}
                            onClick={() => {this.props.createAnugaStructure();}}
                        />
                    </div>
                    {
                        this.props.structures?.map(structure => (
                            <div className={"row menu-row menu-row"} style={{width: "480px", textAlign: "left", border: "none"}}>
                                {structure.name}
                            </div>
                        ))
                    }
                    {
                        this.props.structures?.length === 0 ?
                            <div className={"row menu-row menu-row"} style={{width: "480px", textAlign: "left", border: "none"}}>
                                No Structures available
                            </div>
                            : null
                    }
                </div>
            </div>
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
        setVisibleUploaderPanel: (visible) => dispatch(setVisibleUploaderPanel(visible)),
        createAnugaBoundary: (boundaryTitle) => dispatch(createAnugaBoundary(boundaryTitle)),
        createAnugaFriction: (frictionTitle) => dispatch(createAnugaFriction(frictionTitle)),
        createAnugaInflow: (inflowTitle) => dispatch(createAnugaInflow(inflowTitle)),
        createAnugaStructure: (structureTitle) => dispatch(createAnugaStructure(structureTitle))
    };
};

const AnugaInputMenu = connect(mapStateToProps, mapDispatchToProps)(AnugaInputMenuClass);

export {AnugaInputMenu};
