import React from 'react';
import { connect } from 'react-redux';
const PropTypes = require('prop-types');

import {setVisibleIntroduction} from "../actionsSimpleView";
import Modal from "../../../../../MapStore2/web/client/components/misc/Modal";
import Button from "../../../../../MapStore2/web/client/components/misc/Button";
import {trackEvent} from "@js/utils/analytics";
import Message from '@mapstore/framework/components/I18N/Message';

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
                    onHide={() => {
                        this.props.setVisibleIntroduction(false);
                        trackEvent('button', `click`, `close_introduction_cross`);
                    }}
                >
                    <Modal.Header closeButton>
                        <Modal.Title id="contained-modal-title-lg">
                            <Message msgId="hydrata.simpleView.welcomeTitle" />
                        </Modal.Title>
                    </Modal.Header>
                    <Modal.Body>
                        <p style={{"fontSize": "small"}}>
                            <Message msgId="hydrata.simpleView.disclaimer" />
                        </p>
                        <Button
                            onClick = {
                                () => {
                                    this.props.setVisibleIntroduction(false);
                                    trackEvent('button', `click`, `close_introduction_accept`);
                                }
                            }
                            bsStyle="primary"
                            style={{marginLeft: "45%"}}
                        >
                            <Message msgId="hydrata.simpleView.accept" />
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
