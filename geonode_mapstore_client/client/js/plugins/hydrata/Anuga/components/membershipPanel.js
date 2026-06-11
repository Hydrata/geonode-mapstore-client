import React from "react";
import {connect} from "react-redux";
const PropTypes = require('prop-types');
import {Table, Button} from "react-bootstrap";
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

const ROLES = [
    {value: 1, label: 'Viewer'},
    {value: 2, label: 'Contributor'},
    {value: 3, label: 'Editor'},
    {value: 4, label: 'Manager'}
];

const VISIBILITY_OPTIONS = [
    {value: 'private', label: 'Private', description: 'Only members can access'},
    {value: 'organization', label: 'Organization', description: 'Organization members can view'},
    {value: 'public', label: 'Public', description: 'Anyone can view'}
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
        // Visibility section, derived from project-level role + any row whose
        // perms include `change_resourcebase_permissions` (V2P-30 grants this
        // to org-owners-without-explicit-membership via Role.MANAGER).
        canAdd: PropTypes.bool,
        // V2P-24 — when /my-perms/ failed AND a row's perms wasn't fetched
        // through MembershipSerializerV2, the panel falls back to a read-only
        // member list. NEVER empty — owners must still see who's a member.
        permsLoadFailed: PropTypes.bool,
        isOwner: PropTypes.bool,
        visibility: PropTypes.string,
        myRole: PropTypes.string,
        currentUserId: PropTypes.number,
        ownerUsername: PropTypes.string,
        setMembershipPanel: PropTypes.func,
        fetchMemberships: PropTypes.func,
        fetchInvitations: PropTypes.func,
        updateMembershipRequest: PropTypes.func,
        deleteMembershipRequest: PropTypes.func,
        updateProjectVisibilityRequest: PropTypes.func,
        sendInvitationRequest: PropTypes.func,
        revokeInvitationRequest: PropTypes.func,
        resendInvitationRequest: PropTypes.func
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
            <div className="membership-visibility">
                <div className="membership-section-title">
                    <Message msgId="hydrata.anuga.projectVisibility" />
                </div>
                <div className="membership-visibility-options">
                    {VISIBILITY_OPTIONS.map(opt => (
                        <div key={opt.value} className="membership-visibility-option-row">
                            <Button
                                bsSize="xsmall"
                                className={`membership-btn-sm membership-visibility-btn ${this.props.visibility === opt.value ? 'active' : ''}`}
                                onClick={() => this.handleVisibilityChange(opt.value)}
                            >
                                {opt.label}
                            </Button>
                            <span className="membership-visibility-desc">{opt.description}</span>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    renderOwnerRow() {
        return (
            <tr className="membership-owner-row">
                <td>{this.props.ownerUsername}</td>
                <td>
                    <span className="badge-role badge-owner">
                        Owner
                    </span>
                </td>
                <td/>
            </tr>
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
        return (
            <tr key={membership.id} className="membership-member-row">
                <td>{membership.username}</td>
                <td>
                    {canChangeRole ? (
                        <select
                            value={membership.role}
                            className="scenario-select membership-role-select change-role-btn"
                            onChange={(e) => this.handleRoleChange(membership.id, e.target.value)}
                        >
                            {ROLES.map(r => (
                                <option key={r.value} value={r.value}>{r.label}</option>
                            ))}
                        </select>
                    ) : (
                        <span className={`badge-role ${membership.role >= 4 ? 'badge-manager' : membership.role >= 3 ? 'badge-editor' : 'badge-viewer'}`}>
                            {membership.role_label}
                        </span>
                    )}
                </td>
                <td>
                    {canRemove ? (
                        <Button
                            bsStyle="danger"
                            bsSize="xsmall"
                            className="membership-btn-remove remove-member-btn"
                            onClick={() => this.handleRemoveMember(membership.id, membership.username)}
                        >
                            <span className="glyphicon glyphicon-trash" aria-hidden="true" />
                        </Button>
                    ) : null}
                </td>
            </tr>
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
                <div className="membership-section-title">
                    Invite by email
                </div>
                {formDisabled ? (
                    <div className="alert alert-info membership-invite-disabled">
                        Invitations are disabled on this site.
                    </div>
                ) : null}
                <div className="membership-add-form-row">
                    <input
                        type="email"
                        className="data-title-input membership-search-input invite-email-input"
                        placeholder="Email address"
                        value={this.state.inviteEmail}
                        disabled={formDisabled}
                        onChange={(e) => this.setState({inviteEmail: e.target.value})}
                        onKeyDown={(e) => { if (e.key === 'Enter') this.handleSendInvitation(); }}
                    />
                    <select
                        className="scenario-select membership-role-select invite-role-select"
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
                        className="membership-btn-sm invite-submit-btn"
                        disabled={formDisabled || !this.state.inviteEmail.trim()}
                        onClick={this.handleSendInvitation}
                    >
                        Send invite
                    </Button>
                </div>
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
                <div className="membership-section-title">
                    Pending invitations
                </div>
                <Table className="scenario-table membership-invitations-table">
                    <thead>
                        <tr className="scenario-table-header">
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
                                    <span className="badge-role badge-viewer">
                                        {inv.role_label}
                                    </span>
                                </td>
                                <td className="membership-invitation-actions">
                                    {invitationsEnabled ? (
                                        <Button
                                            bsSize="xsmall"
                                            bsStyle="default"
                                            className="membership-btn-sm resend-invitation-btn"
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
                                        className="membership-btn-remove revoke-invitation-btn"
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
                </Table>
            </div>
        );
    }

    render() {
        return (
            <div id="membership-panel" className="simple-view-panel anuga-panel">
                <div className="menu-rows-container">
                    <div className="row menu-row-header membership-header-row">
                        <Message msgId="hydrata.anuga.members" />
                        <span
                            className="btn glyphicon glyphicon-remove legend-close"
                            onClick={() => {
                                this.props.setMembershipPanel(false);
                                trackEvent('button', 'click', 'membership-panel-close');
                            }}
                        />
                    </div>
                    {/*
                      V2P-24 read-only fallback banner — when permsLoadFailed=true
                      (V2P-20 /my-perms/ retry exhausted) the panel still renders
                      the row list but suppresses Add/Change/Remove affordances.
                      Owners must still SEE who's a member after a transient 5xx.
                    */}
                    {this.props.permsLoadFailed ? (
                        <div className="alert alert-warning membership-perms-warning">
                            <Message msgId="hydrata.anuga.permsUnavailable.message" />
                        </div>
                    ) : null}
                    {/* TASK-1409 — inline confirm overlays replace window.confirm.
                        removeMemberConfirm and visibilityConfirm are mutually
                        exclusive in normal use; both are guarded separately. */}
                    {this.state.removeMemberConfirm?.visible ? (
                        <div className="membership-confirm-overlay">
                            <p>{`Remove ${this.state.removeMemberConfirm.username} from project?`}</p>
                            <div className="membership-confirm-buttons">
                                <Button bsSize="small" onClick={this.cancelRemoveMember}>Cancel</Button>
                                <Button bsStyle="danger" bsSize="small" className="membership-confirm-remove-btn" onClick={this.confirmRemoveMember}>Remove</Button>
                            </div>
                        </div>
                    ) : null}
                    {this.state.visibilityConfirm?.visible ? (
                        <div className="membership-confirm-overlay">
                            <p>This will expose all project data to anonymous users. Continue?</p>
                            <div className="membership-confirm-buttons">
                                <Button bsSize="small" onClick={this.cancelVisibilityChange}>Cancel</Button>
                                <Button bsStyle="danger" bsSize="small" className="membership-confirm-visibility-btn" onClick={this.confirmVisibilityChange}>Make Public</Button>
                            </div>
                        </div>
                    ) : null}
                    {this.renderVisibilitySection()}
                    <Table className="scenario-table">
                        <thead>
                            <tr className="scenario-table-header">
                                <th><Message msgId="hydrata.anuga.memberUser" /></th>
                                <th><Message msgId="hydrata.anuga.memberRole" /></th>
                                <th/>
                            </tr>
                        </thead>
                        <tbody>
                            {this.renderOwnerRow()}
                            {this.props.memberships?.map(m => this.renderMemberRow(m))}
                        </tbody>
                    </Table>
                    {/* TASK-860 — email invite form (replaces hand-rolled autocomplete) */}
                    {this.renderInviteSection()}
                    {/* TASK-860 — pending invitations list */}
                    {this.renderInvitationsSection()}
                </div>
            </div>
        );
    }
}

/**
 * V2P-24 — derive the panel-level Add capability.
 *
 * Read order:
 *  1. project my_role === owner|manager → grant (legacy and most common).
 *  2. ANY membership row whose perms include
 *     `change_resourcebase_permissions` → grant (V2P-30 case: org-owner with no
 *     explicit ProjectMembership row, but get_user_role returns Role.MANAGER
 *     so MembershipSerializerV2.get_perms grants the manage perm).
 *
 * Returning false otherwise. Note this is a panel-level gate; per-row gates
 * still apply to Change-role / Remove buttons via canEditLayer / canDeleteLayer.
 */
const _deriveCanAdd = (memberships, myRole) => {
    if (myRole === 'owner' || myRole === 'manager') return true;
    if (!Array.isArray(memberships)) return false;
    // V2P-22 AC#4: use .includes() in component code; .indexOf() is reserved
    // for the V2P-02 helpers in selectorsAnuga.js (test files exempt).
    return memberships.some((m) =>
        Array.isArray(m?.perms) && m.perms.includes('change_resourcebase_permissions')
    );
};

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
        canAdd: _deriveCanAdd(memberships, myRole),
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
        ownerUsername: state?.anuga?.projects?.data?.owner_username || 'owner'
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
    resendInvitationRequest: (invitationId) => dispatch(resendInvitationRequest(invitationId))
});

const MembershipPanel = connect(mapStateToProps, mapDispatchToProps)(MembershipPanelClass);

export {
    MembershipPanel
};
