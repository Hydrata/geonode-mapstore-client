import React from "react";
import {connect} from "react-redux";
const PropTypes = require('prop-types');
import {Button} from "react-bootstrap";
import '../anuga.css';

class AnugaInputMenuClass extends React.Component {
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
                <div id={'anuga-input-menu'} className={'simple-view-panel'} style={{top: "70px", width: "480px"}}>
                    <div className={'menu-rows-container'}>
                        <div className={"row menu-row pull-left"} style={{width: "480px", textAlign: "left"}}>
                            Example Text Input
                        </div>
                    </div>
                </div>
            </React.Fragment>
        );
    }
}

const mapStateToProps = (state) => {
    return {
    };
};

const mapDispatchToProps = ( dispatch ) => {
    return {
    };
};

const AnugaInputMenu = connect(mapStateToProps, mapDispatchToProps)(AnugaInputMenuClass);


export default AnugaInputMenu;
