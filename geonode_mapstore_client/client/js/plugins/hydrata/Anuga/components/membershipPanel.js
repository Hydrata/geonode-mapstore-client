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
    canManageMembers,
    isOwnerAnugaMap,
    getProjectVisibility,
    getProjectMyRole
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
        canManage: PropTypes.bool,
        isOwner: PropTypes.bool,
        visibility: PropTypes.string,
        myRole: PropTypes.string,
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
        if (!this.props.canManage) return null;
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
            <tr>
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
        return (
            <tr key={membership.id}>
                <td>{membership.username}</td>
                <td>
                    {this.props.canManage ? (
                        <select
                            value={membership.role}
                            className="scenario-select membership-role-select"
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
                    {this.props.canManage ? (
                        <Button
                            bsStyle="danger"
                            bsSize="xsmall"
                            className="membership-btn-remove"
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
        if (!this.props.canManage) return null;
        return (
            <div className="membership-add-form">
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
                        className="membership-btn-sm"
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

const mapStateToProps = (state) => ({
    memberships: getMemberships(state),
    loading: getMembershipsLoading(state),
    canManage: canManageMembers(state),
    isOwner: isOwnerAnugaMap(state),
    visibility: getProjectVisibility(state),
    myRole: getProjectMyRole(state),
    ownerUsername: state?.anuga?.projects?.data?.owner_username || 'owner'
});

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
