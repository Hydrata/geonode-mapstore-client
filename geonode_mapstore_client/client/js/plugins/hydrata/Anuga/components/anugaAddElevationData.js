import React from "react";
import {connect} from "react-redux";
const PropTypes = require('prop-types');
import {
    createAnugaElevationFromLayer,
    setAddAnugaElevation,
    createNewBoundary,
    startAnugaElevationPolling,
    stopAnugaElevationPolling
} from "../actionsAnuga";


class AnugaAddElevationDataClass extends React.Component {
    static propTypes = {
        availableElevations: PropTypes.array,
        elevations: PropTypes.array,
        createAnugaElevationFromLayer: PropTypes.func,
        setAddAnugaElevation: PropTypes.func,
        startAnugaElevationPolling: PropTypes.func,
        stopAnugaElevationPolling: PropTypes.func,
        createNewBoundary: PropTypes.func,
        newElevationTitle: PropTypes.string
    };

    static defaultProps = {}

    constructor(props) {
        super(props);
        this.state = {
            boundaryTitle: '',
            newElevationTitle: ''
        };
    }

    componentDidMount() {
        this.props.startAnugaElevationPolling();
    }


    render() {
        return (
            <React.Fragment>
                <div id={'anuga-input-menu'} className={'simple-view-panel'} style={{top: "70px", width: "480px"}}>
                    <div className={'menu-rows-container'}>
                        <div className={"row menu-row menu-row-header"} style={{width: "480px", textAlign: "left"}}>
                            Create new layer from scratch:
                        </div>
                        <div className={"row menu-row"} style={{width: "480px", textAlign: "left"}}>
                            <span
                                className={"btn glyphicon menu-row-glyph glyphicon-upload"}
                                style={{"color": "limegreen"}}
                                onClick={() => {window.open('/layers/upload', '_blank');}}
                            />
                            <span className="menu-row-text">Upload a new layer</span>
                        </div>
                        {(this.props.availableElevations?.length > 0) || (this.props.elevations?.length > 0) ?
                            <React.Fragment>
                                <div className={"row menu-row"} style={{width: "480px", textAlign: "left"}}>
                                    <span
                                        className={"btn glyphicon menu-row-glyph glyphicon-edit"}
                                        style={{"color": "limegreen"}}
                                        onClick={() => {
                                            this.props.createNewBoundary(this.state.boundaryTitle);
                                        }}
                                    />
                                    <input
                                        id={'boundary-input'}
                                        key={'boundary-input'}
                                        className={'add-data-input'}
                                        type={'text'}
                                        value={this.state.boundaryTitle}
                                        placeholder={'Create Boundary Layer'}
                                        onChange={(e) => this.setState({boundaryTitle: e.target.value})}
                                    />
                                </div>
                                <div className={"row menu-row menu-row-header"} style={{width: "480px", textAlign: "left"}}>
                                    Add an existing elevation layer to this project:
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
                                                    this.props.createAnugaElevationFromLayer(elevation.pk, this.state.newElevationTitle || 'noTitle');
                                                    this.props.setAddAnugaElevation(false);
                                                }}
                                            />
                                            <span className="menu-row-text">{elevation.name}</span>
                                        </div>
                                    ))
                                }
                                <input
                                    id={'elevation-input'}
                                    key={'elevation-input'}
                                    className={'add-data-input'}
                                    type={'text'}
                                    value={this.state.newElevationTitle}
                                    placeholder={'update elevation title'}
                                    onChange={(e) => this.setState({newElevationTitle: e.target.value})}
                                />
                            </React.Fragment> :
                            null
                        }
                    </div>
                </div>
            </React.Fragment>
        );
    }

    componentDidUnMount() {
        this.props.stopAnugaElevationPolling();
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
        createAnugaElevationFromLayer: (pk, newElevationTitle) => dispatch(createAnugaElevationFromLayer(pk, newElevationTitle)),
        createNewBoundary: (boundaryTitle) => dispatch(createNewBoundary(boundaryTitle)),
        setAddAnugaElevation: (visible) => dispatch(setAddAnugaElevation(visible)),
        startAnugaElevationPolling: () => dispatch(startAnugaElevationPolling()),
        stopAnugaElevationPolling: () => dispatch(stopAnugaElevationPolling())
    };
};

const AnugaAddElevationData = connect(mapStateToProps, mapDispatchToProps)(AnugaAddElevationDataClass);


export {AnugaAddElevationData};
