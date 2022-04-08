import React from 'react';
import { connect } from 'react-redux';
const PropTypes = require('prop-types');

import {setVisibleIntroduction} from "../actionsSimpleView";
import {Modal, Button} from "react-bootstrap";

class simpleViewIntroduction extends React.Component {
    static propTypes = {
        setVisibleIntroduction: PropTypes.func
    };

    constructor(props) {
        super(props);
        this.state = {};
    }

    componentDidMount() {
    }

    render() {
        return (
            <div className={'introduction-container'}>
                <Modal
                    show
                    onHide={() => this.props.setVisibleIntroduction(false)}
                >
                    <Modal.Header closeButton>
                        <Modal.Title id="contained-modal-title-lg">
                            Welcome to the HydrataHub preview!
                        </Modal.Title>
                    </Modal.Header>
                    <Modal.Body>
                        <p>This application is not ready for production use yet.</p>
                        <p>
                            We are currently working with a select number of projects to
                            develop and improve the application.<br/><br/>
                            Once this process is complete, we will notify you and invite you to
                            create permanent projects.<br/><br/>
                            Until then, feel free to try out the interface as much as you like - but
                            do be aware we cannot guarantee data integrity until we formally launch the application.<br/><br/>
                            Feedback is welcome via <a href="mailto:david.kennewell@hydrata.com">david.kennewell@hydrata.com</a>
                        </p>
                    </Modal.Body>
                    <Modal.Footer style={{"textAlign": "left"}}>
                        <p style={{"fontSize": "small"}}>
                            The application is provided "as-is", without warranty of any kind, express or implied, including but not limited to
                            the warranties of merchantability, firness for a particular pupose and noninfringement. In no event shall the authors or
                            copyright holders be liable for any claim, damages or other liability, whether in an action of
                            contract, tort or otherwise, arising from, out of or in connection with the software or the use or other dealings in the
                            software.
                        </p>
                        <Button
                            onClick={() => this.props.setVisibleIntroduction(false)}
                            bsStyle="primary"
                        >
                            Accept
                        </Button>
                    </Modal.Footer>
                </Modal>
            </div>
        );
    }
}

const mapStateToProps = () => {
    return {
    };
};

const mapDispatchToProps = ( dispatch ) => {
    return {
        setVisibleIntroduction: (visible) => dispatch(setVisibleIntroduction(visible))
    };
};

const Introduction = connect(mapStateToProps, mapDispatchToProps)(simpleViewIntroduction);

export default Introduction;
