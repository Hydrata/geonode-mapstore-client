import React from "react";
import {connect} from "react-redux";
const PropTypes = require('prop-types');
import {svSelectLayer} from '../actionsSimpleView';
import {Button} from "react-bootstrap";
import '../simpleView.css';
import {
    createNewFeatures,
    saveChanges,
    clearChanges,
    startDrawingFeature
} from "../../../../../MapStore2/web/client/actions/featuregrid";

class SimpleViewEditorClass extends React.Component {
    static propTypes = {
        selectedLayer: PropTypes.object,
        selectedFeatures: PropTypes.array,
        svSelectLayer: PropTypes.func,
        createNewFeatures: PropTypes.func,
        saveChanges: PropTypes.func,
        clearChanges: PropTypes.func,
        startDrawingFeature: PropTypes.func
    };

    constructor(props) {
        super(props);
    }

    render() {
        return (
            <div className={'simple-view-panel'} id={'simple-view-editor'}>
                <div className={'row menu-row-header'}>
                    {this.props.selectedLayer?.title}
                    <span
                        className={"btn glyphicon glyphicon-remove legend-close"}
                        onClick={() => this.props.svSelectLayer(null)}
                    />
                </div>
                {
                    this.props.selectedFeatures?.length > 0 ?
                        <div className={'row menu-row'}>
                            Selected: {this.props.selectedFeatures?.[0]?.id}
                        </div> :
                        <div className={'row menu-row'}>
                            Select a feature from the map...
                        </div>
                }
                <div className={'row menu-row'}>
                    {
                        this.props.selectedFeatures?.length > 0 ?
                            <React.Fragment>
                                <Button
                                    bsStyle={'success'}
                                    bsSize={'xsmall'}
                                    style={{margin: "2px", borderRadius: "2px"}}
                                    onClick={() => {
                                        this.props.saveChanges();
                                    }}
                                >
                                    Save Feature
                                </Button>
                                <Button
                                    bsStyle={'danger'}
                                    bsSize={'xsmall'}
                                    style={{margin: "2px", borderRadius: "2px"}}
                                    onClick={() => {
                                        this.props.clearChanges();
                                    }}
                                >
                                    Cancel
                                </Button>
                            </React.Fragment> :
                            <Button
                                bsStyle={'success'}
                                bsSize={'xsmall'}
                                style={{margin: "2px", borderRadius: "2px"}}
                                onClick={() => {
                                    this.props.createNewFeatures([{}]);
                                    this.props.startDrawingFeature();
                                }}
                            >
                                Create Feature
                            </Button>
                    }
                </div>
            </div>
        );
    }
}

const mapStateToProps = (state) => {
    return {
        selectedLayer: state?.simpleView?.selectedLayer,
        selectedFeatures: state?.featuregrid?.select
    };
};

const mapDispatchToProps = ( dispatch ) => {
    return {
        svSelectLayer: (layer) => dispatch(svSelectLayer(layer)),
        createNewFeatures: (features) => dispatch(createNewFeatures(features)),
        saveChanges: () => dispatch(saveChanges()),
        clearChanges: () => dispatch(clearChanges()),
        startDrawingFeature: () => dispatch(startDrawingFeature())
    };
};

const SimpleViewEditor = connect(mapStateToProps, mapDispatchToProps)(SimpleViewEditorClass);


export {
    SimpleViewEditor
};
