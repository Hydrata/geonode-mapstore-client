import React from "react";
import {connect} from "react-redux";
const PropTypes = require('prop-types');
import {Table, Button, OverlayTrigger, Tooltip} from "react-bootstrap";
import {setOpenMenuGroupId} from "../../SimpleView/actionsSimpleView";
import '../anuga.css';
import '../../SimpleView/simpleView.css';
import {
    setPublicationPanel
} from "../actionsAnuga";
import {ReviewPanel} from "@js/plugins/hydrata/Anuga/components/reviewPanel";

class PublicationPanelClass extends React.Component {
    static propTypes = {
        publications: PropTypes.array,
        setPublicationPanel: PropTypes.func,
        geonodeUrl: PropTypes.string
    };

    static defaultProps = {}

    render() {
        // console.log('this.state:', this.state)
        return (
            <div id={'publication-panel'} className={'simple-view-panel'} style={{top: "70px"}}>
                <div className={'menu-rows-container'}>
                    <div className={"row menu-row-header"} style={{height: "40px", textAlign: "left", fontSize: "large"}}>
                        <span
                            className={"btn glyphicon glyphicon-remove legend-close"}
                            onClick={
                                () => {
                                    this.props.setPublicationPanel(false);
                                }
                            }
                        />
                    </div>
                    {
                        this.props.publications?.map(publication =>
                            <div className={"row menu-row-header"} style={{height: "40px", textAlign: "left", fontSize: "large"}}>
                                <span style={{lineHeight: "40px"}}>{publication?.geostory?.title}</span>
                                <Button
                                    bsStyle={'success'}
                                    bsSize={'xlarge'}
                                    style={{marginTop: "4px", borderRadius: "2px", "float": "right", display: "inlineBlock"}}
                                    onClick={() => {
                                        window.open(publication?.geostory?.detail_url, '_blank').focus();
                                    }}
                                >
                                    Edit Publication
                                </Button>
                                <h3 style={{display: "inlineBlock"}}>
                                    Figures
                                </h3>
                                {
                                    publication?.figures?.map(figure =>
                                        <Button
                                            bsStyle={'success'}
                                            bsSize={'xsmall'}
                                            style={{borderRadius: "2px"}}
                                            onClick={() => {
                                                window.open(figure?.detail_url, '_blank').focus();
                                            }}
                                        >
                                            {figure?.title}
                                        </Button>
                                    )
                                }
                                <div>
                                    <Button
                                        bsStyle={'success'}
                                        bsSize={'xsmall'}
                                        style={{margin: "2px", borderRadius: "2px", "float": "left"}}
                                        onClick={() => {
                                            window.open(`${this.props.geonodeUrl}catalogue/#/map/new`, '_blank').focus();
                                        }}
                                    >
                                        Create New Figure
                                    </Button>
                                </div>
                            </div>
                        )
                    }
                </div>
            </div>
        );
    }
}

const mapStateToProps = (state) => {
    return {
        publications: state?.anuga?.publications || [],
        geonodeUrl: state?.gnsettings?.geonodeUrl
    };
};

const mapDispatchToProps = ( dispatch ) => {
    return {
        setOpenMenuGroupId: (menuGroup) => dispatch(setOpenMenuGroupId(menuGroup)),
        setPublicationPanel: (visible) => dispatch(setPublicationPanel(visible))
    };
};

const PublicationPanel = connect(mapStateToProps, mapDispatchToProps)(PublicationPanelClass);


export {
    PublicationPanel
};
