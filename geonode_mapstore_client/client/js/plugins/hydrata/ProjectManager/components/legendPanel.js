import React from 'react';
import { connect } from 'react-redux';
import Legend from "../../../../../MapStore2/web/client/components/TOC/fragments/legend/Legend";

const legendPanelStyle = {
    position: "absolute",
    zIndex: 1021,
    top: "10px",
    right: "60px",
    minWidth: "400px",
    backgroundColor: "rgba(0,60,136,0.6)",
    borderColor: "rgb(255 255 255 / 70%)",
    borderWidth: "2px",
    paddingBottom: "10px",
    fontSize: "12px",
    lineHeight: "1.5",
    borderRadius: "4px",
    color: "white",
    textAlign: "right",
    overflowY: "auto",
    overflowX: "hidden",
    maxHeight: "92%"
};

const buttonStyle = {
    position: "absolute",
    zIndex: 1021,
    top: "10px",
    right: "60px",
    minWidth: "135px",
    backgroundColor: "rgba(0,60,136,0.5)",
    borderColor: "rgb(255 255 255 / 70%)",
    borderWidth: "2px",
    padding: "5px 10px",
    fontSize: "12px",
    lineHeight: "1.5",
    borderRadius: "4px",
    color: "white",
    textAlign: "center"
};

class legendPanel extends React.Component {

    constructor(props) {
        super(props);
        this.state = {
            showLegend: false
        };
    }

    render() {
        if (this.state.showLegend) {
            return (
                <div style={legendPanelStyle}>
                    <div className={"row"}>
                        <h4
                            style={{textAlign: 'center'}}
                        >
                            Legend
                        </h4>
                    </div>
                    <span
                        className={"btn glyphicon glyphicon-remove"}
                        style={{
                            position: "absolute",
                            right: "0px",
                            color: "red"
                        }}
                        onClick={() => this.setState({ showLegend: !this.state.showLegend} )}
                    />
                    {this.props.visibleLayers.map((layer) => {
                        return layer.type === 'wms' ?
                            (
                                <div
                                    key={layer.id}
                                    className={"row"}
                                    style={{
                                        padding: "10px",
                                        margin: "-1px 10px -1px 10px",
                                        border: "2px solid #ffffffad",
                                        borderRadius: "3px"
                                    }}
                                >
                                    <div
                                        className={"col-sm-6"}
                                        style={{
                                            backgroundColor: "white",
                                            padding: "3px",
                                            borderRadius: "3px"
                                        }}
                                    >
                                        <Legend
                                            layer={layer}
                                            legendHeight={12}
                                            legendWidth={12}
                                            legendOptions={"dpi:150"}
                                            style={{
                                                display: "block",
                                                marginLeft: "auto",
                                                marginRight: "auto",
                                                maxWidth: "80%",
                                                maxHeight: "auto"
                                            }}
                                        />
                                    </div>
                                    <div className={"col-sm-6"}>
                                        <span
                                            className={"h4 pull-left"}
                                            style={{
                                                textAlign: "left"
                                            }}
                                        >
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
                    style={{...buttonStyle}}
                    onClick={() => this.setState({ showLegend: !this.state.showLegend} )}
                >
                    Show Legend
                </button>
            </div>
        );
    }
}

const mapStateToProps = (state) => {
    return {
        visibleLayers: state?.layers?.flat.filter(layer => layer.visibility === true),
        openLegendPanel: state?.projectManager?.openLegendPanel
    };
};

const LegendPanel = connect(mapStateToProps, null)(legendPanel);

export default LegendPanel;
