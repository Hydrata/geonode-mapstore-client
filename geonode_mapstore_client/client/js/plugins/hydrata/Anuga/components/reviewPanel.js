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

class ReviewPanelClass extends React.Component {
    static propTypes = {
        setReviewPanel: PropTypes.func
    };

    static defaultProps = {}

    render() {
        // console.log('this.state:', this.state)
        return (
            <div id={'publication-panel'} className={'simple-view-panel'} style={{top: "70px"}}>
                <div className={'menu-rows-container'}>
                    <div className={"row menu-row-header"} style={{height: "40px", textAlign: "left", fontSize: "large"}}>
                        -- Under development -- Model review process.
                        <span
                            className={"btn glyphicon glyphicon-remove legend-close"}
                            onClick={
                                () => {
                                    this.props.setReviewPanel(false);
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
        review: state?.anuga?.projectData?.review
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
