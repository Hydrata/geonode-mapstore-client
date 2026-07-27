import React from "react";
import {connect} from "react-redux";
const PropTypes = require('prop-types');
import {Button} from "react-bootstrap";
import '../anuga.css';
import '../../SimpleView/simpleView.css';
import {
    setMembershipPanel,
    fetchMemberships,
    updateMembershipRequest,
    deleteMembershipRequest,
    updateProjectVisibilityRequest,
    // TASK-860 — invitation actions
    fetchInvitations,
    sendInvitationRequest,
    revokeInvitationRequest,
    resendInvitationRequest
} from "../actionsAnuga";
import {
    getMemberships,
    getMembershipsLoading,
    isOwnerAnugaMap,
    getProjectVisibility,
    getProjectMyRole,
    canEditLayer,
    canDeleteLayer,
    // TASK-860 — invitation selectors
    getInvitations,
    getInvitationsEnabled
} from "../selectorsAnuga";
import {trackEvent} from "@js/utils/analytics";
import Message from '@mapstore/framework/components/I18N/Message';
// TASK-2235 — the panel rides the MovablePanel primitive (drag + resize +
// per-panelId persistence on the anuga ui slice); header/close now come from
// MovablePanel (which renders the chassis PanelHeader internally, TASK-1764).
// The 3-radio visibility group + the react-bootstrap member/invitation Tables
// stay bespoke (flagged gaps). The #membership-panel id survives on an inner
// wrapper so the tests + CSS that target its descendants keep working.
import {Table as ChassisTable} from '../../SimpleView/components/primitives';
import MovablePanel from '../../shared/components/MovablePanel';
import {setMovablePanelState, setMembershipPanelTab} from '../actions/uiActions';
// TASK-2420 (epic 2359 W4.5) — the Billing tab content, re-homing the
// existing dark ComputeMeterPanel/BalanceStrip rather than a second copy.
import BillingTabContainer from '../../Paywall/account/containers/BillingTabContainer';

export const MEMBERSHIP_PANEL_ID = 'membership';

const ROLES = [
    {value: 1, label: 'Viewer'},
    {value: 2, label: 'Contributor'},
    {value: 3, label: 'Editor'},
    {value: 4, label: 'Manager'}
];

// TASK-2399 (dogfood F14) — 'public' previously read "Anyone can view", which
// overstates what actually happens: get_visible_projects (gn_anuga/sync.py)
// deliberately SUPPRESSES public projects from the global project list for
// strangers (G1/Phase-1 paywall, TASK-1364) — a public project is reachable
// by direct link/id, never by browsing. "Anyone can view" reads as
// bot-browsable-public; it is not. Copy corrected to name the real
// public-UNLISTED semantics instead of the more alarming (and wrong) implication.
// TASK-2466 (epic 2425 W2.5) — `paid` is DATA, not a special case in the JSX.
// Organization is a paid tier and the panel advertised it as free, which is
// the mislead that made the original organization->private bypass a two-click
// accident rather than an exploit. It has been paid on the backend since
// 0c2faa4 and doubly so since W1: TASK-2431 made the entry gate
// DESTINATION-based (any change INTO private OR organization is gated) and
// TASK-2432 added paid_organization as a distinct paid steady state. The
// Sharing panel was the last surface still saying otherwise.
//
// Driven off this flag rather than `opt.value === 'private'` so the next tier
// change is a data edit — the previous shape made it possible for the backend
// to move and the UI not to.
// W3d — 'Organization members can view' was FALSE, and false in the direction
// that costs the customer money. No organisation member can view anything:
// gn_anuga/sync.py's compute_resource_perms sets `groups = {}` and returns it
// untouched, so no GroupProfile ever reaches Guardian for an ANUGA project, and
// get_visible_projects has no org branch — the org steps of get_user_role were
// removed by TASK-859. Access is explicit-ProjectMembership-only, i.e. exactly
// what Private grants.
//
// The failure it produced: the owner of a public project wanting to restrict it
// to colleagues reads this line, picks Organization, pays for it, and every
// colleague who had link access is silently locked OUT — the opposite of the
// promise. Fail-closed, so nothing leaked; but a paid promise the code cannot
// keep is still a paid promise, and this was the sentence people paid for.
//
// The description now says what is true TODAY. It deliberately reads the same
// as Private, because today it IS the same as Private, and it makes no
// forward promise ('coming soon' would be the same defect wearing a hedge).
// The tier survives as a distinct stored value on purpose — decision
// 2026-07-26-q-2 rules that organisation access arrives as an EXPLICIT GRANT of
// a NAMED organisation (a GroupProfile), granting VIEWER only. When that work
// lands it differentiates this line; until then nothing may claim it does.
// See also this file's own header note below: the previous mislabel here is
// what made the organization->private bypass a two-click accident.
const VISIBILITY_OPTIONS = [
    {value: 'private', label: 'Private', description: 'Only members can access', paid: true},
    {value: 'organization', label: 'Organization', description: 'Only members can access', paid: true},
    {value: 'public', label: 'Public', description: 'Anyone with the link can view — not listed in the public project directory', paid: false}
];

class MembershipPanelClass extends React.Component {
    static propTypes = {
        memberships: PropTypes.array,
        invitations: PropTypes.array,
        invitationsEnabled: PropTypes.bool,
        loading: PropTypes.bool,
        // V2P-24 — coarse `canManage` replaced with per-row gates derived from
        // each membership row's `perms` (V2P-14 SerializerMethodField). The
        // panel-level `canAdd` controls the Add-member affordance and the
        // Visibility section; it is project-level role only (owner/manager) since
        // TASK-2463/W2.8 removed its unreachable second branch — see
        // _deriveCanAdd.
        canAdd: PropTypes.bool,
        // V2P-24 — when /my-perms/ failed AND a row's perms wasn't fetched
        // through MembershipSerializerV2, the panel falls back to a read-only
        // member list. NEVER empty — owners must still see who's a member.
        permsLoadFailed: PropTypes.bool,
        isOwner: PropTypes.bool,
        visibility: PropTypes.string,
        myRole: PropTypes.string,
        currentUserId: PropTypes.number,
        // UAT-2 redesign — the viewing user's username, for the "(you)" marker
        // on their own member row.
        currentUsername: PropTypes.string,
        ownerUsername: PropTypes.string,
        setMembershipPanel: PropTypes.func,
        fetchMemberships: PropTypes.func,
        fetchInvitations: PropTypes.func,
        updateMembershipRequest: PropTypes.func,
        deleteMembershipRequest: PropTypes.func,
        updateProjectVisibilityRequest: PropTypes.func,
        sendInvitationRequest: PropTypes.func,
        revokeInvitationRequest: PropTypes.func,
        resendInvitationRequest: PropTypes.func,
        // TASK-2235 — persisted MovablePanel position/size + its setter.
        panelState: PropTypes.object,
        setMovablePanelState: PropTypes.func,
        // TASK-2399 — kill-switch mirroring Paywall.js's own `paywallEnabled`
        // cfg (threaded here via anugaContainer, localConfig.json's Anuga
        // plugin cfg). Drives the Private option's pre-interaction paid-tier
        // badge — freemium context must be visible BEFORE the user clicks,
        // not discovered only via a 402. Ships dark (false) until the
        // operator's PAYWALL_ENABLED flip.
        paywallEnabled: PropTypes.bool,
        // TASK-2420 — Account panel active tab ('sharing'|'billing') + setter.
        activeTab: PropTypes.string,
        setMembershipPanelTab: PropTypes.func
    };

    static defaultProps = {
        paywallEnabled: false,
        activeTab: 'sharing'
    };

    constructor(props) {
        super(props);
        this.state = {
            // TASK-860 — email invite form state (replaces searchQuery/searchResults/selectedUser)
            inviteEmail: '',
            inviteRole: 1,
            // TASK-1409 — inline confirm overlays replace window.confirm.
            // removeMemberConfirm: {visible, membershipId, username} or null.
            // visibilityConfirm: {visible, newVisibility} or null.
            removeMemberConfirm: null,
            visibilityConfirm: null
        };
    }

    componentDidMount() {
        // eslint-disable-next-line react/no-did-mount-set-state -- intentional reset of transient form state on (re)mount
        this.setState({inviteEmail: '', inviteRole: 1});
        this.props.fetchMemberships();
        if (this.props.canAdd) {
            this.props.fetchInvitations();
        }
    }

    // TASK-860 — send invitation by email
    handleSendInvitation = () => {
        const email = this.state.inviteEmail.trim();
        if (!email) return;
        this.props.sendInvitationRequest(email, this.state.inviteRole);
        this.setState({inviteEmail: '', inviteRole: 1});
        trackEvent('button', 'click', 'membership-send-invitation');
    }

    handleRoleChange = (membershipId, role) => {
        this.props.updateMembershipRequest(membershipId, parseInt(role, 10));
        trackEvent('button', 'click', 'membership-change-role');
    }

    // TASK-1409 — replaced window.confirm with inline React confirm overlay.
    // Opens the overlay; the actual delete fires only on confirmRemoveMember().
    handleRemoveMember = (membershipId, username) => {
        this.setState({removeMemberConfirm: {visible: true, membershipId, username}});
    }

    confirmRemoveMember = () => {
        const {membershipId} = this.state.removeMemberConfirm || {};
        this.setState({removeMemberConfirm: null});
        if (membershipId !== undefined) {
            this.props.deleteMembershipRequest(membershipId);
            trackEvent('button', 'click', 'membership-remove-member');
        }
    }

    cancelRemoveMember = () => {
        this.setState({removeMemberConfirm: null});
    }

    // TASK-1409 — replaced window.confirm with inline React confirm overlay.
    // For non-public transitions no confirm is needed; public transition opens
    // the overlay. The actual dispatch fires only on confirmVisibilityChange().
    handleVisibilityChange = (newVisibility) => {
        if (newVisibility === 'public' && this.props.visibility !== 'public') {
            this.setState({visibilityConfirm: {visible: true, newVisibility}});
            return;
        }
        this.props.updateProjectVisibilityRequest(newVisibility);
        trackEvent('button', 'click', `membership-visibility-${newVisibility}`);
    }

    confirmVisibilityChange = () => {
        const {newVisibility} = this.state.visibilityConfirm || {};
        this.setState({visibilityConfirm: null});
        if (newVisibility) {
            this.props.updateProjectVisibilityRequest(newVisibility);
            trackEvent('button', 'click', `membership-visibility-${newVisibility}`);
        }
    }

    cancelVisibilityChange = () => {
        this.setState({visibilityConfirm: null});
    }

    renderVisibilitySection() {
        // V2P-24 — gate on `canAdd` (panel-level manage capability) AND not in
        // the perms-load-failed read-only fallback. Visibility is a destructive
        // owner/manager action; suppress it when we can't trust per-row perms.
        if (!this.props.canAdd || this.props.permsLoadFailed) return null;
        return (
            <div className="sv-membership-visibility">
                <div className="sv-membership-section-title">
                    <Message msgId="hydrata.anuga.projectVisibility" />
                </div>
                {/* UAT-2 redesign — the label-button + trailing description row
                    became a full-width radio option card (radio dot + title +
                    pills + description); same handleVisibilityChange behavior,
                    now on the whole card. */}
                <div className="sv-membership-visibility-options" role="radiogroup" aria-label="Project visibility">
                    {VISIBILITY_OPTIONS.map(opt => {
                        const selected = this.props.visibility === opt.value;
                        return (
                            <button
                                type="button"
                                key={opt.value}
                                role="radio"
                                aria-checked={selected}
                                className={`sv-membership-visibility-option-row sv-membership-visibility-btn ${selected ? 'active' : ''}`}
                                onClick={() => this.handleVisibilityChange(opt.value)}
                            >
                                <span className="sv-membership-visibility-radio-dot" aria-hidden="true" />
                                <span className="sv-membership-visibility-option-main">
                                    <span className="sv-membership-visibility-option-title">
                                        {opt.label}
                                        {/* TASK-2399 — freemium context BEFORE the click: the paid
                                            tiers are marked (commerce/checkout_views.py, api_v2.py's
                                            G2 entitlement gate). Shown unconditionally once
                                            paywallEnabled and NOT gated on this user's own
                                            entitlement — the pill describes the TIER, not the
                                            viewer's state, so an already-entitled user still sees it
                                            as a true fact about that tier.
                                            Clicking it as a non-entitled user never dead-ends on a
                                            bare 402: updateProjectVisibilityEpic (membershipEpics.js)
                                            already routes the 402's upgrade_prompt contract shape
                                            into the paywall overlay, which the always-mounted
                                            PaywallPanel (Paywall.js) renders as the UpgradeModal
                                            (reused, not re-implemented).

                                            TASK-2466 (W2.5) — driven by opt.paid, so Organization
                                            carries the SAME pill as Private rather than a lookalike:
                                            one span, one pair of classes, no second component to
                                            drift. `data-tier` lets a test tell the two apart without
                                            needing two testids. */}
                                        {opt.paid && this.props.paywallEnabled ? (
                                            <span
                                                data-testid="sv-membership-visibility-paid-badge"
                                                data-tier={opt.value}
                                                className="sv-membership-visibility-paid-badge sv-account-pill sv-account-pill--paid"
                                            >
                                                Paid
                                            </span>
                                        ) : null}
                                        {selected ? (
                                            <span className="sv-account-pill sv-account-pill--current">Current</span>
                                        ) : null}
                                    </span>
                                    <span className="sv-membership-visibility-desc">
                                        {opt.description}
                                    </span>
                                </span>
                            </button>
                        );
                    })}
                </div>
                {/* TASK-2399 (dogfood F14) — new-project default-visibility policy,
                    stated explicitly rather than left implicit. Project.visibility
                    defaults to PUBLIC (gn_anuga/models/project.py) — kept as the
                    default deliberately under paid-private semantics: Public stays
                    the free, zero-friction starting tier (public-UNLISTED, per the
                    description above) and Private is the opt-in paid upgrade, not
                    a default cost sprung on a new project. */}
                <div className="sv-membership-visibility-default-note">
                    New projects start Public (unlisted). Switch to Private any time
                    {this.props.paywallEnabled ? ' (paid)' : ''}.
                </div>
            </div>
        );
    }

    // UAT-2 redesign — 28px initial-avatar circle for member rows; tint picked
    // deterministically from the username so a given user keeps their colour
    // across renders/sessions without any stored state.
    renderAvatar(username) {
        const tint = (username || '?').charCodeAt(0) % 4;
        return (
            <span className={`sv-membership-avatar sv-membership-avatar--${tint}`} aria-hidden="true">
                {(username || '?').charAt(0).toUpperCase()}
            </span>
        );
    }

    renderOwnerRow() {
        const isSelf = this.props.ownerUsername === this.props.currentUsername;
        return (
            <div className="membership-owner-row sv-membership-member-row">
                {this.renderAvatar(this.props.ownerUsername)}
                <span className="sv-membership-member-name">
                    {this.props.ownerUsername}
                    {isSelf ? <span className="sv-membership-member-you"> (you)</span> : null}
                </span>
                {/* Owner is immutable — plain static text, no role control. */}
                <span className="sv-membership-member-role-static">Owner</span>
            </div>
        );
    }

    renderMemberRow(membership) {
        // V2P-24 — per-row gating. Each membership row carries its own `perms`
        // array (V2P-14 SerializerMethodField on MembershipSerializerV2),
        // describing what the CURRENT user can do TO that row. canEditLayer /
        // canDeleteLayer (V2P-02 helpers) read membership.perms first, then
        // fall back to myRole — owners/managers/editors always pass.
        //
        // permsLoadFailed=true forces a read-only render: rows still show
        // (V2P-15 contract: never empty), but no role-change select / no
        // remove button. The owner can still SEE who's a member.
        const {permsLoadFailed, myRole, currentUserId} = this.props;
        const canChangeRole = !permsLoadFailed && canEditLayer(membership, undefined, myRole, currentUserId);
        const canRemove = !permsLoadFailed && canDeleteLayer(membership, undefined, myRole, currentUserId);
        const isSelf = membership.username === this.props.currentUsername;
        return (
            <div key={membership.id} className="membership-member-row sv-membership-member-row">
                {this.renderAvatar(membership.username)}
                <span className="sv-membership-member-name">
                    {membership.username}
                    {isSelf ? <span className="sv-membership-member-you"> (you)</span> : null}
                </span>
                {canChangeRole ? (
                    <select
                        value={membership.role}
                        className="sv-scenario-select sv-membership-role-select change-role-btn"
                        onChange={(e) => this.handleRoleChange(membership.id, e.target.value)}
                    >
                        {ROLES.map(r => (
                            <option key={r.value} value={r.value}>{r.label}</option>
                        ))}
                    </select>
                ) : (
                    <span className={`sv-badge-role ${membership.role >= 4 ? 'sv-badge-manager' : membership.role >= 3 ? 'sv-badge-editor' : 'sv-badge-viewer'}`}>
                        {membership.role_label}
                    </span>
                )}
                {canRemove ? (
                    <button
                        type="button"
                        className="sv-membership-btn-remove remove-member-btn"
                        title={`Remove ${membership.username}`}
                        aria-label={`Remove ${membership.username}`}
                        onClick={() => this.handleRemoveMember(membership.id, membership.username)}
                    >
                        <span className="glyphicon glyphicon-remove" aria-hidden="true" />
                    </button>
                ) : null}
            </div>
        );
    }

    // TASK-860 — render the email invite form (replaces hand-rolled autocomplete)
    renderInviteSection() {
        // V2P-24 — gate on `canAdd` (panel-level) AND not in perms-load-failed fallback.
        if (!this.props.canAdd || this.props.permsLoadFailed) return null;

        const {invitationsEnabled} = this.props;
        const formDisabled = !invitationsEnabled;

        return (
            <div className="membership-invite-form invite-member">
                <div className="sv-membership-section-title">
                    Invite by email
                </div>
                {formDisabled ? (
                    <div className="alert alert-info sv-membership-invite-disabled">
                        Invitations are disabled on this site.
                    </div>
                ) : null}
                <div className="sv-membership-add-form-row">
                    <input
                        type="email"
                        className="sv-data-title-input sv-membership-search-input invite-email-input"
                        placeholder="name@example.com"
                        value={this.state.inviteEmail}
                        disabled={formDisabled}
                        onChange={(e) => this.setState({inviteEmail: e.target.value})}
                        onKeyDown={(e) => { if (e.key === 'Enter') this.handleSendInvitation(); }}
                    />
                    <select
                        className="sv-scenario-select sv-membership-role-select invite-role-select"
                        value={this.state.inviteRole}
                        disabled={formDisabled}
                        onChange={(e) => this.setState({inviteRole: parseInt(e.target.value, 10)})}
                    >
                        {ROLES.map(r => (
                            <option key={r.value} value={r.value}>{r.label}</option>
                        ))}
                    </select>
                    <Button
                        bsStyle="success"
                        bsSize="xsmall"
                        className="sv-membership-btn-sm invite-submit-btn"
                        disabled={formDisabled || !this.state.inviteEmail.trim()}
                        onClick={this.handleSendInvitation}
                    >
                        Send invite
                    </Button>
                </div>
                {/* UAT-2 redesign — say WHY the button is disabled instead of
                    leaving a dead control unexplained. */}
                {!formDisabled && !this.state.inviteEmail.trim() ? (
                    <div className="sv-membership-invite-hint">
                        Enter an email address to enable sending.
                    </div>
                ) : null}
            </div>
        );
    }

    // TASK-860 — render pending invitations list with revoke/resend controls
    renderInvitationsSection() {
        if (!this.props.canAdd || this.props.permsLoadFailed) return null;
        const {invitations, invitationsEnabled} = this.props;
        const pendingInvitations = (invitations || []).filter(inv => inv.status === 'pending');
        if (!pendingInvitations.length) return null;

        return (
            <div className="membership-invitations-section">
                <div className="sv-membership-section-title">
                    Pending invitations
                </div>
                <ChassisTable surface="dark" extraClassName="sv-scenario-table membership-invitations-table">
                    <thead>
                        <tr className="sv-scenario-table-header">
                            <th>Email</th>
                            <th>Role</th>
                            <th/>
                        </tr>
                    </thead>
                    <tbody>
                        {pendingInvitations.map(inv => (
                            <tr key={inv.id} className="membership-invitation-row">
                                <td>{inv.email}</td>
                                <td>
                                    <span className="sv-badge-role sv-badge-viewer">
                                        {inv.role_label}
                                    </span>
                                </td>
                                <td className="membership-invitation-actions">
                                    {invitationsEnabled ? (
                                        <Button
                                            bsSize="xsmall"
                                            bsStyle="default"
                                            className="sv-membership-btn-sm resend-invitation-btn"
                                            onClick={() => {
                                                this.props.resendInvitationRequest(inv.id);
                                                trackEvent('button', 'click', 'membership-resend-invitation');
                                            }}
                                            title="Resend invitation"
                                        >
                                            <span className="glyphicon glyphicon-repeat" aria-hidden="true" />
                                        </Button>
                                    ) : null}
                                    <Button
                                        bsStyle="danger"
                                        bsSize="xsmall"
                                        className="sv-membership-btn-remove revoke-invitation-btn"
                                        onClick={() => {
                                            this.props.revokeInvitationRequest(inv.id);
                                            trackEvent('button', 'click', 'membership-revoke-invitation');
                                        }}
                                        title="Revoke invitation"
                                    >
                                        <span className="glyphicon glyphicon-trash" aria-hidden="true" />
                                    </Button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </ChassisTable>
            </div>
        );
    }

    handleClose = () => {
        this.props.setMembershipPanel(false);
        trackEvent('button', 'click', 'membership-panel-close');
    };

    // TASK-2420 — extracted verbatim from the pre-2420 render() so the
    // flags-off path (renderSharingContent() called directly, no tab bar) is
    // byte-identical to today, and the flags-on Sharing tab reuses the exact
    // same markup rather than forking a second copy.
    renderSharingContent() {
        return (
            <div id="membership-panel">
                <div className="sv-menu-rows-container">
                    {/*
                  V2P-24 read-only fallback banner — when permsLoadFailed=true
                  (V2P-20 /my-perms/ retry exhausted) the panel still renders
                  the row list but suppresses Add/Change/Remove affordances.
                  Owners must still SEE who's a member after a transient 5xx.
                */}
                    {this.props.permsLoadFailed ? (
                        <div className="alert alert-warning sv-membership-perms-warning">
                            <Message msgId="hydrata.anuga.permsUnavailable.message" />
                        </div>
                    ) : null}
                    {/* TASK-1409 — inline confirm overlays replace window.confirm.
                    removeMemberConfirm and visibilityConfirm are mutually
                    exclusive in normal use; both are guarded separately. */}
                    {this.state.removeMemberConfirm?.visible ? (
                        <div className="sv-membership-confirm-overlay">
                            <p>{`Remove ${this.state.removeMemberConfirm.username} from project?`}</p>
                            <div className="sv-membership-confirm-buttons">
                                <Button bsSize="small" onClick={this.cancelRemoveMember}>Cancel</Button>
                                <Button bsStyle="danger" bsSize="small" className="membership-confirm-remove-btn" onClick={this.confirmRemoveMember}>Remove</Button>
                            </div>
                        </div>
                    ) : null}
                    {this.state.visibilityConfirm?.visible ? (
                        <div className="sv-membership-confirm-overlay">
                            <p>This will expose all project data to anonymous users. Continue?</p>
                            <div className="sv-membership-confirm-buttons">
                                <Button bsSize="small" onClick={this.cancelVisibilityChange}>Cancel</Button>
                                <Button bsStyle="danger" bsSize="small" className="membership-confirm-visibility-btn" onClick={this.confirmVisibilityChange}>Make Public</Button>
                            </div>
                        </div>
                    ) : null}
                    {this.renderVisibilitySection()}
                    {/* UAT-2 redesign — the User/Role table became a "Members (n)"
                        avatar list; row classes (.membership-owner-row /
                        .membership-member-row) and control hooks (.change-role-btn /
                        .remove-member-btn) survive on the list rows. */}
                    <div className="sv-membership-members">
                        <div className="sv-membership-section-title">
                            Members
                            <span className="sv-membership-members-count">
                                {1 + (this.props.memberships?.length || 0)}
                            </span>
                        </div>
                        <div className="sv-membership-members-list">
                            {this.renderOwnerRow()}
                            {this.props.memberships?.map(m => this.renderMemberRow(m))}
                        </div>
                    </div>
                    {/* TASK-860 — email invite form (replaces hand-rolled autocomplete) */}
                    {this.renderInviteSection()}
                    {/* TASK-860 — pending invitations list */}
                    {this.renderInvitationsSection()}
                </div>
            </div>
        );
    }

    // TASK-2420 — Sharing tab is manager-gated per the SAME panel-level
    // `canAdd` (project permission axis — myRole owner/manager, or the
    // V2P-30 org-owner perms fallback) that already gates Add/visibility
    // inside renderSharingContent(). A non-manager gets NO Sharing tab at
    // all (hidden, not read-only) — only Billing (the entitlement axis).
    handleTabClick = (tab) => {
        this.props.setMembershipPanelTab(tab);
        trackEvent('button', 'click', `membership-panel-tab-${tab}`);
    };

    renderTabBar(activeTab) {
        return (
            <div className="sv-account-tab-bar" data-testid="sv-account-tab-bar">
                {this.props.canAdd ? (
                    <button
                        type="button"
                        data-testid="sv-account-tab-sharing"
                        className={`sv-account-tab-btn ${activeTab === 'sharing' ? 'active' : ''}`}
                        onClick={() => this.handleTabClick('sharing')}
                    >
                        <Message msgId="hydrata.anuga.accountTabSharing" />
                    </button>
                ) : null}
                <button
                    type="button"
                    data-testid="sv-account-tab-billing"
                    className={`sv-account-tab-btn ${activeTab === 'billing' ? 'active' : ''}`}
                    onClick={() => this.handleTabClick('billing')}
                >
                    <Message msgId="hydrata.anuga.accountTabBilling" />
                </button>
            </div>
        );
    }

    render() {
        const persist = this.props.setMovablePanelState || (() => {});
        // flags-off (AC1): byte-identical to today — NO tabs, title
        // "Permissions", Sharing content only, manager-only padlock (gated
        // upstream in simpleViewContainer.js, not here).
        if (!this.props.paywallEnabled) {
            return (
                <MovablePanel
                    panelId={MEMBERSHIP_PANEL_ID}
                    className="sv-membership-movable"
                    title={<Message msgId="hydrata.anuga.members" />}
                    onClose={this.handleClose}
                    autoFocus
                    position={this.props.panelState?.position}
                    size={this.props.panelState?.size}
                    defaultPosition={{x: 20, y: 70}}
                    onMove={(position) => persist(MEMBERSHIP_PANEL_ID, {position})}
                    onResize={(size) => persist(MEMBERSHIP_PANEL_ID, {size})}
                >
                    {this.renderSharingContent()}
                </MovablePanel>
            );
        }

        // flags-on: renamed 'Account', two tabs (Sharing hidden for a
        // non-manager — never just read-only), Billing is the viewing
        // user's OWN Account (never the project owner's).
        const activeTab = this.props.canAdd ? this.props.activeTab : 'billing';
        return (
            <MovablePanel
                panelId={MEMBERSHIP_PANEL_ID}
                className="sv-membership-movable sv-account-movable"
                title={<Message msgId="hydrata.anuga.accountPanelTitle" />}
                onClose={this.handleClose}
                /* W2 adversarial R4 — this panel is always the DESTINATION of
                   a user action (the Account button, or "View account" out of
                   a refusal modal), never a side effect, so it takes keyboard
                   focus on open. Without it the "View account" route left a
                   keyboard user on the map behind the panel they just asked
                   for: the containers dismiss + open in ONE commit, and
                   ModalHost's cleanup runs restoreFocus first. */
                autoFocus
                position={this.props.panelState?.position}
                size={this.props.panelState?.size}
                defaultPosition={{x: 20, y: 70}}
                onMove={(position) => persist(MEMBERSHIP_PANEL_ID, {position})}
                onResize={(size) => persist(MEMBERSHIP_PANEL_ID, {size})}
            >
                {this.renderTabBar(activeTab)}
                {activeTab === 'sharing' ? this.renderSharingContent() : <BillingTabContainer />}
            </MovablePanel>
        );
    }
}

/**
 * V2P-24 — derive the panel-level Add capability: project my_role is owner or
 * manager. Panel-level only; per-row gates still apply to Change-role / Remove
 * via canEditLayer / canDeleteLayer.
 *
 * TASK-2463 (epic 2425 W2.8) DELETED A SECOND BRANCH: "OR any membership row
 * whose perms include `change_resourcebase_permissions`". Its stated
 * justification was the V2P-30 case — an organisation owner with no explicit
 * ProjectMembership row, for whom get_user_role returned Role.MANAGER. TASK-859
 * REMOVED that org-fold (sync.py's get_user_role documents steps 5-6 as deleted;
 * organisation membership now grants no implicit role at all), so the case the
 * branch existed for no longer exists.
 *
 * And it could not have fired anyway. `m.perms` is NOT the row user's perms: it
 * comes from MembershipSerializerV2's _PermsFieldMixin.get_perms, which calls
 * get_user_resource_perms_batch(project, REQUEST.USER) — and that computes ONE
 * perm list from the requesting user's role and stamps the same list on every row
 * (sync.py: `result[resource_type] = {rid: list(perm_list) for rid in ids}`).
 * `change_resourcebase_permissions` appears only in _ROLE_PERMS[MANAGER] and
 * _OWNER_PERMS, so a row could carry it only when the READER is already a manager
 * or owner — i.e. branch 2 was a strict subset of branch 1 in every reachable
 * state. It also never had a test: nothing in membershipPanel-test.js sets up a
 * below-manager reader with a permissive row, because that state cannot be
 * produced by the API.
 *
 * The one theoretical divergence, and it is the safe direction: if the project
 * fetch and the members fetch straddled a role change, the members response could
 * report manager perms while `my_role` still said editor. Removing the branch then
 * withholds Add from someone who has it, for one refresh — never grants it to
 * someone who does not.
 */
const _deriveCanAdd = (myRole) => myRole === 'owner' || myRole === 'manager';

const mapStateToProps = (state) => {
    const memberships = getMemberships(state);
    const myRole = getProjectMyRole(state);
    return {
        memberships,
        invitations: getInvitations(state),
        invitationsEnabled: getInvitationsEnabled(state),
        loading: getMembershipsLoading(state),
        // V2P-24 — coarse `canManageMembers` gate replaced with per-row gating
        // + a derived panel-level `canAdd` for the Add-member affordance.
        canAdd: _deriveCanAdd(myRole),
        // V2P-24 — read-only fallback flag set by V2P-20 /my-perms/ failure.
        // Lives at state.anuga.resources.permsLoadFailed per V2P-21's reducer.
        // Falls back to state.anuga.permsLoadFailed for forward-compat with the
        // V2P-23 fixture and any future reducer relocation.
        permsLoadFailed: state?.anuga?.resources?.permsLoadFailed === true
            || state?.anuga?.permsLoadFailed === true,
        isOwner: isOwnerAnugaMap(state),
        visibility: getProjectVisibility(state),
        myRole,
        // V2P-24 — currentUserId is required by the V2P-02 helpers' Contributor
        // ownership rule. Pulled from the same security slice the helpers'
        // state-shaped wrappers use (canEditLayerSelector et al).
        currentUserId: state?.security?.user?.pk || null,
        // UAT-2 redesign — "(you)" marker source; same security slice as
        // currentUserId (rows only carry usernames, not user pks). The live
        // slice carries `username`; `name` kept as a fallback for mocks.
        currentUsername: state?.security?.user?.username || state?.security?.user?.name || null,
        ownerUsername: state?.anuga?.projects?.data?.owner_username || 'owner',
        // TASK-2235 — persisted MovablePanel position/size for this panelId.
        panelState: state?.anuga?.ui?.movablePanels?.[MEMBERSHIP_PANEL_ID],
        // TASK-2420 — which tab is active (paywallEnabled only; flags-off
        // never reads this).
        activeTab: state?.anuga?.ui?.membershipPanelTab || 'sharing'
    };
};

const mapDispatchToProps = (dispatch) => ({
    setMembershipPanel: (visible) => dispatch(setMembershipPanel(visible)),
    fetchMemberships: () => dispatch(fetchMemberships()),
    fetchInvitations: () => dispatch(fetchInvitations()),
    updateMembershipRequest: (membershipId, role) => dispatch(updateMembershipRequest(membershipId, role)),
    deleteMembershipRequest: (membershipId) => dispatch(deleteMembershipRequest(membershipId)),
    updateProjectVisibilityRequest: (visibility) => dispatch(updateProjectVisibilityRequest(visibility)),
    sendInvitationRequest: (email, role) => dispatch(sendInvitationRequest(email, role)),
    revokeInvitationRequest: (invitationId) => dispatch(revokeInvitationRequest(invitationId)),
    resendInvitationRequest: (invitationId) => dispatch(resendInvitationRequest(invitationId)),
    // TASK-2235 — persist the MovablePanel position/size per panelId.
    setMovablePanelState: (panelId, patch) => dispatch(setMovablePanelState(panelId, patch)),
    // TASK-2420 — switch the Account panel's active tab.
    setMembershipPanelTab: (tab) => dispatch(setMembershipPanelTab(tab))
});

const MembershipPanel = connect(mapStateToProps, mapDispatchToProps)(MembershipPanelClass);

export {
    MembershipPanel
};
