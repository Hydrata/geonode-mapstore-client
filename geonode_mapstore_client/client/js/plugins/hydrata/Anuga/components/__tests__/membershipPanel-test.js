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
function createMockStore({
    role = 'viewer',
    layerCount = 2,
    permsLoadFailed = false,
    invitations = [],
    invitationsEnabled = true
} = {}) {
    const state = {
        anuga: {
            memberships: {
                data: makeMembershipRows(role, layerCount),
                loading: false,
                // TASK-860 — invitation state defaults for tests
                invitations,
                invitations_enabled: invitationsEnabled
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
                // TASK-955 (W2.2 FE) — Rainfall slice for completeness.
                rainfalls: [],
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

    function mountPanel(opts = {}) {
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
            expect(container.querySelector('.invite-member')).toExist();
            expect(container.querySelector('.invite-submit-btn')).toExist();
            // Per-row Change-role + Remove on each of the 2 member rows
            expect(container.querySelectorAll('.change-role-btn').length).toBe(2);
            expect(container.querySelectorAll('.remove-member-btn').length).toBe(2);
            // No warning banner
            expect(container.querySelector('.sv-membership-perms-warning')).toBe(null);
        });
    });

    it('AC#2a — viewer sees no Add/Change/Remove affordances', () => {
        return mountPanel({ role: 'viewer', layerCount: 2 }).then(() => {
            expect(container.querySelector('.invite-member')).toBe(null);
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
            expect(container.querySelector('.invite-member')).toBe(null);
            expect(container.querySelectorAll('.remove-member-btn').length).toBe(0);
            // Visibility section also hidden (canAdd-gated)
            expect(container.querySelector('.sv-membership-visibility')).toBe(null);
        });
    });

    it('AC#2c — editor can manage members per V2P-02 helper rules', () => {
        // Editor: canEditLayer/canDeleteLayer return true for editor role
        // unconditionally, so the Change-role and Remove buttons render even
        // though the panel-level Add is hidden (editor is not manager/owner).
        return mountPanel({ role: 'editor', layerCount: 2 }).then(() => {
            // Editor is NOT owner/manager AND row perms[]=editor lacks
            // change_resourcebase_permissions, so the Add panel stays hidden.
            expect(container.querySelector('.invite-member')).toBe(null);
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
            expect(container.querySelector('.invite-member')).toExist();
            expect(container.querySelectorAll('.change-role-btn').length).toBe(3);
            expect(container.querySelectorAll('.remove-member-btn').length).toBe(3);
        });
    });

    it('AC#4 — permsLoadFailed=true forces read-only row list (rows visible, no affordances)', () => {
        return mountPanel({ role: 'manager', layerCount: 2, permsLoadFailed: true }).then(() => {
            // Owner must SEE who's a member (V2P-15: never empty)
            expect(container.querySelectorAll('.membership-member-row').length).toBe(2);
            // BUT no action affordances render — purely read-only fallback
            expect(container.querySelector('.invite-member')).toBe(null);
            expect(container.querySelectorAll('.change-role-btn').length).toBe(0);
            expect(container.querySelectorAll('.remove-member-btn').length).toBe(0);
            // Warning banner is visible explaining read-only mode
            expect(container.querySelector('.sv-membership-perms-warning')).toExist();
            expect(container.querySelector('.alert.alert-warning')).toExist();
        });
    });

    it('AC#4b — permsLoadFailed=true also hides the Visibility section (destructive owner action)', () => {
        return mountPanel({ role: 'owner', layerCount: 1, permsLoadFailed: true }).then(() => {
            // Visibility section is owner-only and destructive — must not
            // render in the read-only fallback even for owners.
            expect(container.querySelector('.sv-membership-visibility')).toBe(null);
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
            expect(container.querySelector('.invite-member')).toExist();
            expect(container.querySelectorAll('.change-role-btn').length).toBe(2);
            expect(container.querySelectorAll('.remove-member-btn').length).toBe(2);
            // Visibility section visible for owner (was canManage-gated; now canAdd-gated)
            expect(container.querySelector('.sv-membership-visibility')).toExist();
        });
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// TASK-860 / TASK-862 — W3 incremental coverage
// ─────────────────────────────────────────────────────────────────────────────

describe('TASK-860 W3 — email-invite gating, pending-invitations, throttle, i18n', () => {
    let container;

    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
    });

    afterEach(() => {
        ReactDOM.unmountComponentAtNode(container);
        document.body.removeChild(container);
    });

    function mountPanel(opts = {}) {
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

    // (a) Email-validation gating: Send disabled until a non-empty, trimmed
    // email string is present in the input. The component gates on
    // `!this.state.inviteEmail.trim()` for the disabled prop.
    it('AC(a)-1 — Send button disabled when email input is empty', () => {
        return mountPanel({ role: 'manager', layerCount: 0 }).then(() => {
            const sendBtn = container.querySelector('.invite-submit-btn');
            expect(sendBtn).toExist();
            // Default state: inviteEmail = '' => trimmed = '' => disabled
            expect(sendBtn.disabled).toBe(true);
        });
    });

    it('AC(a)-2 — invitations disabled site flag also disables Send', () => {
        return mountPanel({ role: 'manager', layerCount: 0, invitationsEnabled: false }).then(() => {
            const sendBtn = container.querySelector('.invite-submit-btn');
            expect(sendBtn).toExist();
            expect(sendBtn.disabled).toBe(true);
            // Disabled banner shown when invitationsEnabled=false
            expect(container.querySelector('.sv-membership-invite-disabled')).toExist();
        });
    });

    it('AC(a)-3 — invite form not rendered for viewer (canAdd=false)', () => {
        return mountPanel({ role: 'viewer', layerCount: 1 }).then(() => {
            expect(container.querySelector('.invite-email-input')).toBe(null);
            expect(container.querySelector('.invite-submit-btn')).toBe(null);
        });
    });

    // (c) Pending-invitations list rendering: manager sees section when there
    // are pending invitations; viewer does not.
    it('AC(c)-1 — pending invitations list renders for manager with pending invites', () => {
        const invitations = [
            {id: 1, email: 'pending@example.com', status: 'pending', role: 1, role_label: 'Viewer'},
            {id: 2, email: 'also@example.com', status: 'pending', role: 3, role_label: 'Editor'}
        ];
        return mountPanel({ role: 'manager', layerCount: 0, invitations }).then(() => {
            expect(container.querySelector('.membership-invitations-section')).toExist();
            const rows = container.querySelectorAll('.membership-invitation-row');
            expect(rows.length).toBe(2);
            // First row email text
            expect(rows[0].textContent).toInclude('pending@example.com');
        });
    });

    it('AC(c)-2 — accepted invitations are filtered out of the pending list', () => {
        const invitations = [
            {id: 1, email: 'p@x.com', status: 'pending', role: 1, role_label: 'Viewer'},
            {id: 2, email: 'a@x.com', status: 'accepted', role: 1, role_label: 'Viewer'}
        ];
        return mountPanel({ role: 'manager', layerCount: 0, invitations }).then(() => {
            const rows = container.querySelectorAll('.membership-invitation-row');
            // Only the pending one should appear
            expect(rows.length).toBe(1);
            expect(rows[0].textContent).toInclude('p@x.com');
        });
    });

    it('AC(c)-3 — invitations section absent when no pending invitations exist', () => {
        return mountPanel({ role: 'manager', layerCount: 0, invitations: [] }).then(() => {
            expect(container.querySelector('.membership-invitations-section')).toBe(null);
        });
    });

    // (d) Revoke + resend button presence/dispatch
    it('AC(d)-1 — revoke button present for each pending invitation', () => {
        const invitations = [
            {id: 1, email: 'r@x.com', status: 'pending', role: 1, role_label: 'Viewer'}
        ];
        return mountPanel({ role: 'manager', layerCount: 0, invitations }).then(() => {
            expect(container.querySelector('.revoke-invitation-btn')).toExist();
        });
    });

    it('AC(d)-2 — resend button present when invitationsEnabled=true', () => {
        const invitations = [
            {id: 1, email: 'r@x.com', status: 'pending', role: 1, role_label: 'Viewer'}
        ];
        return mountPanel({ role: 'manager', layerCount: 0, invitations, invitationsEnabled: true }).then(() => {
            expect(container.querySelector('.resend-invitation-btn')).toExist();
        });
    });

    it('AC(d)-3 — resend button absent when invitationsEnabled=false', () => {
        const invitations = [
            {id: 1, email: 'r@x.com', status: 'pending', role: 1, role_label: 'Viewer'}
        ];
        return mountPanel({ role: 'manager', layerCount: 0, invitations, invitationsEnabled: false }).then(() => {
            expect(container.querySelector('.resend-invitation-btn')).toBe(null);
            // Revoke is always present (enabled or not)
            expect(container.querySelector('.revoke-invitation-btn')).toExist();
        });
    });

    // (e) Registered vs unregistered: the UI renders identically for both.
    // The panel never shows whether an invite target is registered — it
    // dispatches sendInvitationRequest and shows the same 202-path UI.
    it('AC(e) — UI cannot distinguish registered vs unregistered (opaque 202)', () => {
        // Both scenarios produce the same invite-form + pending-list UI.
        // This test asserts that the form renders identically regardless of
        // the invitation list content (no "registered user" indicator).
        const pendingInvitations = [
            {id: 1, email: 'registered@x.com', status: 'pending', role: 1, role_label: 'Viewer'},
            {id: 2, email: 'new@x.com', status: 'pending', role: 1, role_label: 'Viewer'}
        ];
        return mountPanel({ role: 'manager', layerCount: 0, invitations: pendingInvitations }).then(() => {
            const rows = container.querySelectorAll('.membership-invitation-row');
            expect(rows.length).toBe(2);
            // Both rows have the same structure: no "user exists" indicator
            rows.forEach(row => {
                // Each row has a role badge and action buttons, NOT a
                // "registered user" indicator cell
                expect(row.querySelector('.sv-badge-role')).toExist();
                expect(row.querySelector('.registered-indicator')).toBe(null);
            });
        });
    });

    // (f) 429 throttle response: the panel renders without crashing when
    // invitationsEnabled=true but the store's dispatch stub does nothing.
    // The epic surfaces a toast on 429 — the panel component itself just
    // dispatches resendInvitationRequest and does not handle the 429 directly.
    // We assert the panel still renders + resend button is present (no crash).
    it('AC(f) — panel does not crash on render when 429 throttle is in play (dispatch stub no-op)', () => {
        const invitations = [
            {id: 1, email: 't@x.com', status: 'pending', role: 1, role_label: 'Viewer'}
        ];
        // The store's dispatch is a no-op; clicking resend will dispatch the
        // action but no observable side-effect occurs in this test harness.
        return mountPanel({ role: 'manager', layerCount: 0, invitations }).then(() => {
            expect(container.querySelector('.membership-invitations-section')).toExist();
            const resendBtn = container.querySelector('.resend-invitation-btn');
            expect(resendBtn).toExist();
            // Simulate click — must not throw
            let threw = false;
            try { resendBtn.click(); } catch (e) { threw = true; }
            expect(threw).toBe(false);
            // Panel stays mounted after the click
            expect(container.querySelector('#membership-panel')).toExist();
        });
    });

    // (g) i18n key resolution: assert keys used by the panel exist in the
    // Anuga en-US bundle and resolve to non-empty strings (no raw-key leakage).
    it('AC(g) — i18n keys used by the panel exist in the en-US translation bundle', () => {
        const { enMessages } = require('../../../../../__tests__/fixtures/translations');
        const panelKeys = [
            'hydrata.anuga.members',
            'hydrata.anuga.memberUser',
            'hydrata.anuga.memberRole',
            'hydrata.anuga.projectVisibility',
            'hydrata.anuga.permsUnavailable.message'
        ];
        panelKeys.forEach(key => {
            expect(enMessages[key]).toExist(`Missing i18n key: ${key}`);
            expect(typeof enMessages[key]).toBe('string', `Key ${key} should be a string`);
            expect(enMessages[key].length).toBeGreaterThan(0, `Empty value for key: ${key}`);
        });
    });
});

// TASK-2235 — the Permissions panel rides the MovablePanel primitive: drag by
// header, corner resize, position/size persisted per panelId 'membership'.
// The #membership-panel id survives on an inner wrapper so the existing tests
// + CSS that target its descendants keep working.
describe('TASK-2235 MembershipPanel — movable', () => {
    let container;

    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
    });

    afterEach(() => {
        ReactDOM.unmountComponentAtNode(container);
        document.body.removeChild(container);
    });

    function mountMovable(opts = {}, mutateState) {
        const { MembershipPanel } = require('../membershipPanel');
        const base = createMockStore(opts);
        if (mutateState) { mutateState(base.getState()); }
        const dispatched = [];
        const store = {
            getState: base.getState,
            subscribe: base.subscribe,
            dispatch: (a) => { dispatched.push(a); return a; }
        };
        return new Promise((resolve) => {
            ReactDOM.render(
                <Provider store={store}><MembershipPanel /></Provider>,
                container,
                () => resolve({ dispatched })
            );
        });
    }

    it('renders inside a MovablePanel; #membership-panel id survives as inner wrapper', () => {
        return mountMovable({ role: 'manager' }).then(() => {
            const panel = container.querySelector('[data-testid="movable-panel-membership"]');
            expect(panel).toExist();
            expect(panel.querySelector('#membership-panel')).toExist();
            expect(panel.querySelector('.sv-movable-panel-header')).toExist();
            expect(panel.querySelector('.sv-panel-header-close')).toExist();
        });
    });

    it('close chip dispatches SET_MEMBERSHIP_PANEL visible=false', () => {
        return mountMovable({ role: 'manager' }).then(({ dispatched }) => {
            container.querySelector('.sv-panel-header-close').click();
            const closeAction = dispatched.find(a =>
                a.type === 'SET_MEMBERSHIP_PANEL' && a.visible === false
            );
            expect(closeAction).toExist();
        });
    });

    it('applies a persisted position from anuga.ui.movablePanels.membership', () => {
        return mountMovable({ role: 'manager' }, (state) => {
            state.anuga.ui = { movablePanels: { membership: { position: { x: 19, y: 27 } } } };
        }).then(() => {
            const panel = container.querySelector('[data-testid="movable-panel-membership"]');
            expect(panel.style.transform).toInclude('19px');
            expect(panel.style.transform).toInclude('27px');
        });
    });

    it('drag-end dispatches ANUGA:SET_MOVABLE_PANEL_STATE keyed membership', () => {
        return mountMovable({ role: 'manager' }).then(({ dispatched }) => {
            const header = container.querySelector('[data-testid="movable-panel-membership"] .sv-movable-panel-header');
            header.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, clientX: 50, clientY: 50 }));
            document.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, cancelable: true, clientX: 85, clientY: 95 }));
            document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, clientX: 85, clientY: 95 }));
            const act = dispatched.find(a => a.type === 'ANUGA:SET_MOVABLE_PANEL_STATE');
            expect(act).toExist();
            expect(act.panelId).toBe('membership');
            expect(act.patch.position).toExist();
        });
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// TASK-2399 (dogfood F14) — sharing-dialog truth pass:
//   (1) 'Public' copy names the real public-UNLISTED semantics instead of
//       overstating bot-browsable exposure ("Anyone can view").
//   (2) freemium context: the Private option shows its paid-tier status
//       BEFORE interaction (paywallEnabled cfg, threaded from the Anuga
//       plugin's localConfig cfg via anugaContainer), never only discovered
//       via a bare 402.
//   (3) the new-project default-visibility policy (Public) is stated
//       explicitly in the dialog.
// ─────────────────────────────────────────────────────────────────────────────
describe('TASK-2399 MembershipPanel — sharing-dialog truth pass', () => {
    let container;

    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
    });

    afterEach(() => {
        ReactDOM.unmountComponentAtNode(container);
        document.body.removeChild(container);
    });

    function mountPanel(opts = {}, ownProps = {}) {
        const { MembershipPanel } = require('../membershipPanel');
        const store = createMockStore(opts);
        return new Promise((resolve) => {
            ReactDOM.render(
                <Provider store={store}><MembershipPanel {...ownProps} /></Provider>,
                container,
                () => resolve(container)
            );
        });
    }

    it('AC#1 — Public option copy names public-UNLISTED semantics, not bare "Anyone can view"', () => {
        return mountPanel({ role: 'owner', layerCount: 0 }).then(() => {
            const rows = container.querySelectorAll('.sv-membership-visibility-option-row');
            const publicRow = Array.from(rows).find(r => r.textContent.includes('Public'));
            expect(publicRow).toExist();
            expect(publicRow.textContent).toInclude('not listed in the public project directory');
            expect(publicRow.textContent).toNotInclude('Anyone can view');
        });
    });

    it('AC#2a — Private option carries NO paid-tier badge when paywallEnabled is false (dark ship default)', () => {
        return mountPanel({ role: 'owner', layerCount: 0 }, { paywallEnabled: false }).then(() => {
            expect(container.querySelector('[data-testid="sv-membership-visibility-paid-badge"]')).toBe(null);
        });
    });

    it('AC#2b — Private option shows a paid-tier badge BEFORE interaction when paywallEnabled is true', () => {
        return mountPanel({ role: 'owner', layerCount: 0 }, { paywallEnabled: true }).then(() => {
            const badge = container.querySelector('[data-testid="sv-membership-visibility-paid-badge"]');
            expect(badge).toExist();
            expect(badge.textContent).toInclude('paid feature');
            // The badge sits under Private, not Public/Organization.
            const privateRow = Array.from(container.querySelectorAll('.sv-membership-visibility-option-row'))
                .find(r => r.textContent.includes('Private'));
            expect(privateRow.contains(badge)).toBe(true);
        });
    });

    it('AC#3 — the default-visibility policy note is present and mentions the paid upgrade only when paywallEnabled', () => {
        return mountPanel({ role: 'owner', layerCount: 0 }, { paywallEnabled: true }).then(() => {
            const note = container.querySelector('.sv-membership-visibility-default-note');
            expect(note).toExist();
            expect(note.textContent).toInclude('Public');
            expect(note.textContent).toInclude('paid');
        });
    });

    it('AC#3b — the default-visibility policy note renders without paid-upgrade mention when dark', () => {
        return mountPanel({ role: 'owner', layerCount: 0 }, { paywallEnabled: false }).then(() => {
            const note = container.querySelector('.sv-membership-visibility-default-note');
            expect(note).toExist();
            expect(note.textContent).toNotInclude('paid');
        });
    });
});
