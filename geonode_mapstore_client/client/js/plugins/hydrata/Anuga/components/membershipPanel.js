import React from "react";
import {connect} from "react-redux";
const PropTypes = require('prop-types');
import {Table, Button} from "react-bootstrap";
import '../anuga.css';
import '../../SimpleView/simpleView.css';
import {
    setMembershipPanel,
    fetchMemberships,
    addMembershipRequest,
    updateMembershipRequest,
    deleteMembershipRequest,
    updateProjectVisibilityRequest
} from "../actionsAnuga";
import {
    getMemberships,
    getMembershipsLoading,
    isOwnerAnugaMap,
    getProjectVisibility,
    getProjectMyRole,
    canEditLayer,
    canDeleteLayer
} from "../selectorsAnuga";
import {trackEvent} from "@js/utils/analytics";
import * as anugaApi from '../api/anugaApi';
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
        addMembershipRequest: PropTypes.func,
        updateMembershipRequest: PropTypes.func,
        deleteMembershipRequest: PropTypes.func,
        updateProjectVisibilityRequest: PropTypes.func
    };

    constructor(props) {
        super(props);
        this.state = {
            searchQuery: '',
            searchResults: [],
            selectedUser: null,
            newRole: 1,
            searching: false
        };
    }

    componentDidMount() {
        // eslint-disable-next-line react/no-did-mount-set-state -- intentional reset of transient form state on (re)mount
        this.setState({searchQuery: '', searchResults: [], selectedUser: null, newRole: 1});
        this.props.fetchMemberships();
    }

    searchUsers = () => {
        const query = this.state.searchQuery.trim();
        if (query.length < 2) return;
        this.setState({searching: true});
        anugaApi.searchUsers(query)
            .then(response => {
                const users = response?.data?.users || [];
                this.setState({searchResults: users, searching: false});
            })
            .catch(err => {
                console.error('searchUsers failed:', err);
                this.setState({searchResults: [], searching: false});
            });
    }

    handleSearchKeyDown = (e) => {
        if (e.key === 'Enter') {
            this.searchUsers();
        }
    }

    handleAddMember = () => {
        if (!this.state.selectedUser) return;
        this.props.addMembershipRequest(this.state.selectedUser.pk, this.state.newRole);
        this.setState({selectedUser: null, searchQuery: '', searchResults: [], newRole: 1});
        trackEvent('button', 'click', 'membership-add-member');
    }

    handleRoleChange = (membershipId, role) => {
        this.props.updateMembershipRequest(membershipId, parseInt(role, 10));
        trackEvent('button', 'click', 'membership-change-role');
    }

    handleRemoveMember = (membershipId, username) => {
        // eslint-disable-next-line no-alert -- intentional user confirmation
        if (confirm(`Remove ${username} from project?`)) {
            this.props.deleteMembershipRequest(membershipId);
            trackEvent('button', 'click', 'membership-remove-member');
        }
    }

    handleVisibilityChange = (newVisibility) => {
        if (newVisibility === 'public' && this.props.visibility !== 'public') {
            // eslint-disable-next-line no-alert -- intentional user confirmation for irreversible action
            if (!confirm('This will expose all project data to anonymous users. Continue?')) {
                return;
            }
        }
        this.props.updateProjectVisibilityRequest(newVisibility);
        trackEvent('button', 'click', `membership-visibility-${newVisibility}`);
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

    renderAddMemberSection() {
        // V2P-24 — gate on `canAdd` (panel-level — derived in mapStateToProps
        // from project my_role + any membership row's
        // `change_resourcebase_permissions` perm) AND not in the
        // perms-load-failed read-only fallback.
        if (!this.props.canAdd || this.props.permsLoadFailed) return null;
        return (
            <div className="membership-add-form add-member">
                <div className="membership-section-title">
                    <Message msgId="hydrata.anuga.addMember" />
                </div>
                <div className="membership-add-form-row">
                    <input
                        type="text"
                        className="data-title-input membership-search-input"
                        placeholder="Search users..."
                        value={this.state.searchQuery}
                        onChange={(e) => this.setState({searchQuery: e.target.value})}
                        onKeyDown={this.handleSearchKeyDown}
                    />
                    <Button
                        bsSize="xsmall"
                        className="membership-btn-sm"
                        onClick={this.searchUsers}
                        disabled={this.state.searching}
                    >
                        <span className="glyphicon glyphicon-search" />
                    </Button>
                    <select
                        className="scenario-select membership-role-select"
                        value={this.state.newRole}
                        onChange={(e) => this.setState({newRole: parseInt(e.target.value, 10)})}
                    >
                        {ROLES.map(r => (
                            <option key={r.value} value={r.value}>{r.label}</option>
                        ))}
                    </select>
                    <Button
                        bsStyle="success"
                        bsSize="xsmall"
                        className="membership-btn-sm add-member-submit-btn"
                        disabled={!this.state.selectedUser}
                        onClick={this.handleAddMember}
                    >
                        <Message msgId="hydrata.anuga.addMemberButton" />
                    </Button>
                </div>
                {this.state.searchResults.length > 0 ? (
                    <div className="membership-search-results">
                        {this.state.searchResults.map(user => (
                            <div
                                key={user.pk}
                                className="membership-search-result"
                                style={this.state.selectedUser?.pk === user.pk
                                    ? {backgroundColor: 'rgba(51,122,183,0.3)'} : undefined}
                                onClick={() => this.setState({selectedUser: user, searchQuery: user.username})}
                            >
                                {user.username}
                                {user.first_name || user.last_name
                                    ? ` (${[user.first_name, user.last_name].filter(Boolean).join(' ')})`
                                    : ''}
                            </div>
                        ))}
                    </div>
                ) : null}
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
                    {this.renderAddMemberSection()}
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
    addMembershipRequest: (userId, role) => dispatch(addMembershipRequest(userId, role)),
    updateMembershipRequest: (membershipId, role) => dispatch(updateMembershipRequest(membershipId, role)),
    deleteMembershipRequest: (membershipId) => dispatch(deleteMembershipRequest(membershipId)),
    updateProjectVisibilityRequest: (visibility) => dispatch(updateProjectVisibilityRequest(visibility))
});

const MembershipPanel = connect(mapStateToProps, mapDispatchToProps)(MembershipPanelClass);

export {
    MembershipPanel
};
