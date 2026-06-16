/*
 * TASK-1668 — HGeval ↔ SimpleView primitive conformance (DOM contract).
 *
 * HGeval was a fully-light panel; the migration swaps its three live
 * `.alert.alert-danger` blocks for the shared <ErrorStrip> primitive
 * (token-backed red-left-border, role="alert", self-hiding on the happy path).
 *
 * These tests pin the SUBSTITUTION, not the styling:
 *   - error text now surfaces inside `.sv-error-strip[role="alert"]`,
 *   - the legacy `.alert-danger` / `.hgeval-alert-sm` hooks are gone from the
 *     rendered tree of the two LIVE components (input panel + signup form),
 *   - ErrorStrip self-hides when there is no error (no stray alert box).
 *
 * The presentational components read placeholder strings via
 * `getMessageById(context.messages, …)`, so a tiny context provider seeds an
 * empty `messages` map (LocaleUtils tolerates a missing key → returns the id).
 */
import expect from 'expect';
import React from 'react';
import PropTypes from 'prop-types';
import { render } from '@testing-library/react';
import HGevalInputPanel from '../components/hgevalInputPanel';
import HGevalSignupForm from '../components/hgevalSignupForm';

// Minimal legacy-context provider: HGeval components pull `messages` off React
// legacy context for getMessageById placeholder lookups.
class MessagesContext extends React.Component {
    static childContextTypes = { messages: PropTypes.object };
    getChildContext() { return { messages: {} }; }
    render() { return this.props.children; }
}
MessagesContext.propTypes = { children: PropTypes.node };

const noop = () => {};
const emptyForm = { name: '', description: '', sector: '', contact_email: '', contact_phone_number: '' };

function renderInput(extra) {
    return render(
        <MessagesContext>
            <HGevalInputPanel
                coordinates={null}
                form={emptyForm}
                onSetCoordinates={noop}
                onUpdateForm={noop}
                onStartReport={noop}
                onCancel={noop}
                {...extra}
            />
        </MessagesContext>
    );
}

function renderSignup(extra) {
    return render(
        <MessagesContext>
            <HGevalSignupForm
                signupErrors={null}
                signingUp={false}
                loginErrors={null}
                loggingIn={false}
                onSignupAndSave={noop}
                onLoginAndSave={noop}
                {...extra}
            />
        </MessagesContext>
    );
}

describe('TASK-1668 HGeval ErrorStrip conformance', () => {

    it('input panel surfaces validationError inside an ErrorStrip role=alert', () => {
        const { container } = renderInput({ validationError: 'Coordinates are out of range' });
        const strip = container.querySelector('.sv-error-strip[role="alert"]');
        expect(strip).toExist();
        expect(strip.textContent).toInclude('Coordinates are out of range');
    });

    it('input panel surfaces a server error inside an ErrorStrip', () => {
        const { container } = renderInput({ error: 'Server unavailable' });
        const strip = container.querySelector('.sv-error-strip[role="alert"]');
        expect(strip).toExist();
        expect(strip.textContent).toInclude('Server unavailable');
    });

    it('input panel renders NO alert box and NO legacy alert-danger hook when there is no error', () => {
        const { container } = renderInput({});
        expect(container.querySelector('.sv-error-strip')).toNotExist();
        expect(container.querySelector('.alert-danger')).toNotExist();
        expect(container.querySelector('.hgeval-alert-sm')).toNotExist();
    });

    it('signup form surfaces a server detail error inside an ErrorStrip', () => {
        // Form defaults to mode='signup', so the server detail comes from signupErrors.
        const { container } = renderSignup({ signupErrors: { detail: 'Email already registered' } });
        const strip = container.querySelector('.sv-error-strip[role="alert"]');
        expect(strip).toExist();
        expect(strip.textContent).toInclude('Email already registered');
        // The legacy bootstrap alert class is gone from the rendered tree.
        expect(container.querySelector('.alert-danger')).toNotExist();
    });

    it('signup form renders no ErrorStrip when there is no server detail error', () => {
        const { container } = renderSignup({});
        expect(container.querySelector('.sv-error-strip')).toNotExist();
    });
});
