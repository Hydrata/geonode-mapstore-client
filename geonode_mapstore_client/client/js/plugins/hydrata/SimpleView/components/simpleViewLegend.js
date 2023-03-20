import React from 'react';
import { connect } from 'react-redux';
const PropTypes = require('prop-types');

import {changeActiveSearchTool} from "../../../../../MapStore2/web/client/actions/search";

import Legend from "../../../../../MapStore2/web/client/components/TOC/fragments/legend/Legend";
import {setVisibleLegendPanel} from "../actionsSimpleView";

class simpleViewLegend extends React.Component {
    static propTypes = {
        setVisibleLegendPanel: PropTypes.func,
        visibleLegendPanel: PropTypes.bool,
        visibleLayers: PropTypes.array,
        searchBarVisible: PropTypes.bool,
        changeActiveSearchTool: PropTypes.func
    };

    constructor(props) {
        super(props);
        this.state = {};
    }

    componentDidMount() {
        this.props.searchBarVisible ? this.props.changeActiveSearchTool("coordinatesSearch") : null;
    }

    render() {
        if (this.props.visibleLegendPanel) {
            return (
                <div className={'simple-view-panel ' + (this.props.searchBarVisible ? "legend-panel-with-search" : "legend-panel")}>
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
                                    <div className={"col-sm-7 legend-background"} >
                                        <span className={"legend-image"}>
                                            <Legend
                                                layer={layer}
                                                legendHeight={12}
                                                legendWidth={12}
                                                legendOptions={"dpi:150; countMatched:true; hideEmptyRules:true"}
                                                scales={[100000]}
                                                scaleDependent
                                            />
                                        </span>
                                    </div>
                                    <div className={"col-sm-5 legend-text-label"}>
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
                    className={'simple-view-menu-button ' + (this.props.searchBarVisible ? "legend-button-with-search" : "legend-button")}
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
        visibleLayers: state?.layers?.flat.filter(layer => (layer?.visibility === true && layer?.group !== 'background')),
        visibleLegendPanel: state?.simpleView?.visibleLegendPanel,
        searchBarVisible: !!state?.localConfig?.plugins?.map_view?.find(x => x.name === "Search")
    };
};

const mapDispatchToProps = ( dispatch ) => {
    return {
        setVisibleLegendPanel: (visible) => dispatch(setVisibleLegendPanel(visible)),
        changeActiveSearchTool: (activeSearchTool) => dispatch(changeActiveSearchTool(activeSearchTool))
    };
};

const LegendPanel = connect(mapStateToProps, mapDispatchToProps)(simpleViewLegend);

export default LegendPanel;
