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
            <div className={'simple-view-panel legend-panel'}>
                <div className="legend-header">
                    <h4><Message msgId="hydrata.simpleView.legend" /></h4>
                    <button
                        className="legend-close"
                        onClick={() => this.props.setVisibleLegendPanel(false)}
                        title="Close"
                    >&times;</button>
                </div>
                <div className="legend-body">
                    {this.props.visibleLayers.map((layer) => {
                        const legendOverride = this.props.legendOverrides?.filter(override => override?.layerName === layer.name)?.[0];
                        if (layer.type !== 'wms') {
                            return null;
                        }
                        return legendOverride ?
                            (
                                <div key={layer.id} className={"legend-row"} >
                                    <div className={"legend-layer-title"}>{layer.title}</div>
                                    <div className={"legend-background"} >
                                        <span className={"legend-image"}>
                                            <img src={legendOverride?.staticImageFilePath}/>
                                        </span>
                                    </div>
                                </div>
                            ) :
                            (
                                <div key={layer.id} className={"legend-row"} >
                                    <div className={"legend-layer-title"}>{layer.title}</div>
                                    <div className={"legend-background"} >
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
                <div className="legend-footer">
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
