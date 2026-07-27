/**
 * TASK-2461 (epic 2425 W3d) — the ANCESTOR_SCOPED declarations, proved against
 * a real render tree.
 *
 * WHAT THE GUARD CANNOT ANSWER
 * ----------------------------
 * `paywall-css-coverage-guard.js` CHECK 2 decides, from the stylesheets alone,
 * that every rule covering `.compute-meter-balance*` requires an ancestor
 * (`.sv-account-billing-tab`), and then makes a human declare that in
 * ../ancestorScoped.js with a reason. What it cannot decide is the follow-up:
 * is that ancestor actually THERE when the component mounts? That needs a
 * render tree, and this is the render tree.
 *
 * It is the exact question the outage answered the expensive way. Every
 * compute-meter rule in the bundle was scoped under `.sv-account-billing-tab`;
 * BalanceStrip also mounted on the map, where no such ancestor exists; so the
 * card rendered completely unstyled for a paying customer. The declarations
 * say "that cannot happen, the only mount is inside the tab". This asserts it.
 *
 * DERIVED, NOT RESTATED
 * ---------------------
 * There is no className list in this file. Every assertion is generated from
 * the imported tables, so a SEVENTH declaration added to ANCESTOR_SCOPED with
 * no matching element in the render tree fails here, rather than being waved
 * through by a spec that only knows about the six that existed when it was
 * written. Likewise a mount added to DECLARED_MOUNTS with no renderer below
 * fails the first spec instead of silently going unproved.
 *
 * WHAT THIS FILE STILL CANNOT DO — read ../ancestorScoped.js DECLARED_MOUNTS
 * -------------------------------------------------------------------------
 * It can only see mounts it was written to render. A future refactor that
 * mounts BalanceStrip somewhere NEW is invisible here by construction, and
 * that is precisely the rot the outage was. CHECK 3 in the guard is the half
 * that catches it (it scans every non-test source under `js/`); this half
 * proves the ancestor is genuinely present at the mounts we know about. One
 * without the other is a half-measure — do not delete either believing the
 * other covers it.
 */
import expect from 'expect';
import React from 'react';
import ReactDOM from 'react-dom';
import { act } from 'react-dom/test-utils';

// Default import, not named: ../ancestorScoped is CommonJS (the Node guard
// `require()`s it), and `module.exports` arrives as the default binding.
import declarations from '../ancestorScoped';
import BillingTabPanel from '../account/components/BillingTabPanel';

const { ANCESTOR_SCOPED, DECLARED_MOUNTS } = declarations;

/**
 * One renderer per DECLARED_MOUNTS path. Keys MUST match the declared paths
 * verbatim — the first spec below fails if a declared mount has no renderer
 * here, or if a renderer outlives its declaration.
 *
 * Props are chosen so the mount emits EVERY declared className, not just the
 * unconditional ones: `.compute-meter-packs` is rendered only when
 * `availablePacks` is non-empty (ComputeMeterPanel.js), so an empty list would
 * quietly reduce this suite to five of six.
 */
const MOUNT_RENDERERS = {
    'js/plugins/hydrata/Paywall/account/components/BillingTabPanel.js': () => (
        <BillingTabPanel
            loaded
            balance="42.50"
            freeBand={{ cap: 3, usedToday: 1, edge: '0.5' }}
            availablePacks={[{ price_id: 'price_a', amount: '10', currency: 'usd' }]}
        />
    )
};

let containers = [];

/** Render every declared mount; return the containers holding them. */
function renderDeclaredMounts() {
    const rendered = [];
    for (const files of Object.values(DECLARED_MOUNTS)) {
        for (const file of files) {
            const renderer = MOUNT_RENDERERS[file];
            if (!renderer) continue; // reported by the first spec, not swallowed
            const container = document.createElement('div');
            document.body.appendChild(container);
            containers.push(container); // for teardown
            rendered.push(container);
            act(() => { ReactDOM.render(renderer(), container); });
        }
    }
    return rendered;
}

afterEach(() => {
    for (const container of containers) {
        ReactDOM.unmountComponentAtNode(container);
        if (container.parentNode) container.parentNode.removeChild(container);
    }
    containers = [];
});

describe('ancestorScoped — the declared mounts are the mounts under test', () => {
    it('every file in DECLARED_MOUNTS has a renderer in this spec, and none is stale', () => {
        const declared = [];
        for (const files of Object.values(DECLARED_MOUNTS)) declared.push(...files);
        const rendered = Object.keys(MOUNT_RENDERERS);

        // A new declared mount with no renderer would leave this suite passing
        // while proving nothing about it — the failure mode this task exists
        // to close, so it fails loudly instead.
        expect(declared.filter((f) => !rendered.includes(f))).toEqual([]);
        expect(rendered.filter((f) => !declared.includes(f))).toEqual([]);
    });
});

describe('ancestorScoped — every declared className renders under its declared ancestor', () => {
    for (const [className, declaration] of Object.entries(ANCESTOR_SCOPED)) {
        const ancestors = declaration.ancestors || [];
        it(`.${className} is emitted under .${ancestors.join(' .')}`, () => {
            // An empty ancestor list would make this spec pass while asserting
            // nothing — a per-class waiver by omission, which the task forbids.
            // (The guard's check 2 also rejects it, as drift against the
            // non-empty set it computes; belt and braces, cheaply.)
            expect(ancestors.length).toBeGreaterThan(0);

            const elements = [];
            for (const container of renderDeclaredMounts()) {
                elements.push(...container.querySelectorAll(`.${className}`));
            }

            // Declared but never emitted: the declaration is unprovable, and
            // every `reason` written about it is fiction.
            expect(elements.length).toBeGreaterThan(0);

            // EVERY emitted element, not merely one: a second mount that
            // escapes the ancestor is exactly the production defect.
            for (const el of elements) {
                for (const ancestor of ancestors) {
                    expect(el.closest(`.${ancestor}`)).toExist();
                }
            }
        });
    }
});
