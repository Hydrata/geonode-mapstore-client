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
    invitationsEnabled = true,
    // TASK-2466 (epic 2425 W2.5) — the "Current" pill follows this, so a test
    // needs to be able to make Organization the active row.
    visibility = 'private',
    // TASK-2440 (epic 2425 W4.1) — the visibility change the server is being
    // asked for right now, or null. The store stub is STATIC (dispatch is a
    // no-op), so a click cannot arm this; tests preset it instead and the
    // arming itself is pinned by the reducer test in epicsAnuga-test.js.
    visibilityPending = null,
    membershipsLoading = false,
    // TASK-2780 (epic 2765 W4) — the TASK-2548 map-id STAMP on the projects
    // slice, which is where the project link's <base_map_id> comes from. It is
    // deliberately NOT a field of `projects.data`: the retrieve serializer is
    // ProjectSerializerV2 and only ProjectSerializerV2Full carries `base_map`
    // (see projectsReducer.js's "WHY A STAMP AND NOT A FIELD OF `data`" note),
    // so a fixture that put base_map on `data` would green a read that is
    // undefined in the live app. Pass `null` to exercise the no-map project.
    mapId = 118,
    // Legacy/fail-safe source, matching warmTilesEpic.js's documented read
    // order. Only reachable when the host never dispatched SET_RESOURCE_ID.
    baseMapOnData = undefined
} = {}) {
    const state = {
        anuga: {
            memberships: {
                data: makeMembershipRows(role, layerCount),
                loading: membershipsLoading,
                // TASK-860 — invitation state defaults for tests
                invitations,
                invitations_enabled: invitationsEnabled
            },
            projects: {
                mapId,
                data: {
                    id: 42,
                    my_role: role,
                    owner_username: 'project_owner',
                    visibility,
                    ...(baseMapOnData === undefined ? {} : {base_map: baseMapOnData})
                },
                visibilityPending
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
            'hydrata.anuga.permsUnavailable.message',
            // TASK-2420 (epic 2359 W4.5) — Account panel rename + tabs.
            'hydrata.anuga.accountPanelTitle',
            'hydrata.anuga.accountTabSharing',
            'hydrata.anuga.accountTabBilling'
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
            const badge = container.querySelector('[data-tier="private"][data-testid="sv-membership-visibility-paid-badge"]');
            expect(badge).toExist();
            expect(badge.textContent).toInclude('Paid');
            // NOTE (TASK-2466): this used to read "the badge sits under Private,
            // not Public/Organization". Organization now carries one too — it
            // always was a paid tier — so the query is scoped by data-tier
            // rather than taking the first badge and asserting a claim that is
            // deliberately no longer true.
            const privateRow = Array.from(container.querySelectorAll('.sv-membership-visibility-option-row'))
                .find(r => r.textContent.includes('Private'));
            expect(privateRow.contains(badge)).toBe(true);
        });
    });

    // ── TASK-2466 (epic 2425 W2.5) ──────────────────────────────────────────
    // Organization is a paid tier and this panel advertised it as free. That is
    // the mislead that made the original organization->private bypass a
    // two-click accident rather than an exploit (epic dogfood finding 1: "the
    // UI offers all three as plain radio rows and only Private carries the Paid
    // pill"). The backend has treated organization as paid since 0c2faa4, and
    // W1 doubled down: TASK-2431's destination gate charges for any change INTO
    // organization, TASK-2432 gave it a distinct paid steady state.
    it('AC#1 — the Organization row carries a Paid badge, the SAME component/classes as Private (not a lookalike)', () => {
        return mountPanel({ role: 'owner', layerCount: 0 }, { paywallEnabled: true }).then(() => {
            const orgBadge = container.querySelector('[data-tier="organization"][data-testid="sv-membership-visibility-paid-badge"]');
            const privBadge = container.querySelector('[data-tier="private"][data-testid="sv-membership-visibility-paid-badge"]');
            expect(orgBadge).toExist('the Organization row has no Paid badge — the UI still offers a paid tier as free');
            expect(orgBadge.textContent).toBe(privBadge.textContent);
            // "the same badge, not a lookalike" == identical class list. A
            // second component with matching pixels is exactly what drifts.
            expect(orgBadge.className).toBe(privBadge.className);
            expect(orgBadge.tagName).toBe(privBadge.tagName);
            expect(orgBadge.className).toInclude('sv-account-pill');
            expect(orgBadge.className).toInclude('sv-account-pill--paid');

            const orgRow = Array.from(container.querySelectorAll('.sv-membership-visibility-option-row'))
                .find(r => r.textContent.startsWith('Organization'));
            expect(orgRow.contains(orgBadge)).toBe(true);
        });
    });

    it('AC#1b — Public is the ONLY row without a Paid badge (exactly two paid tiers)', () => {
        return mountPanel({ role: 'owner', layerCount: 0 }, { paywallEnabled: true }).then(() => {
            const badges = container.querySelectorAll('[data-testid="sv-membership-visibility-paid-badge"]');
            expect(badges.length).toBe(2);
            const publicRow = Array.from(container.querySelectorAll('.sv-membership-visibility-option-row'))
                .find(r => r.textContent.startsWith('Public'));
            expect(publicRow.querySelector('[data-testid="sv-membership-visibility-paid-badge"]')).toBe(null);
        });
    });

    it('AC#2 — the Organization badge describes the TIER, not the viewer: present for an entitled owner too', () => {
        // No entitlement input reaches this component at all — the pill is a
        // fact about the tier. Asserted here so nobody later "improves" it by
        // gating on the viewer's own subscription, which would make the paywall
        // invisible to exactly the people about to hit it.
        return mountPanel({ role: 'owner', layerCount: 0, visibility: 'organization' }, { paywallEnabled: true }).then(() => {
            expect(container.querySelector('[data-tier="organization"][data-testid="sv-membership-visibility-paid-badge"]')).toExist();
        });
    });

    it('AC#3 — Paid and Current co-exist on the Organization row when it is the active visibility', () => {
        return mountPanel({ role: 'owner', layerCount: 0, visibility: 'organization' }, { paywallEnabled: true }).then(() => {
            const orgTitle = Array.from(container.querySelectorAll('.sv-membership-visibility-option-title'))
                .find(t => t.textContent.startsWith('Organization'));
            expect(orgTitle).toExist();
            const paid = orgTitle.querySelector('[data-testid="sv-membership-visibility-paid-badge"]');
            const current = orgTitle.querySelector('.sv-account-pill--current');
            expect(paid).toExist();
            expect(current).toExist();
            expect(current.textContent).toBe('Current');
            // Both are children of the same flex line, in a stable order.
            expect(paid.parentNode).toBe(orgTitle);
            expect(current.parentNode).toBe(orgTitle);
            expect(paid.compareDocumentPosition(current) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
            // NOTE: "without wrapping or overlapping" is a LAYOUT claim and
            // jsdom has no layout engine — this proves co-existence and order
            // only. The geometry is asserted in
            // deploy/tests/e2e/test_paywall_money_path.py
            // (test_organization_row_shows_paid_and_current_side_by_side).
        });
    });

    it('AC#2a-org — no Organization badge under the kill-switch either', () => {
        return mountPanel({ role: 'owner', layerCount: 0 }, { paywallEnabled: false }).then(() => {
            expect(container.querySelectorAll('[data-testid="sv-membership-visibility-paid-badge"]').length).toBe(0);
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

// TASK-2420 (epic 2359 W4.5) — Account panel rename + Billing tab + tab-bar
// manager-gating.
describe('TASK-2420 MembershipPanel — Account panel tabs', () => {
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

    it('AC1 — flags-off: title is "Permissions", no tab bar at all', () => {
        return mountPanel({ role: 'owner', layerCount: 0 }, { paywallEnabled: false }).then(() => {
            // No <Localized> wrapper in this harness — <Message> renders the
            // raw msgId, which the en-US bundle resolves to "Permissions"
            // (see the AC(g) i18n-key-existence test above).
            expect(container.querySelector('.sv-panel-header-title').textContent).toInclude('hydrata.anuga.members');
            expect(container.querySelector('[data-testid="sv-account-tab-bar"]')).toBe(null);
            expect(container.querySelector('#membership-panel')).toExist();
        });
    });

    it('AC2 — flags-on, manager: title "Account", BOTH tabs shown, Sharing active by default', () => {
        return mountPanel({ role: 'owner', layerCount: 0 }, { paywallEnabled: true }).then(() => {
            expect(container.querySelector('.sv-panel-header-title').textContent).toInclude('hydrata.anuga.accountPanelTitle');
            expect(container.querySelector('[data-testid="sv-account-tab-sharing"]')).toExist();
            expect(container.querySelector('[data-testid="sv-account-tab-billing"]')).toExist();
            expect(container.querySelector('#membership-panel')).toExist(); // Sharing content by default
            expect(container.querySelector('[data-testid="sv-account-billing-tab"]')).toBe(null);
        });
    });

    it('AC2 — flags-on, non-manager: NO Sharing tab at all, Billing renders directly', () => {
        return mountPanel({ role: 'viewer', layerCount: 0 }, { paywallEnabled: true }).then(() => {
            expect(container.querySelector('[data-testid="sv-account-tab-sharing"]')).toBe(null);
            expect(container.querySelector('[data-testid="sv-account-tab-billing"]')).toExist();
            expect(container.querySelector('#membership-panel')).toBe(null);
            // Billing tab renders (loading state until the fetch resolves —
            // no epic runs in this harness, so it stays in 'loading').
            expect(container.querySelector('[data-testid="sv-account-billing-loading"]')).toExist();
        });
    });

    it('clicking the Billing tab (manager) switches to Billing and dispatches SET_MEMBERSHIP_PANEL_TAB', () => {
        const { MembershipPanel } = require('../membershipPanel');
        const store = createMockStore({ role: 'owner', layerCount: 0 });
        let currentTab = 'sharing';
        const wrappedStore = {
            getState: () => {
                const s = store.getState();
                return { ...s, anuga: { ...s.anuga, ui: { membershipPanelTab: currentTab } } };
            },
            subscribe: () => () => {},
            dispatch: (a) => {
                if (a.type === 'SET_MEMBERSHIP_PANEL_TAB') currentTab = a.tab;
                return a;
            }
        };
        return new Promise((resolve) => {
            ReactDOM.render(
                <Provider store={wrappedStore}><MembershipPanel paywallEnabled /></Provider>,
                container,
                () => resolve()
            );
        }).then(() => {
            container.querySelector('[data-testid="sv-account-tab-billing"]').click();
            expect(currentTab).toBe('billing');
        });
    });
});

// ─── TASK-2440 (epic 2425 W4.1): in-flight state on the Sharing visibility
// rows ────────────────────────────────────────────────────────────────────────
//
// Operator report, 2026-07-25: "the Account buttons to change the subscription
// are very laggy, it seems they wait for the backend response before giving any
// UI feedback when clicked." Confirmed in source — handleVisibilityChange
// dispatched and returned, so EVERY scrap of feedback waited on the response.
// The response time is what it is; what was missing is the acknowledgement, and
// an unacknowledged button is what makes someone click it twice.
//
// The store stub here is static (dispatch is a no-op), so a click cannot arm
// the flag in this harness. These mount with the flag preset; the arming itself
// is pinned by the reducer test in epicsAnuga-test.js.
describe('TASK-2440 MembershipPanel — visibility rows show in-flight state', () => {
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

    const rows = () => Array.from(container.querySelectorAll('.sv-membership-visibility-option-row'));
    const rowNamed = (name) => rows().find(r => r.textContent.startsWith(name));

    it('AC#3 — with a change in flight EVERY row is disabled (no second click can land)', () => {
        return mountPanel({role: 'owner', layerCount: 0, visibilityPending: 'private'}).then(() => {
            expect(rows().length).toBe(3);
            rows().forEach(r => {
                expect(r.disabled).toBe(true, `row "${r.textContent.slice(0, 20)}" is still clickable mid-request`);
            });
        });
    });

    it('AC#3 — the row being requested carries aria-busy, so it is not a silently dead radiogroup', () => {
        return mountPanel({role: 'owner', layerCount: 0, visibilityPending: 'private'}).then(() => {
            expect(rowNamed('Private').getAttribute('aria-busy')).toBe('true');
            // Only the requested row is busy — the other two are merely disabled.
            expect(rowNamed('Public').getAttribute('aria-busy')).toNotBe('true');
            expect(rowNamed('Organization').getAttribute('aria-busy')).toNotBe('true');
        });
    });

    it('AC#3 — the requested row carries a VISIBLE busy affordance, not just an attribute', () => {
        return mountPanel({role: 'owner', layerCount: 0, visibilityPending: 'organization'}).then(() => {
            const busy = container.querySelector('[data-testid="sv-membership-visibility-working"]');
            expect(busy).toExist('no visible in-flight affordance — a greyed row alone still reads as broken');
            expect(rowNamed('Organization').contains(busy)).toBe(true);
            // Exactly one, on the row actually being requested.
            expect(container.querySelectorAll('[data-testid="sv-membership-visibility-working"]').length).toBe(1);
        });
    });

    it('AC#3 — with nothing in flight no row is disabled and nothing is busy', () => {
        return mountPanel({role: 'owner', layerCount: 0, visibilityPending: null}).then(() => {
            rows().forEach(r => expect(r.disabled).toBe(false));
            expect(container.querySelector('[data-testid="sv-membership-visibility-working"]')).toBe(null);
        });
    });

    it('AC#5 — getMembershipsLoading is NOT reused: a memberships fetch greys nothing here', () => {
        // The panel already had a `loading` prop and it means the memberships
        // LIST. Reusing it would grey out the visibility rows on an unrelated
        // list refresh.
        return mountPanel({
            role: 'owner', layerCount: 0, membershipsLoading: true, visibilityPending: null
        }).then(() => {
            rows().forEach(r => expect(r.disabled).toBe(false, 'a memberships-list fetch disabled the visibility rows'));
        });
    });

    // AC#7 — recast as a REGRESSION GUARD. gmc a1e4a9fb3 (TASK-2464) already
    // made the success branch refetch, so the pill follows server state. No
    // production change should be needed to pass this; if one is, something
    // regressed since that commit.
    it('AC#7 — the Current pill follows the SERVER visibility and appears exactly once', () => {
        return mountPanel({role: 'owner', layerCount: 0, visibility: 'private'}).then(() => {
            expect(container.querySelectorAll('.sv-account-pill--current').length).toBe(1);
            expect(rowNamed('Private').querySelector('.sv-account-pill--current')).toExist();
            ReactDOM.unmountComponentAtNode(container);
            return mountPanel({role: 'owner', layerCount: 0, visibility: 'organization'});
        }).then(() => {
            const pills = container.querySelectorAll('.sv-account-pill--current');
            expect(pills.length).toBe(1, 'the Current pill did not MOVE — two rows claim to be current');
            expect(rowNamed('Organization').querySelector('.sv-account-pill--current')).toExist();
            expect(rowNamed('Private').querySelector('.sv-account-pill--current')).toBe(null);
        });
    });

    // AC#4 — in-flight starts when the REQUEST is dispatched, never when the
    // confirmation overlay opens. Arming on overlay-open would disable the
    // overlay's own Cancel path, i.e. trap the user in a dialog about making
    // their project public.
    it('AC#4 — opening the public-transition confirm overlay arms NOTHING', () => {
        return mountPanel({role: 'owner', layerCount: 0, visibility: 'private'}).then(() => {
            const publicRow = rowNamed('Public');
            expect(publicRow.disabled).toBe(false);
            publicRow.click();
            // The overlay is open and no PATCH has been dispatched.
            const overlay = container.querySelector('.sv-membership-confirm-overlay');
            expect(overlay).toExist('the public-transition confirm overlay did not open');
            const cancel = Array.from(overlay.querySelectorAll('button'))
                .find(b => b.textContent.trim() === 'Cancel');
            expect(cancel).toExist();
            expect(cancel.disabled).toBe(false, 'Cancel is disabled — the user is trapped in the confirm dialog');
            // And no row is greyed: nothing has been requested of the server.
            rows().forEach(r => expect(r.disabled).toBe(false, 'a row was disabled merely by OPENING the confirm overlay'));
            expect(container.querySelector('[data-testid="sv-membership-visibility-working"]')).toBe(null);
        });
    });

    it('AC#8 — the selection tracks the STORE, so no local copy can drift from it', () => {
        // The selection and the pill read this.props.visibility only, and
        // visibilityPending describes the REQUEST, never the stored value. A
        // this.state copy is how an optimistic UI starts lying about privacy —
        // here the store says 'public' while a change to 'private' is in
        // flight, and the selection must still say public.
        return mountPanel({
            role: 'owner', layerCount: 0, visibility: 'public', visibilityPending: 'private'
        }).then(() => {
            expect(rowNamed('Public').getAttribute('aria-checked')).toBe('true');
            expect(rowNamed('Private').getAttribute('aria-checked')).toBe('false');
        });
    });
});

// ─── TASK-2780 (epic 2765 W4): copy-project-link control ─────────────────────
//
// Epic AC18 / settled decision 11: ONE small control that copies
// /catalogue/#/map/<base_map_id> to the clipboard with user feedback. No richer
// share UI — no expiry, no per-recipient links, no QR.
//
// Settled decision 12 (naming, load-bearing): it is a PROJECT LINK, never a
// "share link" — "shareable" is already claimed by the tile-caching sense
// (glossary.md; Anuga/gwcTileRouting.js's isShareableTileLayer). The naming
// guard at the bottom of this block asserts that in the shipped source, not
// just in review.
//
// WHERE <base_map_id> COMES FROM. `state.anuga.projects.data` does NOT carry
// base_map — the retrieve serializer is ProjectSerializerV2 and only
// ProjectSerializerV2Full adds it (dataActions.js:164-168 and
// projectsReducer.js both say so verbatim). The reachable source is the
// TASK-2548 stamp at state.anuga.projects.mapId. A fixture is free to green
// whichever field the implementation happens to read, so the store stub above
// deliberately mirrors the LIVE shape: mapId on the slice, nothing on `data`.
describe('TASK-2780 MembershipPanel — copy project link', () => {
    let container;
    let restoreClipboard = null;

    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
    });

    afterEach(() => {
        if (restoreClipboard) {
            restoreClipboard();
            restoreClipboard = null;
        }
        ReactDOM.unmountComponentAtNode(container);
        document.body.removeChild(container);
    });

    // navigator.clipboard is a prototype getter in a secure context (karma
    // serves http://localhost, which counts), so it cannot be assigned — shadow
    // it with an own property and delete the shadow to restore.
    function stubClipboard(impl) {
        Object.defineProperty(window.navigator, 'clipboard', {
            value: impl, configurable: true, writable: true
        });
        restoreClipboard = () => { delete window.navigator.clipboard; };
    }

    // The copy path is a promise chain; a click returns before setState runs.
    const flush = () => new Promise(resolve => setTimeout(resolve, 0));

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

    const linkInput = () => container.querySelector('[data-testid="sv-membership-project-link-input"]');
    const copyBtn = () => container.querySelector('[data-testid="sv-membership-project-link-copy"]');
    const feedback = () => container.querySelector('[data-testid="sv-membership-project-link-feedback"]');

    it('AC1 — the Sharing tab carries a copy-project-link control showing /catalogue/#/map/<base_map_id>', () => {
        return mountPanel({role: 'owner', layerCount: 0, mapId: 118}, {paywallEnabled: true}).then(() => {
            expect(container.querySelector('[data-testid="sv-account-tab-sharing"]')).toExist();
            expect(copyBtn()).toExist('no copy-project-link control on the Sharing tab');
            expect(linkInput()).toExist();
            expect(linkInput().value).toBe('/catalogue/#/map/118');
        });
    });

    it('AC1 — the control also renders on the flags-off Permissions panel (which has no tab bar)', () => {
        // paywallEnabled defaults false and ships dark. render() takes a
        // separate branch there with NO tab bar, calling renderSharingContent()
        // directly — a control hung off renderTabBar() would be invisible on
        // the branch that is actually live today.
        return mountPanel({role: 'owner', layerCount: 0, mapId: 118}, {paywallEnabled: false}).then(() => {
            expect(container.querySelector('[data-testid="sv-account-tab-bar"]')).toBe(null);
            expect(copyBtn()).toExist('the copy-project-link control is missing when the paywall flag is off');
            expect(linkInput().value).toBe('/catalogue/#/map/118');
        });
    });

    it('AC1 — the link is built from the TASK-2548 mapId stamp, NOT from projects.data', () => {
        // Guards the exact trap this subtask's red-team flagged: reading
        // data.base_map_id ships "/catalogue/#/map/undefined" live while a
        // fixture that sets that field stays green.
        return mountPanel({role: 'owner', layerCount: 0, mapId: 4242}, {paywallEnabled: true}).then(() => {
            expect(linkInput().value).toBe('/catalogue/#/map/4242');
            expect(linkInput().value).toNotInclude('undefined');
        });
    });

    it('AC1 — falls back to projects.data.base_map when no SET_RESOURCE_ID stamp exists', () => {
        // warmTilesEpic.js reads base_map/base_map_full in exactly this order as
        // a documented fail-safe. Same order here, same expectation that it
        // normally misses.
        return mountPanel({role: 'owner', layerCount: 0, mapId: null, baseMapOnData: 77}, {paywallEnabled: true}).then(() => {
            expect(linkInput().value).toBe('/catalogue/#/map/77');
        });
    });

    it('AC1+AC2 — clicking Copy writes exactly the project link, then confirms the copy', () => {
        const written = [];
        stubClipboard({writeText: (t) => { written.push(t); return Promise.resolve(); }});
        return mountPanel({role: 'owner', layerCount: 0, mapId: 118}, {paywallEnabled: true}).then(() => {
            expect(feedback()).toBe(null, 'success feedback showed before anything was copied');
            copyBtn().click();
            return flush();
        }).then(() => {
            expect(written).toEqual(['/catalogue/#/map/118']);
            expect(feedback()).toExist('the copy succeeded silently — the user got no confirmation');
            expect(feedback().textContent).toInclude('hydrata.anuga.projectLinkCopied');
        });
    });

    it('AC3 — with no clipboard API the click is NOT a silent no-op: it selects the link and says so', () => {
        stubClipboard(undefined);
        return mountPanel({role: 'owner', layerCount: 0, mapId: 118}, {paywallEnabled: true}).then(() => {
            copyBtn().click();
            return flush();
        }).then(() => {
            expect(feedback()).toExist('clipboard unavailable and the control said nothing at all');
            expect(feedback().textContent).toInclude('hydrata.anuga.projectLinkCopyFailed');
            // The fallback is a real one: the link is still there to copy by hand.
            expect(linkInput().value).toBe('/catalogue/#/map/118');
            expect(linkInput().readOnly).toBe(true);
            expect(document.activeElement).toBe(linkInput(), 'the fallback did not select the link for a manual copy');
            expect(linkInput().selectionStart).toBe(0);
            expect(linkInput().selectionEnd).toBe('/catalogue/#/map/118'.length);
        });
    });

    it('AC3 — a REJECTED writeText (permission denied) reports failure rather than a false success', () => {
        stubClipboard({writeText: () => Promise.reject(new Error('NotAllowedError'))});
        return mountPanel({role: 'owner', layerCount: 0, mapId: 118}, {paywallEnabled: true}).then(() => {
            copyBtn().click();
            return flush();
        }).then(() => {
            expect(feedback()).toExist();
            expect(feedback().textContent).toInclude('hydrata.anuga.projectLinkCopyFailed');
            expect(feedback().textContent).toNotInclude('hydrata.anuga.projectLinkCopied');
        });
    });

    it('AC2 — the feedback is announced to assistive tech, not just painted', () => {
        stubClipboard({writeText: () => Promise.resolve()});
        return mountPanel({role: 'owner', layerCount: 0, mapId: 118}, {paywallEnabled: true}).then(() => {
            copyBtn().click();
            return flush();
        }).then(() => {
            expect(feedback().getAttribute('role')).toBe('status');
            expect(feedback().getAttribute('aria-live')).toBe('polite');
        });
    });

    it('AC1 — a project with no base map renders an honest absence, never /catalogue/#/map/undefined', () => {
        // Project.base_map is null=True (gn_anuga/models/project.py) and
        // views.py falls back to '/' when it is absent. The UI must not offer a
        // link that leads nowhere.
        return mountPanel({role: 'owner', layerCount: 0, mapId: null}, {paywallEnabled: true}).then(() => {
            expect(copyBtn()).toBe(null, 'a Copy button was offered for a project that has no link');
            expect(linkInput()).toBe(null);
            const absent = container.querySelector('[data-testid="sv-membership-project-link-absent"]');
            expect(absent).toExist('no project link and no explanation either');
            expect(container.querySelector('#membership-panel').textContent).toNotInclude('undefined');
        });
    });

    it('AC1 — a non-manager never reaches the control (it inherits the Sharing tab gate by placement)', () => {
        return mountPanel({role: 'viewer', layerCount: 0, mapId: 118}, {paywallEnabled: true}).then(() => {
            expect(container.querySelector('[data-testid="sv-account-tab-sharing"]')).toBe(null);
            expect(copyBtn()).toBe(null);
        });
    });

    it('AC4 — every i18n key the control uses exists and is translated in all four content locales', () => {
        const {enMessages, frMessages, esMessages, htMessages} = require('../../../../../__tests__/fixtures/translations');
        const keys = [
            'hydrata.anuga.projectLink',
            'hydrata.anuga.projectLinkCopy',
            'hydrata.anuga.projectLinkCopied',
            'hydrata.anuga.projectLinkCopyFailed',
            'hydrata.anuga.projectLinkAbsent',
            'hydrata.anuga.projectLinkVisibilityNote'
        ];
        [['en-US', enMessages], ['fr-FR', frMessages], ['es-ES', esMessages], ['ht-HT', htMessages]].forEach(([loc, msgs]) => {
            keys.forEach(key => {
                expect(msgs[key]).toExist(`Missing i18n key ${key} in ${loc}`);
                expect(typeof msgs[key]).toBe('string', `${key} in ${loc} should be a string`);
                expect(msgs[key].length).toBeGreaterThan(0, `Empty value for ${key} in ${loc}`);
            });
        });
    });

    it('AC4 — no user-visible string or identifier says "share link" (settled decision 12)', () => {
        const {enMessages, frMessages, esMessages, htMessages} = require('../../../../../__tests__/fixtures/translations');
        // English wording guard: the four strings a user actually reads.
        ['hydrata.anuga.projectLink', 'hydrata.anuga.projectLinkCopy',
            'hydrata.anuga.projectLinkCopied', 'hydrata.anuga.projectLinkCopyFailed',
            'hydrata.anuga.projectLinkAbsent'].forEach(key => {
            expect(/share\s*(able)?\s*link/i.test(enMessages[key])).toBe(
                false, `en-US ${key} says "share link": ${enMessages[key]}`);
        });
        // And the phrase is absent from every locale's whole hydrata.anuga block.
        [['fr-FR', frMessages], ['es-ES', esMessages], ['ht-HT', htMessages]].forEach(([loc, msgs]) => {
            Object.keys(msgs).filter(k => k.indexOf('hydrata.anuga.projectLink') === 0).forEach(k => {
                expect(/share\s*(able)?\s*link/i.test(msgs[k])).toBe(false, `${loc} ${k} says "share link"`);
            });
        });
        // Source-level identifier guard, run against the deployed bytes rather
        // than a re-imported AST (same raw-loader trick as the
        // window.confirm regression guard in anugaScenarioMenu-test.js).
        // Comments are stripped first: this block's own prose has to be able to
        // NAME the banned phrase in order to explain why it is banned.
        const raw = require('!!raw-loader!../membershipPanel.js');
        const source = (typeof raw === 'string' ? raw : raw && raw.default)
            .replace(/\/\*[\s\S]*?\*\//g, '')
            .replace(/^\s*\/\/.*$/gm, '');
        expect(/share[-_\s]?(able)?[-_\s]?link/i.test(source)).toBe(
            false, 'membershipPanel.js contains a share-link identifier');
        // Deliberately not toInclude(): a failure there prints the whole 40 KB
        // source into the karma log.
        expect(source.indexOf('projectLink') >= 0).toBe(
            true, 'membershipPanel.js has no projectLink identifier at all');
    });
});
