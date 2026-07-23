/*
 * Copyright 2021, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * AccountNavbarUtils — TASK-2423 (epic 2359 W4.5).
 *
 * Bridges the server-rendered navbar user-menu 'Account' item (Django
 * template land — geonode-mapstore-client/snippets/
 * brand_navbar_default_right_menu_items.html, gated server-side on
 * settings.PAYWALL_ENABLED via the paywall_enabled context processor) into
 * the MapStore2 Redux store (React/Redux land), via the documented
 * window.MapStoreAPI jsapi bridge (`configureMapStorePage`'s
 * window.MapStoreAPI, see AppUtils.js) rather than inventing a new mechanism.
 * TASK-2422 established there is no `containers: {Login: ...}` precedent for
 * this navbar (it is not MapStore's Login plugin) — window.MapStoreAPI is
 * the real, working extension point for non-React script/template code.
 *
 * Account panel spec (docs/strategy/account-panel-spec.md), entry point 2:
 * navbar item, map pages only (v1), opens the (TASK-2420-renamed)
 * MembershipPanel on its Billing tab. "Map pages only" is enforced
 * client-side by hash-matching (`#/map/...`) because catalogue.html is ONE
 * Django-rendered SPA shell for every resource type (map/dataset/dashboard/
 * geostory) — the server has no page-type signal to gate on. This mirrors
 * the existing `toggleFooterOnMap` precedent in catalogue.html's own script
 * block (same regex, same DOMContentLoaded/hashchange shape).
 *
 * The two action TYPES below are plain string-literal objects, not imported
 * action creators — every other window.MapStoreAPI.triggerAction() caller
 * (see AppUtils.js's own jsdoc examples) dispatches plain action objects
 * across the bridge, never app-internal creators, since callers on this side
 * of the bridge are not part of the app's module graph. Canonical
 * definitions: js/plugins/hydrata/Anuga/actions/uiActions.js
 * SET_MEMBERSHIP_PANEL / SET_MEMBERSHIP_PANEL_TAB (setMembershipPanel /
 * setMembershipPanelTab), the same actions the RHS toolbar button and the
 * refusal-modal + estimate-badge "View account" links dispatch (TASK-2420).
 */

const ITEM_ID = 'gn-navbar-account-item';
const WRAPPER_ID = 'gn-navbar-account-item-wrapper';
// Mirrors catalogue.html's toggleFooterOnMap regex exactly.
const MAP_HASH_RE = /^#\/map\//;

function isMapHash(win) {
    return MAP_HASH_RE.test(win.location.hash || '');
}

function toggleVisibility(win, doc) {
    const wrapper = doc.getElementById(WRAPPER_ID);
    if (!wrapper) {
        return;
    }
    wrapper.style.display = isMapHash(win) ? '' : 'none';
}

function openAccountBilling(msAPI) {
    msAPI.triggerAction({ type: 'SET_MEMBERSHIP_PANEL', visible: true });
    msAPI.triggerAction({ type: 'SET_MEMBERSHIP_PANEL_TAB', tab: 'billing' });
}

/**
 * Wire the navbar 'Account' item: map-pages-only visibility (hash-driven)
 * plus click -> Billing tab via the window.MapStoreAPI bridge. No-op if the
 * item isn't in the DOM (paywall flag off server-side, so the Django
 * template rendered nothing at all).
 *
 * @param {Window} win defaults to the global `window` (injectable for tests)
 * @param {Document} doc defaults to the global `document` (injectable for tests)
 */
export function initAccountNavbarItem(win = window, doc = document) {
    const item = doc.getElementById(ITEM_ID);
    if (!item) {
        return;
    }

    toggleVisibility(win, doc);
    win.addEventListener('hashchange', () => toggleVisibility(win, doc));

    item.addEventListener('click', (evt) => {
        evt.preventDefault();
        if (win.MapStoreAPI && win.MapStoreAPI.ready) {
            openAccountBilling(win.MapStoreAPI);
            return;
        }
        // App hasn't finished booting yet (rare: click races setupConfiguration's
        // promise chain) — wait for the same 'mapstore:ready' event documented
        // in AppUtils.js, then dispatch once.
        win.addEventListener('mapstore:ready', (readyEvt) => openAccountBilling(readyEvt.detail), { once: true });
    });
}
