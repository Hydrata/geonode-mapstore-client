/*
 * V2P-22 — publicationPanel.js per-role exact-button-set assertion.
 *
 * Pre-V2P-22 the panel was ungated: any visitor saw Edit Publication and
 * Create Figure even though the underlying API rejects them on read-only
 * roles. This test enumerates the exact button-set per role and asserts
 * EQUALITY (not just count), so a half-broken case like "shows edit but not
 * create-figure for viewer" cannot pass silently.
 *
 * Buttons under test:
 *   .sv-publication-edit-btn     — Edit Publication (canEditLayer-gated)
 *   .publication-delete-btn   — Delete Publication (canDeleteLayer-gated)
 *   .sv-publication-create-btn   — Create Figure (canEditLayer-gated)
 *   .sv-publication-figure-btn   — Open Figure (always, read action — not gated)
 *
 * The expected matrix follows the V2P-02 helper rules in selectorsAnuga.js:
 *   owner / manager / editor : full edit + delete (full set)
 *   contributor              : edit-only on rows they own (currentUserId
 *                              matches the row's resolved owner pk via
 *                              ROLE_PERMS containing change_resourcebase)
 *   viewer                   : neither edit nor delete (download-only role
 *                              and ROLE_PERMS lacks change_resourcebase)
 *   anon                     : nothing — myRole=null, no helpers pass
 */
import expect from 'expect';
import React from 'react';
import ReactDOM from 'react-dom';
import { Provider } from 'react-redux';
import { makeAnugaResourceState } from '../../__tests__/fixtures/anugaState';

function makePublication(id) {
    return {
        id,
        // Note: V2P-21 lazy-fetches perms into state.anuga.resources.publications.
        // The publication object passed in props doesn't need a perms array
        // because the V2P-02 helper resolves through _resolveResourcePerms.
        geostory: { id: 100 + id, title: `pub_${id}`, detail_url: `/g/${id}` },
        figures: [
            { id: 200 + id, title: `fig_${id}_a`, detail_url: `/f/a${id}` },
            { id: 200 + id + 1, title: `fig_${id}_b`, detail_url: `/f/b${id}` }
        ]
    };
}

function createMockStore({ role = 'viewer', publicationCount = 1 } = {}) {
    // Lay the publication rows into state.anuga.resources.publications so the
    // V2P-02 helper resolves perms by id. makeAnugaResourceState auto-builds
    // every resource type, but we want the specific publication ids and titles
    // here, so override the publications slice after the fixture call.
    const baseResources = makeAnugaResourceState(role, publicationCount);
    const fixtureRolePerms = baseResources.publications?.[0]?.perms || [];
    const publications = Array.from({ length: publicationCount }, (_, i) => ({
        ...makePublication(i + 1),
        // Inject the role-derived perms so _resolveResourcePerms picks them up.
        perms: [...fixtureRolePerms]
    }));
    const state = {
        anuga: {
            resources: {
                ...baseResources,
                publications
            },
            projects: {
                data: {
                    id: 42,
                    my_role: role === 'anon' ? null : role
                }
            }
        },
        // For 'contributor' to see the edit button, the helper falls through
        // to role-based grant only when ROLE_PERMS includes change_resourcebase
        // — which the fixture provides, so currentUserId can be anything.
        security: { user: { pk: 9999 } },
        gnsettings: { geonodeUrl: 'http://localhost', jobName: 'hydratabase' }
    };
    return {
        getState: () => state,
        subscribe: () => () => {},
        dispatch: () => {}
    };
}

describe('V2P-22 publicationPanel role-gated buttons', () => {
    let container;

    // EXACT button-set matrix per role.
    // Each role is matched against the actual rendered set; assertion is
    // .toEqual(expected.sort()), so missing OR extra buttons fail the test.
    // 'figure' is the only always-on button (read action) and appears 2x per
    // publication. 'edit'/'delete'/'create' are the role-gated ones.
    const expectedButtonSets = {
        owner: ['create', 'delete', 'edit', 'figure', 'figure'],
        manager: ['create', 'delete', 'edit', 'figure', 'figure'],
        editor: ['create', 'delete', 'edit', 'figure', 'figure'],
        contributor: ['create', 'edit', 'figure', 'figure'],  // change_resourcebase grant via ROLE_PERMS, but no delete_resourcebase
        viewer: ['figure', 'figure'],  // ROLE_PERMS = [view, download] — neither edit nor delete
        anon: ['figure', 'figure']   // myRole=null, all gates closed
    };

    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
    });

    afterEach(() => {
        ReactDOM.unmountComponentAtNode(container);
        document.body.removeChild(container);
    });

    function mountPanel(opts) {
        const { PublicationPanel } = require('../publicationPanel');
        const store = createMockStore(opts);
        return new Promise((resolve) => {
            ReactDOM.render(
                <Provider store={store}><PublicationPanel /></Provider>,
                container,
                () => resolve(container)
            );
        });
    }

    function readButtonSet() {
        const buttons = [];
        if (container.querySelector('[data-testid="sv-publication-edit-btn"]')) buttons.push('edit');
        if (container.querySelector('[data-testid="publication-delete-btn"]')) buttons.push('delete');
        if (container.querySelector('[data-testid="sv-publication-create-btn"]')) buttons.push('create');
        const figureBtns = container.querySelectorAll('[data-testid="sv-publication-figure-btn"]');
        for (let i = 0; i < figureBtns.length; i++) {
            buttons.push('figure');
        }
        return buttons.sort();
    }

    Object.entries(expectedButtonSets).forEach(([role, expectedButtons]) => {
        const expectedLabel = expectedButtons.length ? expectedButtons.join(',') : '(none)';
        it(`role=${role} renders exactly ${expectedLabel}`, () => {
            return mountPanel({ role, publicationCount: 1 }).then(() => {
                expect(readButtonSet()).toEqual(expectedButtons.slice().sort());
            });
        });
    });

    it('renders one edit-btn per publication when owner has 3 publications', () => {
        return mountPanel({ role: 'owner', publicationCount: 3 }).then(() => {
            expect(container.querySelectorAll('[data-testid="sv-publication-edit-btn"]').length).toBe(3);
            expect(container.querySelectorAll('[data-testid="sv-publication-create-btn"]').length).toBe(3);
            // 2 figures per publication × 3 publications
            expect(container.querySelectorAll('[data-testid="sv-publication-figure-btn"]').length).toBe(6);
        });
    });
});
