import React from "react";
import {connect} from "react-redux";
const PropTypes = require('prop-types');
import {
    createAnugaElevationFromLayer,
    setAddAnugaElevation,
    createNewBoundary
} from "../actionsAnuga";


class AnugaAddElevationDataClass extends React.Component {
    static propTypes = {
        availableElevations: PropTypes.array,
        createAnugaElevationFromLayer: PropTypes.func,
        setAddAnugaElevation: PropTypes.func,
        createNewBoundary: PropTypes.func
    };

    static defaultProps = {}

    constructor(props) {
        super(props);
        this.state = {
            boundaryTitle: ''
        };
    }


    render() {
        return (
            <React.Fragment>
                <div id={'anuga-input-menu'} className={'simple-view-panel'} style={{top: "70px", width: "480px"}}>
                    <div className={'menu-rows-container'}>
                        <div className={"row menu-row menu-row-header"} style={{width: "480px", textAlign: "left"}}>
                            Create New Layers
                        </div>
                        <div className={"row menu-row"} style={{width: "480px", textAlign: "left"}}>
                            <span
                                className={"btn glyphicon menu-row-glyph glyphicon-upload"}
                                style={{"color": "limegreen"}}
                                onClick={() => {window.open('/layers/upload', '_blank');}}
                            />
                            <span className="menu-row-text">Upload New Layer</span>
                        </div>
                        <div className={"row menu-row"} style={{width: "480px", textAlign: "left"}}>
                            <span
                                className={"btn glyphicon menu-row-glyph glyphicon-edit"}
                                style={{"color": "limegreen"}}
                                onClick={() => {this.props.createNewBoundary(this.state.boundaryTitle);}}
                            />
                            <input
                                id={'boundary-input'}
                                key={'boundary-input'}
                                type={'text'}
                                value={this.state.boundaryTitle}
                                placeholder={'Create Boundary Layer'}
                                onChange={(e) => this.setState({boundaryTitle: e.target.value})}
                            />
                        </div>
                        <div className={"row menu-row menu-row-header"} style={{width: "480px", textAlign: "left"}}>
                            Elevation Layers Available to Add:
                            <span
                                className={"btn glyphicon glyphicon-remove legend-close"}
                                onClick={() => this.props.setAddAnugaElevation(false)}
                            />
                        </div>
                        {
                            this.props.availableElevations?.map((elevation) => (
                                <div className={"row menu-row"} style={{width: "480px", textAlign: "left"}}>
                                    <span
                                        className={"btn glyphicon menu-row-glyph glyphicon-plus"}
                                        style={{"color": "limegreen"}}
                                        onClick={() => {
                                            this.props.createAnugaElevationFromLayer(elevation.pk, elevation.name);
                                            this.props.setAddAnugaElevation(false);
                                        }}
                                    />
                                    <span className="menu-row-text">{elevation.name}</span>
                                </div>
                            ))
                        }
                    </div>
                </div>
            </React.Fragment>
        );
    }
}

const mapStateToProps = (state) => {
    return {
        availableElevations: state?.anuga?.availableElevations,
        elevations: state?.anuga?.elevations,
        frictions: state?.anuga?.frictions,
        inflows: state?.anuga?.inflows,
        structures: state?.anuga?.structures
    };
};

const mapDispatchToProps = ( dispatch ) => {
    return {
        createAnugaElevationFromLayer: (pk, name) => dispatch(createAnugaElevationFromLayer(pk, name)),
        createNewBoundary: (boundaryTitle) => dispatch(createNewBoundary(boundaryTitle)),
        setAddAnugaElevation: (visible) => dispatch(setAddAnugaElevation(visible))
    };
};

const AnugaAddElevationData = connect(mapStateToProps, mapDispatchToProps)(AnugaAddElevationDataClass);


export {AnugaAddElevationData};
