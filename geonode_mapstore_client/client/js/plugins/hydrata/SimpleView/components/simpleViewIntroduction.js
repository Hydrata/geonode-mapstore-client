import React from 'react';
import { connect } from 'react-redux';
const PropTypes = require('prop-types');

import {setVisibleIntroduction} from "../actionsSimpleView";
import Modal from "../../../../../MapStore2/web/client/components/misc/Modal";
import Button from "../../../../../MapStore2/web/client/components/misc/Button";

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
                            Welcome to Hydrata
                        </Modal.Title>
                    </Modal.Header>
                    <Modal.Body>
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
                            style={{marginLeft: "45%"}}
                        >
                            Accept
                        </Button>
                    </Modal.Body>
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
