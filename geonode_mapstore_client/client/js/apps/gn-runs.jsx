/*
 * Copyright 2026, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * TASK-1964 (epic 1952 W5.1) — entry bundle for the staff /runs dashboard.
 *
 * `mapstore.apps=["js/apps"]` (client/package.json) auto-registers every
 * file under js/apps/ as its own webpack entry — this file compiles to
 * mapstore/dist/js/gn-runs.js, loaded by
 * templates/geonode-mapstore-client/pages/runs.html.
 *
 * Deliberately NOT the full MapStore StandardApp scaffold (contrast
 * gn-components.js): the page is a plain staff-only data dashboard with no
 * map, no plugin config, no Redux store dependency — a bare React root is
 * lower-risk and avoids paying for the full app bootstrap (getEndpoints /
 * getConfiguration / plugin registry) on a page that doesn't use any of it.
 *
 * Client-side staff gate: fetch the logged-in user via the same
 * getAccountInfo() the main app uses, and hand it to AnugaRunsDashboard,
 * which denies render for a resolved non-staff user. This is defense-in-
 * depth only — the Django view is already staff_member_required, and the
 * ledger API is already IsAdminUser (see AnugaRunsDashboard.jsx header).
 */
import React from 'react';
import ReactDOM from 'react-dom';
import { getAccountInfo } from '@js/api/geonode/v2';
import AnugaRunsDashboard from '@js/plugins/hydrata/Anuga/components/AnugaRunsDashboard';

const MOUNT_ID = 'anuga-runs-dashboard-root';

const mount = (user) => {
    const target = document.getElementById(MOUNT_ID);
    if (!target) {
        return;
    }
    ReactDOM.render(<AnugaRunsDashboard user={user} />, target);
};

document.addEventListener('DOMContentLoaded', function() {
    getAccountInfo()
        .then((user) => mount(user))
        .catch(() => mount(null));
});
