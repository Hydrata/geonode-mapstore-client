import React from "react";
import {connect} from "react-redux";
const PropTypes = require('prop-types');
import {Table, Button, OverlayTrigger, Tooltip} from "react-bootstrap";
import {setOpenMenuGroupId} from "../../SimpleView/actionsSimpleView";
import '../anuga.css';
import '../../SimpleView/simpleView.css';
import {
    setReviewPanel
} from "../actionsAnuga";
import Message from '@mapstore/framework/components/I18N/Message';

// NOTE: this component is not currently rendered by anugaContainer.js
class ReviewPanelClass extends React.Component {
    static propTypes = {
        setReviewPanel: PropTypes.func
    };

    static defaultProps = {}

    render() {
        // console.log('this.state:', this.state)
        return (
            <div id={'review-panel'} className={'simple-view-panel anuga-panel'}>
                <div className={'menu-rows-container'}>
                    <div className={"row menu-row-header"} style={{height: "40px", textAlign: "left", fontSize: "large"}}>
                        <Message msgId="hydrata.anuga.underDevelopment" />
                        <span
                            className={"btn glyphicon glyphicon-remove legend-close"}
                            onClick={
                                () => {
                                    this.props.setReviewPanel(false);
                                }
                            }
                        />
                    </div>
                    <div><Message msgId="hydrata.anuga.content" /></div>
                </div>
            </div>
        );
    }
}

const mapStateToProps = (state) => {
    return {
        review: state?.anuga?.projects?.data?.review
    };
};

const mapDispatchToProps = ( dispatch ) => {
    return {
        setOpenMenuGroupId: (menuGroup) => dispatch(setOpenMenuGroupId(menuGroup)),
        setReviewPanel: (visible) => dispatch(setReviewPanel(visible))
    };
};

const ReviewPanel = connect(mapStateToProps, mapDispatchToProps)(ReviewPanelClass);


export {
    ReviewPanel
};
