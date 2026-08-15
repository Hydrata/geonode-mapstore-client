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
import ConnectedIntroduction, {
    simpleViewIntroduction as Introduction,
    formatProjection,
    formatAreaKm2
} from '../simpleViewIntroduction';
import {
    SET_VISIBLE_INTRODUCTION,
    ACCEPT_INTRODUCTION,
    SAVE_INTRODUCTION
} from '../../actionsSimpleView';

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

// ── W4 (TASK-2778): the read surface, and edit-in-place ──────────────────────
//
// W2 had been serving three sanitised owner-authored HTML blocks and five
// derived statistics for a whole wave while this modal rendered a project name
// and a message id. Every assertion below exists because the payload being
// SERVED is not the same claim as the payload being SEEN.

const OWNER_CONTENT = {
    description_html: '<p>A rain-on-grid model of the lower Msimbazi.</p>',
    body_html: '<p>Built from 2 m LiDAR, calibrated against the 2018 flood.</p>',
    owner_limitations_html: '<p>Culverts under the railway are not represented.</p>',
    stats: {
        aoi_extent_km2: 12.5,
        run_count: 7,
        projection: '32756',
        created: '2026-08-06T16:01:05.247854Z',
        last_modified: '2026-08-07T09:12:00.000000Z'
    }
};

const EDITABLE = {
    can_edit: true,
    source: {
        description: 'A rain-on-grid model of the lower Msimbazi.',
        body: 'Built from 2 m LiDAR, calibrated against the 2018 flood.',
        owner_limitations: 'Culverts under the railway are not represented.'
    }
};

const body = () => document.querySelector('.modal-body');
const editButton = () => document.querySelector('.sv-introduction-edit-button');
const saveButton = () => document.querySelector('.sv-introduction-save');
const cancelButton = () => document.querySelector('.sv-introduction-cancel');
const textarea = (field) => document.querySelector(`.sv-introduction-edit-${field}`);
const statValue = (key) =>
    document.querySelector(`.sv-introduction-stat[data-stat="${key}"] dd`).textContent;

describe('simpleViewIntroduction — the read surface (W4 AC A)', () => {
    it('renders the three owner-authored blocks as sanitised HTML', () => {
        const { store } = makeStore(introState(OWNER_CONTENT));
        const { unmount } = mountWithProviders(<ConnectedIntroduction />, { store });

        expect(document.querySelector('.sv-introduction-description').textContent)
            .toContain('rain-on-grid model');
        expect(document.querySelector('.sv-introduction-prose').textContent)
            .toContain('2 m LiDAR');
        expect(document.querySelector('.sv-introduction-limitations-content').textContent)
            .toContain('Culverts under the railway');
        unmount();
    });

    it('NEVER renders `source` as HTML — it is Markdown for the editor', () => {
        // W1/W2 sanitise on the way OUT, so `*_html` is the sanitiser's output
        // and `source` is the raw text the owner typed. This payload is served
        // to anonymous callers on a public link; injecting `source` would move
        // the XSS boundary to the one place it is not defended.
        const { store } = makeStore(introState({
            ...EDITABLE,
            source: {
                description: '<img src=x onerror="SOURCE-ONLY">',
                body: '',
                owner_limitations: ''
            },
            description_html: '', body_html: '', owner_limitations_html: ''
        }));
        const { unmount } = mountWithProviders(<ConnectedIntroduction />, { store });

        expect(body().innerHTML).toNotContain('SOURCE-ONLY');
        expect(body().querySelector('img')).toNotExist();
        unmount();
    });
});

describe('simpleViewIntroduction — the derived figures (W4 AC B)', () => {
    it('renders all five statistics in a form a non-specialist can read', () => {
        const { store } = makeStore(introState(OWNER_CONTENT));
        const { unmount } = mountWithProviders(<ConnectedIntroduction />, { store });

        expect(statValue('aoi')).toContain('km');
        expect(statValue('aoi')).toContain('12.5');
        expect(statValue('runs')).toBe('7');
        // The payload carries the bare code "32756". A five-digit number tells
        // a hydrologist everything and a council planner nothing.
        expect(statValue('projection')).toContain('EPSG:32756');
        expect(statValue('projection')).toContain('56S');
        expect(statValue('created')).toContain('2026');
        expect(statValue('modified')).toContain('2026');
        unmount();
    });

    it('renders an honest absence for a null AOI, NEVER "0 km²" (AC B, AC E)', () => {
        // `aoi_extent_km2` is null for a project with no terrain footprint —
        // the state the dev DB and every fresh project are in. Printing 0 there
        // would assert a measurement nobody made, beside a liability
        // disclaimer.
        const { store } = makeStore(introState({
            ...OWNER_CONTENT,
            stats: { ...OWNER_CONTENT.stats, aoi_extent_km2: null }
        }));
        const { unmount } = mountWithProviders(<ConnectedIntroduction />, { store });

        expect(statValue('aoi')).toNotContain('0 km');
        expect(statValue('aoi')).toNotContain('km²');
        expect(document.querySelector(
            '.sv-introduction-stat[data-stat="aoi"] .sv-introduction-stat-absent'
        )).toExist();
        unmount();
    });

    it('renders an honest absence for null dates too (the fixture-shaped case)', () => {
        // `created`/`last_modified` are BOTH null for a project with no base
        // map — "the state every project passes through, and the state test
        // fixtures deliberately stay in" (serializers_v2.project_introduction_stats).
        const { store } = makeStore(introState({
            ...OWNER_CONTENT,
            stats: { ...OWNER_CONTENT.stats, created: null, last_modified: null }
        }));
        const { unmount } = mountWithProviders(<ConnectedIntroduction />, { store });

        expect(document.querySelector(
            '.sv-introduction-stat[data-stat="created"] .sv-introduction-stat-absent'
        )).toExist();
        expect(statValue('created')).toNotContain('Invalid');
        unmount();
    });

    it('keeps a run_count of 0 as a figure, not as an absence', () => {
        // Zero runs is a true and useful answer; a null AOI is not.
        const { store } = makeStore(introState({
            ...OWNER_CONTENT,
            stats: { ...OWNER_CONTENT.stats, run_count: 0 }
        }));
        const { unmount } = mountWithProviders(<ConnectedIntroduction />, { store });

        expect(statValue('runs')).toBe('0');
        unmount();
    });

    it('formatProjection names the WGS-84 families and never guesses', () => {
        expect(formatProjection('32756')).toContain('UTM zone 56S');
        expect(formatProjection('32633')).toContain('UTM zone 33N');
        expect(formatProjection('EPSG:4326')).toContain('WGS 84');
        expect(formatProjection('3857')).toContain('Web Mercator');
        // Unrecognised: qualified code, no invented zone name.
        expect(formatProjection('27700')).toBe('EPSG:27700');
        expect(formatProjection(null)).toBe(null);
    });

    it('formatAreaKm2 distinguishes null from zero', () => {
        expect(formatAreaKm2(null)).toBe(null);
        expect(formatAreaKm2(undefined)).toBe(null);
        expect(formatAreaKm2(12.5)).toContain('12.5');
        expect(formatAreaKm2(12.5)).toContain('km²');
    });
});

describe('simpleViewIntroduction — no owner content (W4 AC C, AC D)', () => {
    it('collapses to name + figures + baseline with no empty headings', () => {
        const { store } = makeStore(introState({
            description_html: '', body_html: '', owner_limitations_html: '',
            stats: OWNER_CONTENT.stats
        }));
        const { unmount } = mountWithProviders(<ConnectedIntroduction />, { store });

        expect(document.querySelector('.sv-introduction-owner-content')).toNotExist();
        expect(document.querySelector('.sv-introduction-limitations')).toNotExist();
        expect(document.querySelector('.modal-title').textContent)
            .toContain('Msimbazi baseline');
        expect(document.querySelector('.introduction-baseline')).toExist();
        unmount();
    });

    it('keeps the platform baseline visibly separate from owner text (AC D)', () => {
        // Settled decision 6 makes the owner an APPENDER, never an editor, of
        // the baseline. A reader cannot see a database schema, so the UI has to
        // carry that distinction too.
        const { store } = makeStore(introState(OWNER_CONTENT));
        const { unmount } = mountWithProviders(<ConnectedIntroduction />, { store });

        const baselineBlock = document.querySelector('.sv-introduction-baseline-block');
        expect(baselineBlock).toExist();
        expect(document.querySelector('.sv-introduction-baseline-label')).toExist();
        // The owner's words are NOT inside the platform block.
        expect(baselineBlock.querySelector('.sv-introduction-owner-content')).toNotExist();
        expect(baselineBlock.textContent).toNotContain('Culverts under the railway');
        unmount();
    });
});

describe('simpleViewIntroduction — the edit role gate (W4 AC1, epic AC12)', () => {
    it('offers Edit when the SERVER says this caller may edit', () => {
        const { store } = makeStore(introState({ ...OWNER_CONTENT, ...EDITABLE }));
        const { unmount } = mountWithProviders(<ConnectedIntroduction />, { store });

        expect(editButton()).toExist();
        unmount();
    });

    it('offers NO Edit to an editor / viewer / non-member (can_edit false)', () => {
        const { store } = makeStore(introState({ ...OWNER_CONTENT, can_edit: false }));
        const { unmount } = mountWithProviders(<ConnectedIntroduction />, { store });

        expect(editButton()).toNotExist();
        unmount();
    });

    it('offers NO Edit to an anonymous viewer (no payload at all)', () => {
        const { store } = makeStore({ simpleView: {} });
        const { unmount } = mountWithProviders(<ConnectedIntroduction />, { store });

        expect(editButton()).toNotExist();
        unmount();
    });

    it('does NOT re-derive the role from state.anuga — the gate is can_edit', () => {
        // ⚠ THE ONE THAT MATTERS. The Sharing tab's predicate reads
        // `state.anuga.projects.data.my_role`, a slice that is stale-but-truthy
        // after an SPA hop between maps (TASK-2427) and is NEVER populated for
        // an anonymous viewer (initAnugaEpic is login-gated). This modal is
        // exactly the anonymous / cross-map surface. Here the ANUGA panel still
        // holds the PREVIOUS project, where this viewer was the owner; the
        // server says they may not edit THIS one, and the server wins.
        const { store } = makeStore({
            anuga: { projects: { data: { id: 999, my_role: 'owner' } } },
            ...introState({ ...OWNER_CONTENT, can_edit: false })
        });
        const { unmount } = mountWithProviders(<ConnectedIntroduction />, { store });

        expect(editButton()).toNotExist();
        unmount();
    });
});

describe('simpleViewIntroduction — the editor (W4 AC2, AC3, AC4)', () => {
    it('seeds the textareas from `source`, not from the rendered HTML', () => {
        const { store } = makeStore(introState({ ...OWNER_CONTENT, ...EDITABLE }));
        const { unmount } = mountWithProviders(<ConnectedIntroduction />, { store });

        fireEvent.click(editButton());

        expect(textarea('description').value)
            .toBe('A rain-on-grid model of the lower Msimbazi.');
        expect(textarea('body').value).toContain('2 m LiDAR');
        expect(textarea('owner_limitations').value).toContain('Culverts');
        // Markdown in a textarea is text, never markup.
        expect(document.querySelector('.sv-introduction-editor img')).toNotExist();
        unmount();
    });

    it('warns BEFORE saving that a saved change re-prompts prior acceptors (AC4)', () => {
        const { store } = makeStore(introState({ ...OWNER_CONTENT, ...EDITABLE }));
        const { unmount } = mountWithProviders(<ConnectedIntroduction />, { store });

        fireEvent.click(editButton());

        const warning = document.querySelector('.sv-introduction-reprompt-warning');
        expect(warning).toExist();
        // Above the fields, not beside Save: a consequence discovered at the
        // last click is a consequence discovered too late.
        expect(warning.compareDocumentPosition(textarea('description'))
            & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        unmount();
    });

    it('shows the baseline inside the editor and offers NO control that edits it (AC3)', () => {
        const { store } = makeStore(introState({ ...OWNER_CONTENT, ...EDITABLE }));
        const { unmount } = mountWithProviders(<ConnectedIntroduction />, { store });

        fireEvent.click(editButton());

        const baselineBlock = document.querySelector('.sv-introduction-baseline-block');
        expect(baselineBlock).toExist();
        expect(baselineBlock.querySelector('textarea')).toNotExist();
        expect(baselineBlock.querySelector('input')).toNotExist();
        // Exactly three editable fields — the OWNER_AUTHORED_FIELDS tuple, and
        // there is no fourth to add: the baseline is not a column.
        expect(document.querySelectorAll('.sv-introduction-editor textarea').length).toBe(3);
        unmount();
    });

    it('dispatches SAVE_INTRODUCTION with the edited Markdown (AC2, AC5)', () => {
        const { store, dispatched } = makeStore(introState({ ...OWNER_CONTENT, ...EDITABLE }));
        const { unmount } = mountWithProviders(<ConnectedIntroduction />, { store });

        fireEvent.click(editButton());
        fireEvent.change(textarea('owner_limitations'), {
            target: { value: 'Culverts are not represented. Bridges are.' }
        });
        fireEvent.click(saveButton());

        const saves = dispatched.filter(a => a.type === SAVE_INTRODUCTION);
        expect(saves.length).toBe(1);
        expect(saves[0].projectId).toBe(13422);
        expect(saves[0].source.owner_limitations)
            .toBe('Culverts are not represented. Bridges are.');
        // Untouched fields still travel, so a PATCH can never blank one by
        // omission on a partial serializer.
        expect(saves[0].source.description)
            .toBe('A rain-on-grid model of the lower Msimbazi.');
        expect(Object.keys(saves[0].source).sort())
            .toEqual(['body', 'description', 'owner_limitations']);
        unmount();
    });

    it('Cancel leaves without dispatching a save', () => {
        const { store, dispatched } = makeStore(introState({ ...OWNER_CONTENT, ...EDITABLE }));
        const { unmount } = mountWithProviders(<ConnectedIntroduction />, { store });

        fireEvent.click(editButton());
        fireEvent.change(textarea('body'), { target: { value: 'discard me' } });
        fireEvent.click(cancelButton());

        expect(dispatched.filter(a => a.type === SAVE_INTRODUCTION).length).toBe(0);
        expect(document.querySelector('.sv-introduction-editor')).toNotExist();
        expect(editButton()).toExist();
        unmount();
    });
});

describe('simpleViewIntroduction — what a landed save does (W4 AC2)', () => {
    // Driven on the UNCONNECTED component, because this is a props transition
    // (saving true -> false with new content) and the passthrough store used
    // everywhere else in this file never notifies subscribers.
    const editable = {
        projectId: 13422,
        canEdit: true,
        baselineMessageId: 'hydrata.introduction.baseline',
        descriptionHtml: '<p>Old summary.</p>',
        source: { description: 'Old summary.', body: '', owner_limitations: '' }
    };

    it('closes the editor and shows the SERVER\'s new content — no reload', () => {
        const saves = [];
        const { rerender, unmount } = mountWithProviders(
            <Introduction {...editable} saveIntroduction={(id, src) => saves.push({ id, src })} />
        );

        fireEvent.click(editButton());
        fireEvent.change(textarea('description'), { target: { value: 'New summary.' } });
        fireEvent.click(saveButton());
        expect(saves.length).toBe(1);

        rerender(<Introduction {...editable} saving />);
        expect(document.querySelector('.sv-introduction-editor')).toExist();

        // The PATCH response IS the full read payload, which is why a save
        // needs no follow-up GET and no page reload.
        rerender(<Introduction
            {...editable}
            saving={false}
            descriptionHtml="<p>New summary.</p>"
            source={{ description: 'New summary.', body: '', owner_limitations: '' }}
        />);

        expect(document.querySelector('.sv-introduction-editor')).toNotExist();
        expect(document.querySelector('.sv-introduction-description').textContent)
            .toContain('New summary.');
        unmount();
    });

    it('a FAILED save keeps the editor open with the owner\'s text intact', () => {
        // The owner has just typed several paragraphs. A Save button that
        // quietly does nothing is how that text gets lost.
        const { rerender, unmount } = mountWithProviders(<Introduction {...editable} />);

        fireEvent.click(editButton());
        fireEvent.change(textarea('description'), { target: { value: 'Unsaved words.' } });
        fireEvent.click(saveButton());

        rerender(<Introduction {...editable} saving />);
        rerender(<Introduction {...editable} saving={false} saveFailed />);

        expect(document.querySelector('.sv-introduction-editor')).toExist();
        expect(document.querySelector('.sv-introduction-save-error')).toExist();
        expect(textarea('description').value).toBe('Unsaved words.');
        unmount();
    });
});
