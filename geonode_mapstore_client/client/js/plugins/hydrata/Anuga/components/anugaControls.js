import React from "react";
import {connect} from "react-redux";
const PropTypes = require('prop-types');
import {Button} from "react-bootstrap";
import '../anuga.css';

class AnugaControlsClass extends React.Component {
    static propTypes = {
        anugaGroupLength: PropTypes.number
    };

    static defaultProps = {}

    constructor(props) {
        super(props);
        this.state = {};
    }


    render() {
        return (
            <React.Fragment>
                <div id={'anuga-controls'} className={'simple-view-panel'} style={{top: this.props.anugaGroupLength * 70, width: "480px"}}>
                    <div className={'menu-rows-container'}>
                        <div className={"row menu-row pull-left"} style={{width: "480px", textAlign: "left"}}>
                            <Button
                                bsStyle={'success'}
                                bsSize={'xsmall'}
                                style={{margin: "2px", borderRadius: "2px"}}
                                onClick={() => {console.log('test12343');}}
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
        anugaGroupLength: state?.layers?.groups?.filter((group) => group.title === "Anuga")[0]?.nodes?.length
    };
};

const mapDispatchToProps = ( dispatch ) => {
    return {
    };
};

const AnugaControls = connect(mapStateToProps, mapDispatchToProps)(AnugaControlsClass);


export default AnugaControls;
