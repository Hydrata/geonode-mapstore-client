/**
 * The introduction modal itself (epic 2765 W3, TASK-2774).
 *
 * The two analytics events (`close_introduction_accept` /
 * `close_introduction_cross`) predate this epic and are epic AC19. They are
 * asserted here rather than eyeballed, because "the modal still fires its
 * events" is exactly the kind of claim that survives a rewrite as a comment
 * long after it stopped being true.
 */
import expect from 'expect';
import React from 'react';
import { fireEvent } from '@testing-library/react';
import mountWithProviders from '../../../../../__tests__/helpers/mountWithProviders';
import ConnectedIntroduction, { simpleViewIntroduction as Introduction } from '../simpleViewIntroduction';
import { SET_VISIBLE_INTRODUCTION, ACCEPT_INTRODUCTION } from '../../actionsSimpleView';

const VERSION = 'a'.repeat(64);

const introState = (over = {}) => ({
    simpleView: {
        introduction: {
            projectId: 13422,
            data: {
                project_name: 'Msimbazi baseline',
                content_version: VERSION,
                accepted_current_version: false,
                baseline: { message_id: 'hydrata.introduction.baseline', version: '1' },
                ...over
            }
        }
    }
});

function makeStore(state) {
    const dispatched = [];
    return {
        dispatched,
        store: {
            getState: () => state,
            subscribe: () => () => {},
            dispatch: (a) => { dispatched.push(a); return a; }
        }
    };
}

// The modal portals to document.body, so query the document rather than the
// render container.
const accept = () => Array.from(document.querySelectorAll('.modal-footer button'))[0];
const cross = () => document.querySelector('.modal-header button.close');

describe('simpleViewIntroduction — analytics (epic AC19)', () => {
    let origUmami;
    let umamiCalls;

    beforeEach(() => {
        umamiCalls = [];
        origUmami = window.umami;
        window.umami = { track: (label, props) => umamiCalls.push({ label, ...props }) };
    });
    afterEach(() => { window.umami = origUmami; });

    it('fires close_introduction_accept on Accept', () => {
        const { store, dispatched } = makeStore(introState());
        const { unmount } = mountWithProviders(<ConnectedIntroduction />, { store });

        fireEvent.click(accept());

        expect(umamiCalls.map(c => c.label)).toInclude('close_introduction_accept');
        expect(dispatched.filter(a => a.type === SET_VISIBLE_INTRODUCTION)[0].visible).toBe(false);
        unmount();
    });

    it('fires close_introduction_cross on the header cross', () => {
        const { store } = makeStore(introState());
        const { unmount } = mountWithProviders(<ConnectedIntroduction />, { store });

        fireEvent.click(cross());

        expect(umamiCalls.map(c => c.label)).toInclude('close_introduction_cross');
        unmount();
    });
});

describe('simpleViewIntroduction — accept wiring', () => {
    it('dispatches ACCEPT_INTRODUCTION as well as closing (one click to accept)', () => {
        const { store, dispatched } = makeStore(introState());
        const { unmount } = mountWithProviders(<ConnectedIntroduction />, { store });

        fireEvent.click(accept());

        expect(dispatched.filter(a => a.type === ACCEPT_INTRODUCTION).length).toBe(1);
        unmount();
    });

    it('does NOT dispatch ACCEPT_INTRODUCTION on the cross', () => {
        // The cross is "I have seen this", not "I accept it". Conflating them
        // would record a liability acknowledgement nobody made — and the viewer
        // would never be asked again.
        const { store, dispatched } = makeStore(introState());
        const { unmount } = mountWithProviders(<ConnectedIntroduction />, { store });

        fireEvent.click(cross());

        expect(dispatched.filter(a => a.type === ACCEPT_INTRODUCTION).length).toBe(0);
        unmount();
    });
});

describe('simpleViewIntroduction — content', () => {
    it('titles the modal with the project name (settled decision 5)', () => {
        const { store } = makeStore(introState());
        const { unmount } = mountWithProviders(<ConnectedIntroduction />, { store });

        expect(document.querySelector('.modal-title').textContent)
            .toContain('Msimbazi baseline');
        unmount();
    });

    it('falls back to the welcome title before the payload arrives', () => {
        const { store } = makeStore({ simpleView: {} });
        const { unmount } = mountWithProviders(<ConnectedIntroduction />, { store });

        expect(document.querySelector('.modal-title').textContent)
            .toNotContain('Msimbazi baseline');
        unmount();
    });

    it('renders the baseline block from the message id the SERVER names', () => {
        // The wording is owned by the backend + i18n (W4/TASK-2779), never
        // hard-coded here — the owner may append limitations but can never edit
        // or remove the platform baseline.
        const { store } = makeStore(introState());
        const { unmount } = mountWithProviders(<ConnectedIntroduction />, { store });

        expect(document.querySelector('.introduction-baseline')).toExist();
        unmount();
    });
});

describe('simpleViewIntroduction — not dismissable except by accept or cross (AC1)', () => {
    it('sets a static backdrop and disables the Escape key', () => {
        // Bootstrap's defaults route a backdrop click and Escape through
        // onHide, which would log a stray click as a deliberate "cross"
        // dismissal — a false analytics claim AND a way to discard a liability
        // disclaimer by accident. Asserted on the props the Modal is given,
        // because a jsdom-free backdrop click is not reliably reproducible.
        const rendered = new Introduction({}).render();
        const modal = rendered.props.children;
        expect(modal.props.backdrop).toBe('static');
        expect(modal.props.keyboard).toBe(false);
        expect(modal.props.show).toBe(true);
    });

    it('carries the layering class that makes the close cross reachable', () => {
        // Measured live: without it the fixed GeoNode header (z-index 100000)
        // painted over the dialog and `document.elementFromPoint` at the cross
        // returned `.gn-menu-content-right`, while the theme's -25% dialog
        // transform put the whole header row above the viewport. With
        // `backdrop="static"` that cross is one of only two ways out, so the
        // modal was a trap. The geometry itself is a CSS claim karma cannot
        // make; what IS pinnable is that the class survives — dropping it is
        // how the trap comes back.
        const rendered = new Introduction({}).render();
        expect(rendered.props.children.props.className).toBe('sv-introduction-modal-host');
    });
});
