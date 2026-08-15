/**
 * The project-introduction modal.
 *
 * REVIVED, NOT REWRITTEN (epic 2765 W3, TASK-2774). The shell, the accept
 * button and both analytics events already existed and were already rendered by
 * `simpleViewContainer` — the only reason nobody had ever seen it is that
 * nothing dispatched `setVisibleIntroduction(true)`. What W3 added:
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
 * ── W4 (TASK-2778): THE READ SURFACE, AND EDIT-IN-PLACE ──────────────────────
 *
 * Until W4 this modal rendered the project NAME and the baseline id and nothing
 * else, while W2 was already serving three sanitised owner-authored HTML blocks
 * and five derived statistics. The whole backend shipped half-consumed: a
 * viewer never saw one word the owner had written. W4 renders that payload and
 * adds the owner/manager editor on top of it.
 *
 * ★ THE ROLE GATE IS `data.can_edit`, AND NOTHING ELSE. The obvious-looking
 * alternative — reuse the Sharing tab's `canAdd` predicate — is wrong on THIS
 * surface, twice over. `_deriveCanAdd` (Anuga/components/membershipPanel.js) is
 * module-private and reads `state.anuga.projects.data.my_role`, the slice that
 * is (a) stale-but-truthy after an SPA hop between maps (TASK-2427) and (b)
 * never populated at all for an anonymous viewer, because `initAnugaEpic` is
 * login-gated. The introduction modal is exactly the anonymous / cross-map
 * surface, so an FE re-derivation would be blind precisely where it is used.
 * The server already answered the question: the VIEW resolves the role
 * (`_introduction_can_edit` -> `check_project_role(min_role=MANAGER)`) and the
 * serializer "never re-derives authorization, so there is exactly one place
 * that decides who may edit". `membershipPanel.js` is therefore untouched by
 * this subtask.
 *
 * ★ `*_html` IS RENDERED, `source` IS NEVER RENDERED AS HTML. W1/W2 sanitise on
 * the way OUT — the `*_html` fields are the sanitiser's output and are the only
 * safe thing to inject. `source` is the raw Markdown the owner typed, is served
 * only to a caller who may edit, and belongs in a <textarea> and nowhere else.
 *
 * ★ THE BASELINE IS NOT EDITABLE, AND IS VISIBLY NOT OWNER TEXT. Settled
 * decision 6 makes the owner an APPENDER: they add `owner_limitations`, they
 * never touch the platform disclaimer. It is not a column on
 * ProjectIntroduction, so no PATCH can reach it — but a reader cannot see a
 * database schema, so the UI carries the distinction too: the baseline sits in
 * its own labelled block, and it is rendered read-only INSIDE the editor so the
 * owner can see what they are appending to.
 *
 * NOT DISMISSABLE BY BACKDROP OR ESCAPE (`backdrop="static"`, `keyboard`
 * false). There are exactly two ways out — Accept, and the header cross — and
 * each is wired to its own analytics event. Bootstrap's defaults would route a
 * stray backdrop click through `onHide` and log it as a deliberate "cross"
 * dismissal, which is both a false analytics claim and a way to discard a
 * liability disclaimer by accident.
 *
 * ⚠ TWO WAYS OUT MEANS BOTH MUST STAY ON SCREEN. W3 found this modal was a trap
 * (fixed header painted over the cross; the theme's -25% dialog transform put
 * the header row above the viewport) and fixed it in simpleView.css. W4 makes
 * the dialog MUCH taller, and the transform was a percentage of the dialog's
 * own height, so height is the live variable: the body scrolls internally
 * (`.modal.sv-introduction-modal-host .modal-body { max-height / overflow }`)
 * rather than letting the dialog grow past the viewport and push Accept off the
 * bottom. Re-measure with a LONG body, not an empty one.
 *
 * ⚠ AN ANONYMOUS ACCEPTANCE IS NOT EVIDENCE. It is a localStorage flag that
 * stops this browser re-asking (settled decision 3). No copy here may imply a
 * record was kept.
 */
import React from 'react';
import { connect } from 'react-redux';
const PropTypes = require('prop-types');

import {acceptIntroduction, saveIntroduction, setVisibleIntroduction} from "../actionsSimpleView";
import Modal from "../../../../../MapStore2/web/client/components/misc/Modal";
import Button from "../../../../../MapStore2/web/client/components/misc/Button";
import {trackEvent} from "@js/utils/analytics";
import Message from '@mapstore/framework/components/I18N/Message';

/**
 * The three owner-authored fields, in the order they are read and edited.
 *
 * EXACTLY `ProjectIntroduction.OWNER_AUTHORED_FIELDS` — the same tuple the
 * write serializer accepts and the content version hashes. There is no fourth
 * one to add here: the baseline is not a column.
 */
const OWNER_FIELDS = ['description', 'body', 'owner_limitations'];

/** Flat msgIds — one per editable field. */
const FIELD_LABEL_IDS = {
    description: 'hydrata.simpleView.introductionFieldDescription',
    body: 'hydrata.simpleView.introductionFieldBody',
    owner_limitations: 'hydrata.simpleView.introductionFieldLimitations'
};

/**
 * "32756" -> "EPSG:32756 — UTM zone 56S (WGS 84)".
 *
 * AC B asks for a form a NON-SPECIALIST reads without help, and the payload
 * carries the bare authority code (`project.projection` is the string "32756",
 * confirmed live). A raw five-digit number tells a hydrologist everything and a
 * council planner nothing, so the well-known WGS-84 families are spelled out.
 * Anything unrecognised falls back to the qualified code rather than to a
 * guess — a wrong zone name is worse than no zone name on a page whose job is
 * an honest account of the model.
 */
export const formatProjection = (projection) => {
    if (projection === null || projection === undefined || projection === '') {
        return null;
    }
    const raw = String(projection).trim();
    if (!raw) {
        return null;
    }
    const code = raw.replace(/^EPSG:\s*/i, '');
    const n = parseInt(code, 10);
    if (!isFinite(n) || String(n) !== code) {
        return raw;
    }
    const epsg = `EPSG:${n}`;
    if (n === 4326) {
        return `${epsg} — WGS 84 latitude / longitude`;
    }
    if (n === 3857) {
        return `${epsg} — Web Mercator`;
    }
    if (n >= 32601 && n <= 32660) {
        return `${epsg} — UTM zone ${n - 32600}N (WGS 84)`;
    }
    if (n >= 32701 && n <= 32760) {
        return `${epsg} — UTM zone ${n - 32700}S (WGS 84)`;
    }
    return epsg;
};

/**
 * Square kilometres, or null when the figure is genuinely unknown.
 *
 * ⚠ NULL IS NOT ZERO. `aoi_extent_km2` is null for a project with no terrain
 * footprint — the state the dev DB and every fresh project are in — and
 * printing "0 km²" there would assert an area of nothing about a model that
 * simply has not been given a boundary yet. The caller renders an explicit
 * absence instead.
 */
export const formatAreaKm2 = (value) => {
    if (value === null || value === undefined || value === '') {
        return null;
    }
    const n = Number(value);
    if (!isFinite(n)) {
        return null;
    }
    const digits = n >= 100 ? 0 : (n >= 10 ? 1 : 2);
    return `${n.toLocaleString(undefined, {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits
    })} km²`;
};

/** An ISO timestamp as a plain date, or null when the server sent none. */
export const formatDate = (value) => {
    if (!value) {
        return null;
    }
    const d = new Date(value);
    if (isNaN(d.getTime())) {
        return null;
    }
    return d.toLocaleDateString(undefined, {year: 'numeric', month: 'short', day: 'numeric'});
};

export class simpleViewIntroduction extends React.Component {
    static propTypes = {
        setVisibleIntroduction: PropTypes.func,
        acceptIntroduction: PropTypes.func,
        saveIntroduction: PropTypes.func,
        projectId: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
        projectName: PropTypes.string,
        baselineMessageId: PropTypes.string,
        descriptionHtml: PropTypes.string,
        bodyHtml: PropTypes.string,
        ownerLimitationsHtml: PropTypes.string,
        stats: PropTypes.object,
        canEdit: PropTypes.bool,
        source: PropTypes.object,
        saving: PropTypes.bool,
        saveFailed: PropTypes.bool
    };

    static defaultProps = {
        setVisibleIntroduction: () => {},
        acceptIntroduction: () => {},
        saveIntroduction: () => {},
        projectId: null,
        projectName: null,
        baselineMessageId: null,
        descriptionHtml: '',
        bodyHtml: '',
        ownerLimitationsHtml: '',
        stats: null,
        canEdit: false,
        source: null,
        saving: false,
        saveFailed: false
    };

    /**
     * A save that LANDED closes the editor and reveals the server's own
     * re-rendered content — AC2's "without a page reload", and the reason the
     * PATCH response is a full read payload rather than a 204.
     *
     * A save that FAILED deliberately does NOT close it: the owner's text stays
     * in the textareas, because they have just typed several paragraphs and an
     * editor that closes on failure is how those get lost.
     *
     * `saveInFlight` exists because the falling EDGE is what matters, and props
     * alone cannot express an edge. (Derived here rather than in
     * componentDidUpdate: setState there is a re-render round-trip and an
     * eslint error.)
     */
    static getDerivedStateFromProps(props, state) {
        if (props.saving && !state.saveInFlight) {
            return {saveInFlight: true};
        }
        if (!props.saving && state.saveInFlight) {
            return props.saveFailed
                ? {saveInFlight: false}
                : {saveInFlight: false, editing: false, draft: null};
        }
        return null;
    }

    state = {
        editing: false,
        draft: null,
        saveInFlight: false
    };

    /** The current textarea contents, seeded from the server's Markdown. */
    draft = () => {
        if (this.state.draft) {
            return this.state.draft;
        }
        const source = this.props.source || {};
        return OWNER_FIELDS.reduce((acc, field) => ({...acc, [field]: source[field] || ''}), {});
    };

    setField = (field, value) => {
        this.setState({draft: {...this.draft(), [field]: value}});
    };

    /**
     * The platform baseline, in its own labelled block.
     *
     * Rendered in BOTH surfaces (read and edit) from the same function, so the
     * two can never drift into showing the owner different platform text than
     * the viewer sees. `readOnly` adds the "you cannot change this" note that
     * only makes sense next to editable fields.
     */
    renderBaseline = (readOnly) => {
        if (!this.props.baselineMessageId) {
            return null;
        }
        return (
            <div className={`sv-introduction-baseline-block${readOnly ? ' sv-introduction-baseline-readonly' : ''}`}>
                <span className="sv-introduction-baseline-label">
                    <Message msgId="hydrata.simpleView.introductionBaselineLabel" />
                </span>
                <p className="introduction-baseline sv-introduction-baseline-text" style={{"fontSize": "small"}}>
                    <Message msgId={this.props.baselineMessageId} />
                </p>
                {readOnly ? (
                    <p className="sv-introduction-baseline-note" style={{"fontSize": "small"}}>
                        <Message msgId="hydrata.simpleView.introductionBaselineReadOnly" />
                    </p>
                ) : null}
            </div>
        );
    };

    /**
     * The derived figures (AC B).
     *
     * Every row is auto-computed server-side — no owner-entered numbers — so an
     * introduction cannot advertise an AOI or a run count the project does not
     * actually have. Absent values print an explicit "Not recorded" rather than
     * a blank cell: a label with nothing beside it reads as a rendering bug,
     * and a zero would read as a measurement.
     */
    renderStats = () => {
        const stats = this.props.stats;
        if (!stats) {
            return null;
        }
        const absent = (
            <span className="sv-introduction-stat-absent">
                <Message msgId="hydrata.simpleView.introductionNotRecorded" />
            </span>
        );
        const area = formatAreaKm2(stats.aoi_extent_km2);
        const projection = formatProjection(stats.projection);
        const created = formatDate(stats.created);
        const modified = formatDate(stats.last_modified);
        const rows = [
            ['aoi', 'hydrata.simpleView.introductionAoi', area],
            [
                'runs',
                'hydrata.simpleView.introductionRuns',
                // 0 is a real, honest answer here (nobody has run this model
                // yet) — unlike a null AOI. `?? null` would swallow it.
                stats.run_count === null || stats.run_count === undefined
                    ? null
                    : String(stats.run_count)
            ],
            ['projection', 'hydrata.simpleView.introductionProjection', projection],
            ['created', 'hydrata.simpleView.introductionCreated', created],
            ['modified', 'hydrata.simpleView.introductionUpdated', modified]
        ];
        return (
            <section className="sv-introduction-stats">
                <h5 className="sv-introduction-section-title">
                    <Message msgId="hydrata.simpleView.introductionStatsTitle" />
                </h5>
                <dl className="sv-introduction-stat-list">
                    {rows.map(([key, msgId, value]) => (
                        <div className="sv-introduction-stat" data-stat={key} key={key}>
                            <dt><Message msgId={msgId} /></dt>
                            <dd>{value === null ? absent : value}</dd>
                        </div>
                    ))}
                </dl>
            </section>
        );
    };

    /**
     * The owner-authored halves (AC A), each rendered only when it exists.
     *
     * AC C: a project with no owner content collapses to nothing here — no
     * headings, no labels, no empty boxes — leaving the name, the derived
     * figures and the baseline, which is the state EVERY project starts in.
     */
    renderOwnerContent = () => {
        const {descriptionHtml, bodyHtml, ownerLimitationsHtml} = this.props;
        if (!descriptionHtml && !bodyHtml && !ownerLimitationsHtml) {
            return null;
        }
        return (
            <div className="sv-introduction-owner-content">
                {descriptionHtml ? (
                    <div
                        className="sv-introduction-description"
                        // Safe because this is the SANITISER'S OUTPUT, not the
                        // owner's input: W1 renders and cleans Markdown on the
                        // way out, and this payload is served to anonymous
                        // callers on a public link, so the render path is the
                        // XSS boundary. `source` must never reach here.
                        dangerouslySetInnerHTML={{__html: descriptionHtml}}
                    />
                ) : null}
                {bodyHtml ? (
                    <div
                        className="sv-introduction-prose"
                        dangerouslySetInnerHTML={{__html: bodyHtml}}
                    />
                ) : null}
                {ownerLimitationsHtml ? (
                    <section className="sv-introduction-limitations">
                        <h5 className="sv-introduction-section-title">
                            <Message msgId="hydrata.simpleView.introductionLimitationsTitle" />
                        </h5>
                        <div
                            className="sv-introduction-limitations-content"
                            dangerouslySetInnerHTML={{__html: ownerLimitationsHtml}}
                        />
                    </section>
                ) : null}
            </div>
        );
    };

    renderEditor = () => {
        const draft = this.draft();
        return (
            <div className="sv-introduction-editor">
                {/* AC4. Placed ABOVE the fields, not beside Save: the owner
                    should know the cost before they start typing, and a
                    consequence discovered at the last click is a consequence
                    discovered too late. The wording is careful — the content
                    version is a HASH of these three fields, so a save that
                    changes nothing re-prompts nobody. "Any change you save"
                    is true; "saving re-prompts everyone" would not be. */}
                <p className="sv-introduction-reprompt-warning">
                    <Message msgId="hydrata.simpleView.introductionRepromptWarning" />
                </p>
                {this.props.saveFailed ? (
                    <p className="sv-introduction-save-error">
                        <Message msgId="hydrata.simpleView.introductionSaveFailed" />
                    </p>
                ) : null}
                {OWNER_FIELDS.map((field) => (
                    <div className="sv-introduction-edit-field" key={field}>
                        <label htmlFor={`sv-introduction-edit-${field}`}>
                            <Message msgId={FIELD_LABEL_IDS[field]} />
                        </label>
                        <textarea
                            id={`sv-introduction-edit-${field}`}
                            className={`sv-introduction-edit-${field}`}
                            data-field={field}
                            rows={field === 'description' ? 3 : 6}
                            disabled={this.props.saving}
                            value={draft[field]}
                            onChange={(e) => this.setField(field, e.target.value)}
                        />
                    </div>
                ))}
                {/* AC3 — present, and unreachable. There is no control here
                    that edits it, and there is no field for it on the PATCH
                    either: the baseline is not a column on ProjectIntroduction,
                    so DRF drops it. Shown so the owner can see what their
                    limitations are being appended to. */}
                {this.renderBaseline(true)}
            </div>
        );
    };

    renderFooter = () => {
        if (this.state.editing) {
            return [
                <Button
                    key="cancel"
                    className="sv-introduction-cancel"
                    disabled={this.props.saving}
                    onClick={() => this.setState({editing: false, draft: null})}
                >
                    <Message msgId="hydrata.simpleView.cancel" />
                </Button>,
                <Button
                    key="save"
                    className="sv-introduction-save"
                    bsStyle="primary"
                    disabled={this.props.saving}
                    onClick={() => {
                        this.props.saveIntroduction(this.props.projectId, this.draft());
                        trackEvent('button', `click`, `save_introduction`);
                    }}
                >
                    <Message msgId={this.props.saving
                        ? 'hydrata.simpleView.introductionSaving'
                        : 'hydrata.simpleView.save'} />
                </Button>
            ];
        }
        return [
            // Rendered ONLY for a caller the server said may edit. Owner and
            // managers, resolved once, server-side (epic AC12).
            this.props.canEdit ? (
                <Button
                    key="edit"
                    className="sv-introduction-edit-button"
                    onClick={() => this.setState({editing: true, draft: null})}
                >
                    <Message msgId="hydrata.simpleView.introductionEdit" />
                </Button>
            ) : null,
            <Button
                key="accept"
                className="sv-introduction-accept"
                onClick={() => {
                    this.props.setVisibleIntroduction(false);
                    this.props.acceptIntroduction();
                    trackEvent('button', `click`, `close_introduction_accept`);
                }}
                bsStyle="primary"
            >
                <Message msgId="hydrata.simpleView.accept" />
            </Button>
        ];
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
                    {/* ONE platform disclaimer, and it is the baseline block
                        at the bottom (W4, TASK-2779). A second small-print
                        paragraph used to sit here rendering
                        `hydrata.simpleView.disclaimer` — an MIT software
                        warranty — and it was retired INTO
                        `hydrata.introduction.baseline` rather than left beside
                        it. Only the baseline id is covered by
                        INTRODUCTION_BASELINE_VERSION, so revising the other
                        paragraph would have shipped new legal text to every
                        already-accepted viewer with no re-prompt. Do not
                        reintroduce a second platform legal string here; append
                        to the baseline msgId and bump the version. */}
                    <Modal.Body>
                        {this.state.editing ? this.renderEditor() : (
                            <React.Fragment>
                                {this.renderOwnerContent()}
                                {this.renderStats()}
                                {this.renderBaseline(false)}
                            </React.Fragment>
                        )}
                    </Modal.Body>
                    <Modal.Footer>
                        {this.renderFooter()}
                    </Modal.Footer>
                </Modal>
            </div>
        );
    }
}

const mapStateToProps = (state) => {
    const introduction = state?.simpleView?.introduction;
    const data = introduction?.data;
    return {
        projectId: introduction?.projectId || null,
        projectName: data?.project_name || null,
        baselineMessageId: data?.baseline?.message_id || null,
        descriptionHtml: data?.description_html || '',
        bodyHtml: data?.body_html || '',
        ownerLimitationsHtml: data?.owner_limitations_html || '',
        stats: data?.stats || null,
        // ★ THE role gate. Server-resolved; never re-derived here — see the
        // module header.
        canEdit: !!data?.can_edit,
        // Null for everyone the server did not judge an editor, so the editor
        // can only ever open over content the caller is allowed to change.
        source: data?.source || null,
        saving: !!introduction?.savingIntroduction,
        saveFailed: !!introduction?.introductionSaveFailed
    };
};

const mapDispatchToProps = ( dispatch ) => {
    return {
        setVisibleIntroduction: (visible) => dispatch(setVisibleIntroduction(visible)),
        acceptIntroduction: () => dispatch(acceptIntroduction()),
        saveIntroduction: (projectId, source) => dispatch(saveIntroduction(projectId, source))
    };
};

const Introduction = connect(mapStateToProps, mapDispatchToProps)(simpleViewIntroduction);

export default Introduction;
