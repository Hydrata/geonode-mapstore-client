import React from "react";
import {connect} from "react-redux";
const PropTypes = require('prop-types');
import {Button} from "react-bootstrap";
import {initSwamps} from "../actionsSwamps";
import '../swamps.css';

class SwampsControlsClass extends React.Component {
    static propTypes = {
        initSwamps: PropTypes.func,
        swampGroupLength: PropTypes.number
    };

    static defaultProps = {}

    constructor(props) {
        super(props);
        this.state = {};
    }


    render() {
        return (
            <React.Fragment>
                <div id={'swamps-controls'} className={'simple-view-panel'} style={{top: this.props.swampGroupLength * 70, width: "480px"}}>
                    <div className={'menu-rows-container'}>
                        <div className={"row menu-row pull-left"} style={{width: "480px", textAlign: "left"}}>
                            <Button
                                bsStyle={'success'}
                                bsSize={'xsmall'}
                                style={{margin: "2px", borderRadius: "2px"}}
                                onClick={() => {this.props.initSwamps();}}
                            >
                                Refresh Monitoring Data
                            </Button>
                        </div>
                    </div>
                </div>
            </React.Fragment>
        );
    }
}

const mapStateToProps = (state) => {
    return {
        swampGroupLength: state?.layers?.groups?.filter((group) => group.title === "Swamps")[0]?.nodes?.length
    };
};

const mapDispatchToProps = ( dispatch ) => {
    return {
        initSwamps: () => dispatch(initSwamps())
    };
};

const SwampsControls = connect(mapStateToProps, mapDispatchToProps)(SwampsControlsClass);


export default SwampsControls;
