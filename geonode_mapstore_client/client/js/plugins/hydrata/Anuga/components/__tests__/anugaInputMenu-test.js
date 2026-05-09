/*
 * V2P-22 — anugaInputMenu.js per-role exact-button-set assertion.
 *
 * The InputMenu has section-level "+" / "✓" create buttons (one per resource
 * type) that are gated on `canEditAnugaMap` from the V2P-02 selector chain.
 * Per-row CRUD glyphs delegate to <MenuRow> (= simpleViewMenuRow.js, already
 * V2P-02 wired). This file pins the section-level matrix.
 *
 * Roles:
 *   owner / manager / editor : full create-set across all resource types
 *   contributor              : NO create buttons (canEditAnugaMap excludes
 *                              contributor by design — contributors edit
 *                              existing resources they own, but resource
 *                              creation requires editor+ in selectorsAnuga.js
 *                              line 21). This is the documented Anuga gate.
 *   viewer                   : no create buttons
 *   anon                     : no create buttons (myRole=null)
 *
 * Notes:
 *   - Boundary + Inflow create buttons render unconditionally on top-level
 *     when projection is set; advanced sections (mesh-regions, friction,
 *     structures, networks) only render when showAdvanced is true. The test
 *     asserts the FIRST level (boundaries, inflows) since the advanced
 *     accordion default-collapsed; expanding it would just multiply the
 *     same gate.
 *   - Each create button uses class .glyph-active per InputSection.js.
 *     Combined with the wrapper class .menu-rows-container > .anuga-section,
 *     we count `.glyph-active` glyphs on the rendered tree as a proxy for
 *     "create buttons visible".
 */
import expect from 'expect';
import React from 'react';
import ReactDOM from 'react-dom';
import { Provider } from 'react-redux';
import { makeAnugaResourceState } from '../../__tests__/fixtures/anugaState';

function createMockStore({ role = 'viewer', layerCount = 0 } = {}) {
    const resources = makeAnugaResourceState(role, layerCount);
    const state = {
        anuga: {
            resources,
            projects: {
                data: {
                    id: 42,
                    my_role: role === 'anon' ? null : role,
                    projection: 'EPSG:32756'  // truthy → top-level Boundary/Inflow sections render
                }
            },
            ui: { isCreatingAnugaLayer: false }
        },
        layers: { flat: [], groups: [] },
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

describe('V2P-22 anugaInputMenu role-gated create buttons', () => {
    let container;

    // EXACT button set per role (top-level sections only, advanced collapsed).
    // Buttons present at the section header are:
    //   - terrain upload glyph (.glyphicon-upload, ALWAYS present — no role gate)
    //   - boundaries "+" / "✓" create button (canEditAnugaMap gate)
    //   - inflows "+" / "✓" create button (canEditAnugaMap gate)
    //   - "showAdvanced" cog glyph (always present — no role gate)
    //
    // We assert the SET of role-gated create-buttons. Always-present glyphs
    // are in every render and thus orthogonal to the gate.
    const expectedCreateButtons = {
        // canEditAnugaMap === [owner, manager, editor]
        owner:       ['boundary-create', 'inflow-create'],
        manager:     ['boundary-create', 'inflow-create'],
        editor:      ['boundary-create', 'inflow-create'],
        contributor: [],  // canEditAnugaMap excludes contributor (writes only to own resources via Scenario flow)
        viewer:      [],
        anon:        []
    };

    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
    });

    afterEach(() => {
        ReactDOM.unmountComponentAtNode(container);
        document.body.removeChild(container);
    });

    function mountMenu(opts) {
        const { AnugaInputMenu } = require('../anugaInputMenu');
        const store = createMockStore(opts);
        return new Promise((resolve) => {
            ReactDOM.render(
                <Provider store={store}><AnugaInputMenu /></Provider>,
                container,
                () => resolve(container)
            );
        });
    }

    function readCreateButtonSet() {
        // Section "+" buttons live in the InputSection wrapper. They're
        // identifiable by their parent section's text content. We scan for
        // .glyphicon-plus (the create state) and .glyphicon-ok (the save
        // state mid-input). Both share class .glyph-active.
        const buttons = [];
        // The boundary-input id and inflow-input id mark the InputSection
        // for that resource. The create button is a sibling .glyphicon-plus
        // when collapsed and not in input-state; locate by adjacency via the
        // parent .anuga-section that contains the boundary/inflow header.
        const sections = container.querySelectorAll('.anuga-section');
        sections.forEach((section) => {
            const text = section.textContent || '';
            const hasCreate = !!section.querySelector('.glyph-active.glyphicon-plus');
            if (!hasCreate) return;
            // hydrata.anuga.boundaries → "boundaries" via DOM attribute, but
            // i18n tag is rendered raw at test-time. Inspect via the
            // section's first .menu-row-text element for a stable token.
            if (/boundary|boundaries/i.test(text)) buttons.push('boundary-create');
            else if (/inflow/i.test(text)) buttons.push('inflow-create');
        });
        return buttons.sort();
    }

    Object.entries(expectedCreateButtons).forEach(([role, expectedButtons]) => {
        const expectedLabel = expectedButtons.length ? expectedButtons.join(',') : '(none)';
        it(`role=${role} renders exactly create buttons: ${expectedLabel}`, () => {
            return mountMenu({ role, layerCount: 0 }).then(() => {
                expect(readCreateButtonSet()).toEqual(expectedButtons.slice().sort());
            });
        });
    });

    it('terrain upload glyph always renders independent of role (panel-level upload)', () => {
        return mountMenu({ role: 'viewer', layerCount: 0 }).then(() => {
            // The terrain section's upload glyph is ALWAYS present, by
            // design (read-only viewers can navigate to the uploader form;
            // the form itself enforces the perm via canEditMap on submit).
            // Re-read this assertion every change to InputSection's gate.
            const upload = container.querySelector('.glyphicon-upload');
            expect(upload).toExist();
        });
    });
});
