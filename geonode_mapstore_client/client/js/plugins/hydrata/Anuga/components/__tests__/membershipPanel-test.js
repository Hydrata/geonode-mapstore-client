/*
 * V2P-24 — MembershipPanel role-gated UI.
 *
 * Replaces the coarse `state.anuga.projects.data.my_role === 'manager'` gate
 * with per-row gating that reads each member row's `perms` array (V2P-14
 * SerializerMethodField on MembershipSerializerV2). Panel-level Add capability
 * is derived from project my_role + any row whose perms include
 * `change_resourcebase_permissions` — this is the V2P-30 case where an
 * organisation owner has no explicit ProjectMembership row but `get_user_role`
 * returns Role.MANAGER.
 *
 * Critical fallback: when state.anuga.resources.permsLoadFailed is true (the
 * V2P-20 /my-perms/ endpoint failed retries), the panel renders a read-only
 * row list. The owner must still SEE who's a member after a transient 5xx —
 * never empty, never locked out.
 */
import expect from 'expect';
import React from 'react';
import ReactDOM from 'react-dom';
import { Provider } from 'react-redux';

const ROLE_PERMS = {
    viewer: ['view_resourcebase', 'download_resourcebase'],
    contributor: ['view_resourcebase', 'download_resourcebase', 'change_resourcebase'],
    editor: ['view_resourcebase', 'download_resourcebase', 'change_resourcebase', 'delete_resourcebase'],
    manager: ['view_resourcebase', 'download_resourcebase', 'change_resourcebase', 'delete_resourcebase', 'change_resourcebase_permissions'],
    owner: ['view_resourcebase', 'download_resourcebase', 'change_resourcebase', 'delete_resourcebase', 'change_resourcebase_permissions']
};

function makeMembershipRows(role, count) {
    const perms = ROLE_PERMS[role] || [];
    return Array.from({ length: count }, (_, i) => ({
        id: i + 1,
        username: `user_${i + 1}`,
        role: 1,
        role_label: 'Viewer',
        perms: [...perms]
    }));
}

/**
 * Build a redux store stub. The MembershipPanel reads from:
 *   state.anuga.memberships.data            -- list of rows (each w/ perms)
 *   state.anuga.projects.data.my_role       -- legacy coarse gate fallback
 *   state.anuga.projects.data.owner_username
 *   state.anuga.resources.permsLoadFailed   -- V2P-20 retry-exhausted flag
 *   state.security.user.pk                  -- currentUserId for V2P-02
 *
 * `componentDidMount` dispatches FETCH_MEMBERSHIPS but no epic runs in this
 * test harness, so the rows stay as we set them.
 */
function createMockStore({ role = 'viewer', layerCount = 2, permsLoadFailed = false } = {}) {
    const state = {
        anuga: {
            memberships: {
                data: makeMembershipRows(role, layerCount),
                loading: false
            },
            projects: {
                data: {
                    id: 42,
                    my_role: role,
                    owner_username: 'project_owner',
                    visibility: 'private'
                }
            },
            resources: {
                terrain: [],
                boundaries: [],
                frictions: [],
                inflows: [],
                structures: [],
                fullMeshes: [],
                meshRegions: [],
                networks: [],
                catchments: [],
                nodes: [],
                links: [],
                publications: [],
                comparisons: [],
                computeInstances: [],
                permsLoadFailed
            }
        },
        security: { user: { pk: 9999 } },
        gnsettings: { geonodeUrl: 'http://localhost', jobName: 'hydratabase' },
        controls: {},
        localConfig: { plugins: {} }
    };
    return {
        getState: () => state,
        subscribe: () => () => {},
        dispatch: () => {}
    };
}

describe('V2P-24 membershipPanel role-gated UI', () => {
    let container;

    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
    });

    afterEach(() => {
        ReactDOM.unmountComponentAtNode(container);
        document.body.removeChild(container);
    });

    function mountPanel(opts) {
        const { MembershipPanel } = require('../membershipPanel');
        const store = createMockStore(opts);
        return new Promise((resolve) => {
            ReactDOM.render(
                <Provider store={store}><MembershipPanel /></Provider>,
                container,
                () => resolve(container)
            );
        });
    }

    it('AC#1 — manager sees Add panel + per-row Change/Remove on each row', () => {
        return mountPanel({ role: 'manager', layerCount: 2 }).then(() => {
            // Add-member panel rendered (panel-level affordance)
            expect(container.querySelector('.add-member')).toExist();
            expect(container.querySelector('.add-member-submit-btn')).toExist();
            // Per-row Change-role + Remove on each of the 2 member rows
            expect(container.querySelectorAll('.change-role-btn').length).toBe(2);
            expect(container.querySelectorAll('.remove-member-btn').length).toBe(2);
            // No warning banner
            expect(container.querySelector('.membership-perms-warning')).toBe(null);
        });
    });

    it('AC#2a — viewer sees no Add/Change/Remove affordances', () => {
        return mountPanel({ role: 'viewer', layerCount: 2 }).then(() => {
            expect(container.querySelector('.add-member')).toBe(null);
            expect(container.querySelectorAll('.change-role-btn').length).toBe(0);
            expect(container.querySelectorAll('.remove-member-btn').length).toBe(0);
            // But rows still render — viewer must see who's a member
            expect(container.querySelectorAll('.membership-member-row').length).toBe(2);
        });
    });

    it('AC#2b — contributor cannot Add or Remove members (per V2P-02 helper semantics)', () => {
        // Contributor's row.perms = [view, download, change_resourcebase] —
        // canEditLayer returns true via the change_resourcebase short-circuit
        // (V2P-02 helper line 183), so .change-role-btn DOES render. This is
        // documented V2P-02 contract; the back-end enforces the actual role
        // change anyway via MembershipViewSetV2's permission check.
        // canDeleteLayer requires delete_resourcebase OR editor+ role; the
        // contributor row has neither, so .remove-member-btn is hidden.
        // canAdd is panel-level: requires manager/owner role OR a row with
        // change_resourcebase_permissions — contributor has neither, so the
        // Add panel is suppressed.
        return mountPanel({ role: 'contributor', layerCount: 2 }).then(() => {
            expect(container.querySelector('.add-member')).toBe(null);
            expect(container.querySelectorAll('.remove-member-btn').length).toBe(0);
            // Visibility section also hidden (canAdd-gated)
            expect(container.querySelector('.membership-visibility')).toBe(null);
        });
    });

    it('AC#2c — editor can manage members per V2P-02 helper rules', () => {
        // Editor: canEditLayer/canDeleteLayer return true for editor role
        // unconditionally, so the Change-role and Remove buttons render even
        // though the panel-level Add is hidden (editor is not manager/owner).
        return mountPanel({ role: 'editor', layerCount: 2 }).then(() => {
            // Editor is NOT owner/manager AND row perms[]=editor lacks
            // change_resourcebase_permissions, so the Add panel stays hidden.
            expect(container.querySelector('.add-member')).toBe(null);
            // Per-row gating is more permissive — editor passes canEditLayer
            // and canDeleteLayer via the role-list rule, so each row gets
            // both buttons.
            expect(container.querySelectorAll('.change-role-btn').length).toBe(2);
            expect(container.querySelectorAll('.remove-member-btn').length).toBe(2);
        });
    });

    it('AC#3 — V2P-30 org-owner-as-manager flow: my_role=manager grants full per-row affordances', () => {
        // Simulate the org-owner case: my_role='manager' and member.perms
        // include change_resourcebase_permissions because V2P-30 returns
        // Role.MANAGER even without an explicit ProjectMembership row. Both
        // gating paths pass; the panel renders Add + per-row buttons on each.
        return mountPanel({ role: 'manager', layerCount: 3 }).then(() => {
            expect(container.querySelector('.add-member')).toExist();
            expect(container.querySelectorAll('.change-role-btn').length).toBe(3);
            expect(container.querySelectorAll('.remove-member-btn').length).toBe(3);
        });
    });

    it('AC#4 — permsLoadFailed=true forces read-only row list (rows visible, no affordances)', () => {
        return mountPanel({ role: 'manager', layerCount: 2, permsLoadFailed: true }).then(() => {
            // Owner must SEE who's a member (V2P-15: never empty)
            expect(container.querySelectorAll('.membership-member-row').length).toBe(2);
            // BUT no action affordances render — purely read-only fallback
            expect(container.querySelector('.add-member')).toBe(null);
            expect(container.querySelectorAll('.change-role-btn').length).toBe(0);
            expect(container.querySelectorAll('.remove-member-btn').length).toBe(0);
            // Warning banner is visible explaining read-only mode
            expect(container.querySelector('.membership-perms-warning')).toExist();
            expect(container.querySelector('.alert.alert-warning')).toExist();
        });
    });

    it('AC#4b — permsLoadFailed=true also hides the Visibility section (destructive owner action)', () => {
        return mountPanel({ role: 'owner', layerCount: 1, permsLoadFailed: true }).then(() => {
            // Visibility section is owner-only and destructive — must not
            // render in the read-only fallback even for owners.
            expect(container.querySelector('.membership-visibility')).toBe(null);
        });
    });

    it('AC#5 — owner row always renders (independent of permsLoadFailed)', () => {
        return mountPanel({ role: 'manager', layerCount: 0, permsLoadFailed: true }).then(() => {
            // The synthetic Owner row is rendered alongside the member rows
            // and is NOT gated by permsLoadFailed — it's part of the panel's
            // identity, not an action affordance.
            const ownerRow = container.querySelector('.membership-owner-row');
            expect(ownerRow).toExist();
            expect(ownerRow.textContent).toInclude('project_owner');
        });
    });

    it('AC#6 — owner sees Add + per-row Change/Remove (covers normal owner flow)', () => {
        return mountPanel({ role: 'owner', layerCount: 2 }).then(() => {
            expect(container.querySelector('.add-member')).toExist();
            expect(container.querySelectorAll('.change-role-btn').length).toBe(2);
            expect(container.querySelectorAll('.remove-member-btn').length).toBe(2);
            // Visibility section visible for owner (was canManage-gated; now canAdd-gated)
            expect(container.querySelector('.membership-visibility')).toExist();
        });
    });
});
