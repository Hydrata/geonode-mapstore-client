import React from 'react';
import { connect } from 'react-redux';
const PropTypes = require('prop-types');

import Legend from "../../../../../MapStore2/web/client/components/TOC/fragments/legend/Legend";
import {setVisibleLegendPanel} from "../actionsSimpleView";

class simpleViewLegend extends React.Component {
    static propTypes = {
        setVisibleLegendPanel: PropTypes.func,
        visibleLegendPanel: PropTypes.bool,
        visibleLayers: PropTypes.array
    };

    constructor(props) {
        super(props);
        this.state = {};
    }

    render() {
        if (this.props.visibleLegendPanel) {
            return (
                <div className={'simple-view-panel legend-panel'}>
                    <div className={"row h4 legend-heading"}>
                        Legend
                        <span
                            className={"btn glyphicon glyphicon-remove legend-close"}
                            onClick={() => this.props.setVisibleLegendPanel(false)}
                        />
                    </div>
                    {this.props.visibleLayers.map((layer) => {
                        return layer.type === 'wms' ?
                            (
                                <div key={layer.id} className={"row legend-row"} >
                                    <div className={"col-sm-6 legend-background"} >
                                        <span className={"legend-image"}>
                                            <Legend
                                                layer={layer}
                                                legendHeight={12}
                                                legendWidth={12}
                                                legendOptions={"dpi:150"}
                                            />
                                        </span>
                                    </div>
                                    <div className={"col-sm-6 legend-text-label"}>
                                        <span className={"h5"}>
                                            {layer.title}
                                        </span>
                                    </div>
                                </div>)
                            : null;
                    })}
                </div>
            );
        }
        return (
            <div>
                <button
                    className={'simple-view-menu-button legend-button'}
                    onClick={() => this.props.setVisibleLegendPanel(true)}
                >
                    Show Legend
                </button>
            </div>
        );
    }
}

const mapStateToProps = (state) => {
    return {
        visibleLayers: state?.layers?.flat.filter(layer => (layer.visibility === true && layer?.group !== 'background')),
        visibleLegendPanel: state?.simpleView?.visibleLegendPanel
    };
};

const mapDispatchToProps = ( dispatch ) => {
    return {
        setVisibleLegendPanel: (visible) => dispatch(setVisibleLegendPanel(visible))
    };
};

const LegendPanel = connect(mapStateToProps, mapDispatchToProps)(simpleViewLegend);

export default LegendPanel;
