/**
 * The project-introduction modal.
 *
 * REVIVED, NOT REWRITTEN (epic 2765 W3, TASK-2774). The shell, the accept
 * button and both analytics events already existed and were already rendered by
 * `simpleViewContainer` — the only reason nobody had ever seen it is that
 * nothing dispatched `setVisibleIntroduction(true)`. What is new here is:
 *
 *   - the title is THIS project's name when the payload has arrived (settled
 *     decision 5: the splash title is `Project.name`, and there is no title
 *     column on ProjectIntroduction, so it can never fork into two sources);
 *   - the platform Baseline disclaimer is rendered from the message id the
 *     server names (`baseline.message_id`), so the wording is owned by the
 *     backend + i18n rather than hard-coded here;
 *   - Accept dispatches `acceptIntroduction()`, which persists by whichever
 *     route settled decision 3 allows for this viewer (see epicsIntroduction).
 *
 * ⚠ `hydrata.introduction.baseline` DOES NOT RESOLVE YET — W4 (TASK-2779) lands
 * the en/fr wording. Until then the raw id renders, and that is the expected
 * W3 state, not a bug to paper over with invented disclaimer text. The existing
 * `hydrata.simpleView.disclaimer` (a populated AS-IS warranty paragraph in
 * en-US/es-ES/fr-FR/ht-HT) stays above it and carries the modal in the
 * meantime.
 *
 * NOT DISMISSABLE BY BACKDROP OR ESCAPE (`backdrop="static"`, `keyboard`
 * false). There are exactly two ways out — Accept, and the header cross — and
 * each is wired to its own analytics event. Bootstrap's defaults would route a
 * stray backdrop click through `onHide` and log it as a deliberate "cross"
 * dismissal, which is both a false analytics claim and a way to discard a
 * liability disclaimer by accident.
 *
 * ⚠ AN ANONYMOUS ACCEPTANCE IS NOT EVIDENCE. It is a localStorage flag that
 * stops this browser re-asking (settled decision 3). No copy here may imply a
 * record was kept.
 */
import React from 'react';
import { connect } from 'react-redux';
const PropTypes = require('prop-types');

import {acceptIntroduction, setVisibleIntroduction} from "../actionsSimpleView";
import Modal from "../../../../../MapStore2/web/client/components/misc/Modal";
import Button from "../../../../../MapStore2/web/client/components/misc/Button";
import {trackEvent} from "@js/utils/analytics";
import Message from '@mapstore/framework/components/I18N/Message';

export class simpleViewIntroduction extends React.Component {
    static propTypes = {
        setVisibleIntroduction: PropTypes.func,
        acceptIntroduction: PropTypes.func,
        projectName: PropTypes.string,
        baselineMessageId: PropTypes.string
    };

    static defaultProps = {
        setVisibleIntroduction: () => {},
        acceptIntroduction: () => {},
        projectName: null,
        baselineMessageId: null
    };

    render() {
        return (
            <div className={'introduction-container'}>
                <Modal
                    show
                    backdrop="static"
                    keyboard={false}
                    // Lifts the dialog above the fixed GeoNode header, which
                    // painted over it and made the close cross unclickable —
                    // i.e. a `backdrop="static"` trap — and cancels the theme's
                    // -25% transform that put its header row off the top of the
                    // viewport. Both measured live; see simpleView.css.
                    className="sv-introduction-modal-host"
                    onHide={() => {
                        this.props.setVisibleIntroduction(false);
                        trackEvent('button', `click`, `close_introduction_cross`);
                    }}
                >
                    <Modal.Header closeButton>
                        <Modal.Title id="contained-modal-title-lg">
                            {this.props.projectName
                                ? this.props.projectName
                                : <Message msgId="hydrata.simpleView.welcomeTitle" />}
                        </Modal.Title>
                    </Modal.Header>
                    <Modal.Body>
                        <p style={{"fontSize": "small"}}>
                            <Message msgId="hydrata.simpleView.disclaimer" />
                        </p>
                        {this.props.baselineMessageId ? (
                            <p className="introduction-baseline" style={{"fontSize": "small"}}>
                                <Message msgId={this.props.baselineMessageId} />
                            </p>
                        ) : null}
                    </Modal.Body>
                    <Modal.Footer>
                        <Button
                            onClick = {
                                () => {
                                    this.props.setVisibleIntroduction(false);
                                    this.props.acceptIntroduction();
                                    trackEvent('button', `click`, `close_introduction_accept`);
                                }
                            }
                            bsStyle="primary"
                        >
                            <Message msgId="hydrata.simpleView.accept" />
                        </Button>
                    </Modal.Footer>
                </Modal>
            </div>
        );
    }
}

const mapStateToProps = (state) => {
    const data = state?.simpleView?.introduction?.data;
    return {
        projectName: data?.project_name || null,
        baselineMessageId: data?.baseline?.message_id || null
    };
};

const mapDispatchToProps = ( dispatch ) => {
    return {
        setVisibleIntroduction: (visible) => dispatch(setVisibleIntroduction(visible)),
        acceptIntroduction: () => dispatch(acceptIntroduction())
    };
};

const Introduction = connect(mapStateToProps, mapDispatchToProps)(simpleViewIntroduction);

export default Introduction;
