import React from "react";
import {connect} from "react-redux";
const PropTypes = require('prop-types');
import {svSelectLayer} from '../actionsSimpleView';
import {Button, Table} from "react-bootstrap";
import '../simpleView.css';
import {
    createNewFeatures,
    selectFeatures,
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
        startDrawingFeature: PropTypes.func,
        availableFeatures: PropTypes.array,
        availableAttributes: PropTypes.array,
        selectFeatures: PropTypes.func
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
                {this.props.availableFeatures ?
                    <Table className={"editor-table"}>
                        <thead>
                            <tr>
                                <th>Select</th>
                                {this.props.availableAttributes.map((attribute) =>
                                    <th>{attribute.label}</th>
                                )}
                            </tr>
                        </thead>
                        <tbody>
                            {this.props.availableFeatures?.map((feature) =>
                                <tr>
                                    <td>
                                        <input
                                            id={'feature-selector-box'}
                                            type={'radio'}
                                            name={'feature-selector'}
                                            value={false}
                                            onChange={() => this.props.selectFeatures(feature, false)}
                                        />
                                    </td>
                                    {this.props.availableAttributes?.map((attribute) =>
                                        <td>
                                            {feature?.properties[attribute.label]}
                                        </td>
                                    )}
                                </tr>
                            )}
                        </tbody>
                    </Table> :
                    this.props.selectedFeatures?.length > 0 ?
                        <div className={'row menu-row'}>
                            Selected: {this.props.selectedFeatures?.[0]?.id}
                        </div> :
                        <div className={'row menu-row'}>
                            Select a feature...
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
        selectedFeatures: state?.featuregrid?.select,
        availableFeatures: state?.featuregrid?.features || [],
        availableAttributes: state?.query?.featureTypes?.[state?.featuregrid?.selectedLayer.split('__')[0]]?.attributes || []
    };
};

const mapDispatchToProps = ( dispatch ) => {
    return {
        svSelectLayer: (layer) => dispatch(svSelectLayer(layer)),
        createNewFeatures: (features) => dispatch(createNewFeatures(features)),
        saveChanges: () => dispatch(saveChanges()),
        clearChanges: () => dispatch(clearChanges()),
        startDrawingFeature: () => dispatch(startDrawingFeature()),
        selectFeatures: (features, append) => dispatch(selectFeatures(features, append))
    };
};

const SimpleViewEditor = connect(mapStateToProps, mapDispatchToProps)(SimpleViewEditorClass);


export {
    SimpleViewEditor
};
