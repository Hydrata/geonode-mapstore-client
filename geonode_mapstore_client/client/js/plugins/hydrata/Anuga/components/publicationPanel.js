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
    };

    static defaultProps = {}

    render() {
        // console.log('this.state:', this.state)
        return (
            <div id={'publication-panel'} className={'simple-view-panel'} style={{top: "70px"}}>
                <div className={'menu-rows-container'}>
                    <div className={"row menu-row-header"} style={{height: "40px", textAlign: "left", fontSize: "large"}}>
                        Publish
                        <span
                            className={"btn glyphicon glyphicon-remove legend-close"}
                            onClick={
                                () => {
                                    this.props.setPublicationPanel(false);
                                }
                            }
                        />
                    </div>
                    <div>Content</div>
                </div>
            </div>
        );
    }
}

const mapStateToProps = (state) => {
    return {
        publication: state?.anuga?.projectData?.publication
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
