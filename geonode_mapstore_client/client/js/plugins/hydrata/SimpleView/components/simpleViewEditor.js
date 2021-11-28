import React from "react";
import {connect} from "react-redux";
const PropTypes = require('prop-types');
import {svSelectLayer} from '../actionsSimpleView';

import '../simpleView.css';

class SimpleViewEditorClass extends React.Component {
    static propTypes = {
        selectedLayer: PropTypes.object,
        selectedFeature: PropTypes.object,
        svSelectLayer: PropTypes.func
    };

    constructor(props) {
        super(props);
    }

    render() {
        return (
            <div className={'simple-view-panel'}>
                <div className={'row menu-row-header'}>
                    {this.props.selectedLayer?.title}
                    <span
                        className={"btn glyphicon glyphicon-remove legend-close"}
                        onClick={() => this.props.svSelectLayer(null)}
                    />
                </div>
                {
                    this.props.selectedFeature ?
                        <div className={'row menu-row-header'}>
                            {this.props.selectedFeature?.id}
                        </div> :
                        <div className={'row menu-row pull-left'}>
                            Select a feature...
                        </div>
                }
            </div>
        );
    }
}

const mapStateToProps = (state) => {
    return {
        selectedLayer: state?.simpleView?.selectedLayer,
        selectedFeature: state?.simpleView?.selectedFeature
    };
};

const mapDispatchToProps = ( dispatch ) => {
    return {
        svSelectLayer: (layer) => dispatch(svSelectLayer(layer))
    };
};

const SimpleViewEditor = connect(mapStateToProps, mapDispatchToProps)(SimpleViewEditorClass);


export {
    SimpleViewEditor
};
