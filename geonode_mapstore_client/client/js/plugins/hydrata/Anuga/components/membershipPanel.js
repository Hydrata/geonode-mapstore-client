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
        if (confirm(`Remove ${username} from project?`)) {
            this.props.deleteMembershipRequest(membershipId);
            trackEvent('button', 'click', 'membership-remove-member');
        }
    }

    handleVisibilityChange = (newVisibility) => {
        if (newVisibility === 'public' && this.props.visibility !== 'public') {
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
            <div style={{padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.15)', marginBottom: 8}}>
                <div style={{fontWeight: 'bold', marginBottom: 4}}>
                    <Message msgId="hydrata.anuga.projectVisibility" />
                </div>
                <div style={{display: 'flex', gap: 8}}>
                    {VISIBILITY_OPTIONS.map(opt => (
                        <Button
                            key={opt.value}
                            bsSize="xsmall"
                            bsStyle={this.props.visibility === opt.value ? 'primary' : 'default'}
                            style={{borderRadius: 2}}
                            onClick={() => this.handleVisibilityChange(opt.value)}
                        >
                            {opt.label}
                        </Button>
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
                    <span style={{
                        padding: '2px 6px',
                        borderRadius: 3,
                        fontSize: 11,
                        backgroundColor: '#337ab7',
                        color: 'white'
                    }}>
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
                            className="scenario-select"
                            style={{width: 'auto', minWidth: 90}}
                            onChange={(e) => this.handleRoleChange(membership.id, e.target.value)}
                        >
                            {ROLES.map(r => (
                                <option key={r.value} value={r.value}>{r.label}</option>
                            ))}
                        </select>
                    ) : (
                        <span style={{
                            padding: '2px 6px',
                            borderRadius: 3,
                            fontSize: 11,
                            backgroundColor: membership.role >= 4 ? '#5cb85c' : membership.role >= 3 ? '#f0ad4e' : '#777',
                            color: 'white'
                        }}>
                            {membership.role_label}
                        </span>
                    )}
                </td>
                <td>
                    {this.props.canManage ? (
                        <Button
                            bsStyle="danger"
                            bsSize="xsmall"
                            style={{borderRadius: 2, backgroundColor: '#622b2b'}}
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
            <div style={{borderTop: '2px solid rgba(255,255,255,0.15)', paddingTop: 10, marginTop: 5}}>
                <div style={{fontWeight: 'bold', marginBottom: 4}}>
                    <Message msgId="hydrata.anuga.addMember" />
                </div>
                <div style={{display: 'flex', gap: 4, alignItems: 'flex-start', flexWrap: 'wrap'}}>
                    <input
                        type="text"
                        className="data-title-input"
                        style={{width: 160}}
                        placeholder="Search users..."
                        value={this.state.searchQuery}
                        onChange={(e) => this.setState({searchQuery: e.target.value})}
                        onKeyDown={this.handleSearchKeyDown}
                    />
                    <Button
                        bsSize="xsmall"
                        style={{borderRadius: 2, marginTop: 2}}
                        onClick={this.searchUsers}
                        disabled={this.state.searching}
                    >
                        <span className="glyphicon glyphicon-search" />
                    </Button>
                    <select
                        className="scenario-select"
                        style={{width: 'auto', minWidth: 90}}
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
                        style={{borderRadius: 2, marginTop: 2}}
                        disabled={!this.state.selectedUser}
                        onClick={this.handleAddMember}
                    >
                        <Message msgId="hydrata.anuga.addMemberButton" />
                    </Button>
                </div>
                {this.state.searchResults.length > 0 ? (
                    <div style={{
                        marginTop: 4,
                        maxHeight: 120,
                        overflowY: 'auto',
                        border: '1px solid rgba(255,255,255,0.2)',
                        borderRadius: 3
                    }}>
                        {this.state.searchResults.map(user => (
                            <div
                                key={user.pk}
                                style={{
                                    padding: '4px 8px',
                                    cursor: 'pointer',
                                    backgroundColor: this.state.selectedUser?.pk === user.pk
                                        ? 'rgba(51,122,183,0.3)' : 'transparent'
                                }}
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
            <div id="membership-panel" className="simple-view-panel" style={{top: "70px", minWidth: 400}}>
                <div className="menu-rows-container">
                    <div className="row menu-row-header" style={{height: 40, textAlign: "left", fontSize: "large"}}>
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
