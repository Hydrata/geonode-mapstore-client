import React from 'react';
import { connect } from 'react-redux';
const PropTypes = require('prop-types');

import Legend from "../../../../../MapStore2/web/client/plugins/TOC/components/Legend";
import {setVisibleLegendPanel} from "../actionsSimpleView";
import Message from '@mapstore/framework/components/I18N/Message';

class simpleViewLegend extends React.Component {
    static propTypes = {
        setVisibleLegendPanel: PropTypes.func,
        visibleLegendPanel: PropTypes.bool,
        visibleLayers: PropTypes.array,
        legendOverrides: PropTypes.array
    };

    constructor(props) {
        super(props);
        this.state = {};
    }

    render() {
        if (!this.props.visibleLegendPanel) {
            return null;
        }
        return (
            <div className={'simple-view-panel sv-legend-panel'}>
                <div className="sv-legend-header">
                    <h4><Message msgId="hydrata.simpleView.legend" /></h4>
                    <button
                        className="sv-legend-close"
                        onClick={() => this.props.setVisibleLegendPanel(false)}
                        title="Close"
                    >&times;</button>
                </div>
                <div className="sv-legend-body">
                    {this.props.visibleLayers.map((layer) => {
                        const legendOverride = this.props.legendOverrides?.filter(override => override?.layerName === layer.name)?.[0];
                        if (layer.type !== 'wms') {
                            return null;
                        }
                        return legendOverride ?
                            (
                                <div key={layer.id} className={"sv-legend-row"} >
                                    <div className={"sv-legend-layer-title"}>{layer.title}</div>
                                    <div className={"sv-legend-background"} >
                                        <span className={"sv-legend-image"}>
                                            <img src={legendOverride?.staticImageFilePath}/>
                                        </span>
                                    </div>
                                </div>
                            ) :
                            (
                                <div key={layer.id} className={"sv-legend-row"} >
                                    <div className={"sv-legend-layer-title"}>{layer.title}</div>
                                    <div className={"sv-legend-background"} >
                                        <Legend
                                            layer={layer}
                                            legendHeight={20}
                                            legendWidth={20}
                                            legendOptions={"forceLabels:on;fontAntiAliasing:true"}
                                            style={{maxWidth: "100%"}}
                                        />
                                    </div>
                                </div>
                            );
                    })}
                </div>
                <div className="sv-legend-footer">
                    <button
                        className="simple-view-panel-button"
                        onClick={() => this.props.setVisibleLegendPanel(false)}
                    >
                        <Message msgId="hydrata.simpleView.close" />
                    </button>
                </div>
            </div>
        );
    }
}

const mapStateToProps = (state, ownProps) => {
    return {
        visibleLayers: state?.layers?.flat?.filter(layer => (layer?.visibility === true && layer?.group !== 'background')),
        visibleLegendPanel: state?.simpleView?.visibleLegendPanel,
        legendOverrides: state?.simpleView?.config?.legendOverrides || ownProps?.legendOverrides || []
    };
};

const mapDispatchToProps = ( dispatch ) => {
    return {
        setVisibleLegendPanel: (visible) => dispatch(setVisibleLegendPanel(visible))
    };
};

const LegendPanel = connect(mapStateToProps, mapDispatchToProps)(simpleViewLegend);

export default LegendPanel;
