/*
 * Copyright 2026, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * TASK-1964 (epic 1952 W5.1) — entry bundle for the tester /runs dashboard.
 *
 * `mapstore.apps=["js/apps"]` (client/package.json) auto-registers every
 * file under js/apps/ as its own webpack entry — this file compiles to
 * mapstore/dist/js/gn-runs.js, loaded by
 * templates/geonode-mapstore-client/pages/runs.html.
 *
 * Deliberately NOT the full MapStore StandardApp scaffold (contrast
 * gn-components.js): the page is a plain data dashboard with no map, no
 * plugin config, no Redux store dependency — a bare React root is
 * lower-risk and avoids paying for the full app bootstrap (getEndpoints /
 * getConfiguration / plugin registry) on a page that doesn't use any of it.
 * Because there is no store, there is no state.anuga.ui to read the
 * capability from (unlike the connected anugaScenarioMenu.js) — this entry
 * fetches it directly.
 *
 * TASK-2644 (epic 2635 W1) — client-side gate moved off is_staff onto the
 * gn_anuga tester capability. Fetch the logged-in user via the same
 * getAccountInfo() the main app uses (kept for identity display), AND the
 * capability boolean via getAnugaConfig()'s can_select_compute_target
 * field, and hand both to AnugaRunsDashboard, which denies render for a
 * resolved user without the capability. This is defense-in-depth only —
 * the Django view is already tester-gated, and the ledger API is already
 * IsTester (see AnugaRunsDashboard.jsx header).
 */
import React from 'react';
import ReactDOM from 'react-dom';
import { getAccountInfo } from '@js/api/geonode/v2';
import { getAnugaConfig } from '@js/plugins/hydrata/Anuga/api/anugaApi';
import AnugaRunsDashboard from '@js/plugins/hydrata/Anuga/components/AnugaRunsDashboard';

const MOUNT_ID = 'anuga-runs-dashboard-root';

const mount = (user, canSelectComputeTarget) => {
    const target = document.getElementById(MOUNT_ID);
    if (!target) {
        return;
    }
    ReactDOM.render(
        <AnugaRunsDashboard user={user} canSelectComputeTarget={canSelectComputeTarget} />,
        target
    );
};

document.addEventListener('DOMContentLoaded', function() {
    Promise.all([
        getAccountInfo().catch(() => null),
        // getAnugaConfig() already catches internally to a safe fallback
        // shape (anugaApi.js) — can_select_compute_target is simply absent
        // there, which the !! below (fail-closed) treats as false.
        getAnugaConfig().catch(() => ({}))
    ]).then(([user, config]) => {
        mount(user, !!(config && config.can_select_compute_target));
    });
});
