/*
 * Copyright 2026, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

/*
 * TASK-2751 (W6.3, epic 2706) — the bar's LAYOUT contract.
 *
 * TASK-2744 made all sixteen controls correct; it left them all on one
 * wrapping row. This file pins the re-configuration:
 *
 *   card
 *     ├─ drawer      (order:-1 — grows UPWARD, always in the DOM, `hidden`
 *     │               when closed so the card's bottom edge never moves)
 *     └─ transport   (fixed-height row — play, scrubber, readout, speed,
 *                     status, THEN the primary-path group, then the tools)
 *
 * Widths and wrapping are CSS and are proven LIVE on map 1461, not here —
 * karma renders the component with no stylesheet, so every
 * getBoundingClientRect in this environment would be measuring nothing.
 * What IS provable here is the structural invariant underneath the CSS:
 * which controls live in which container, and in what order.
 */
import expect from 'expect';
import React from 'react';
import ReactDOM from 'react-dom';
import TestUtils from 'react-dom/test-utils';

import { AnugaPlaybackControlBarComponent } from '../AnugaPlaybackControlBar';
import { PLAYBACK_STATUS, createInitialPlaybackState } from '../../playbackController';
// TASK-2986 (W1.3, epic 2981) — AC5 asserts on the i18n VALUES, so the real
// locale files are imported rather than trusting the English fallbacks the
// component passes to this.tr(). These four are the ONLY files of the
// seventeen under hydrata-translations/ that carry the hydrata.playback.*
// namespace; gn-translations/ and ms-translations/ are upstream.
import enUS from '../../../../../../../../static/mapstore/hydrata-translations/data.en-US.json';
import esES from '../../../../../../../../static/mapstore/hydrata-translations/data.es-ES.json';
import frFR from '../../../../../../../../static/mapstore/hydrata-translations/data.fr-FR.json';
import htHT from '../../../../../../../../static/mapstore/hydrata-translations/data.ht-HT.json';

/* Controls that BELONG IN THE DRAWER after this card — every conditional
   slider group is in here, because those are what made the bar reflow. */
const DRAWER_CONTROLS = [
    'anuga-playback-background-opacity',
    'anuga-playback-opacity',
    'anuga-playback-wireframe-toggle',
    'anuga-playback-ceiling-table',
    'anuga-playback-ceiling-depth',
    'anuga-playback-flowviz-toggle',
    'anuga-playback-particles-toggle'
];

/* Controls that must stay on the primary path. */
const TRANSPORT_CONTROLS = [
    'anuga-playback-playpause',
    'anuga-playback-scrubber',
    'anuga-playback-readout',
    'anuga-playback-speed',
    'anuga-playback-quantity',
    'anuga-playback-max-envelope',
    'anuga-playback-display-toggle',
    'anuga-playback-identify-toggle',
    'anuga-playback-legend-toggle',
    'anuga-playback-unload'
];

describe('Playback bar layout — TASK-2751', () => {
    let container;
    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
    });
    afterEach(() => {
        ReactDOM.unmountComponentAtNode(container);
        document.body.removeChild(container);
    });

    function readyState(over) {
        return {
            ...createInitialPlaybackState(),
            status: PLAYBACK_STATUS.READY,
            nTime: 31,
            currentTimestep: 0,
            ...over
        };
    }
    function render(props) {
        ReactDOM.render(<AnugaPlaybackControlBarComponent {...props} />, container);
    }
    const q = (sel, root) => (root || container).querySelector(`[data-testid="${sel}"]`);

    describe('AC2 — the drawer', () => {
        it('the card holds a transport row and a drawer', () => {
            render({ playback: readyState() });
            const card = q('anuga-playback-bar');
            expect(card).toBeTruthy();
            expect(q('anuga-playback-transport', card)).toBeTruthy();
            expect(q('anuga-playback-drawer', card)).toBeTruthy();
        });

        it('the drawer is CLOSED on first render and the disclosure says so', () => {
            render({ playback: readyState() });
            expect(q('anuga-playback-drawer').hidden).toBe(true);
            expect(q('anuga-playback-display-toggle').getAttribute('aria-expanded')).toBe('false');
        });

        it('the disclosure opens and closes it, and keeps aria-expanded honest', () => {
            render({ playback: readyState() });
            TestUtils.Simulate.click(q('anuga-playback-display-toggle'));
            expect(q('anuga-playback-drawer').hidden).toBe(false);
            expect(q('anuga-playback-display-toggle').getAttribute('aria-expanded')).toBe('true');

            TestUtils.Simulate.click(q('anuga-playback-display-toggle'));
            expect(q('anuga-playback-drawer').hidden).toBe(true);
            expect(q('anuga-playback-display-toggle').getAttribute('aria-expanded')).toBe('false');
        });

        it('the drawer renders BEFORE the transport row in the DOM, so it grows upward', () => {
            render({ playback: readyState() });
            const kids = Array.from(q('anuga-playback-bar').children);
            expect(kids.indexOf(q('anuga-playback-drawer')))
                .toBeLessThan(kids.indexOf(q('anuga-playback-transport')));
        });

        it('every render knob is inside the drawer and NONE of them is on the transport row', () => {
            render({ playback: readyState() });
            const drawer = q('anuga-playback-drawer');
            const transport = q('anuga-playback-transport');
            DRAWER_CONTROLS.forEach((testid) => {
                expect(q(testid, drawer)).toExist(`${testid} should be in the drawer`);
                expect(q(testid, transport)).toBe(null, `${testid} must NOT be on the transport row`);
            });
        });

        it('every primary-path control is on the transport row and none is in the drawer', () => {
            render({ playback: readyState() });
            const drawer = q('anuga-playback-drawer');
            const transport = q('anuga-playback-transport');
            TRANSPORT_CONTROLS.forEach((testid) => {
                expect(q(testid, transport)).toExist(`${testid} should be on the transport row`);
                expect(q(testid, drawer)).toBe(null, `${testid} must NOT be in the drawer`);
            });
        });

        it('Escape closes the drawer', () => {
            render({ playback: readyState() });
            TestUtils.Simulate.click(q('anuga-playback-display-toggle'));
            expect(q('anuga-playback-drawer').hidden).toBe(false);
            TestUtils.Simulate.keyDown(q('anuga-playback-bar'), { key: 'Escape' });
            expect(q('anuga-playback-drawer').hidden).toBe(true);
        });
    });

    describe('AC1/AC7 — nothing that mounts may re-order the transport row', () => {
        /* The width guarantee is CSS and is measured live. The guarantee this
           file can make is that the row's OWN child list is invariant: in
           TASK-2744 the bar re-ordered itself because conditional groups
           mounted between controls. Now the only conditional content lives
           inside fixed slots. */
        function transportChildTestids() {
            return Array.from(q('anuga-playback-transport').children)
                .map((el) => el.getAttribute('data-testid'));
        }

        it('is identical whether buffering or ready', () => {
            render({ playback: readyState() });
            const atRest = transportChildTestids();
            render({ playback: readyState({ status: PLAYBACK_STATUS.BUFFERING }) });
            expect(transportChildTestids()).toEqual(atRest);
        });

        it('is identical with both overlays on', () => {
            render({ playback: readyState() });
            const atRest = transportChildTestids();
            render({ playback: readyState({ flowVizEnabled: true, particlesEnabled: true }) });
            expect(transportChildTestids()).toEqual(atRest);
        });

        it('is identical with the drawer open', () => {
            render({ playback: readyState() });
            const atRest = transportChildTestids();
            TestUtils.Simulate.click(q('anuga-playback-display-toggle'));
            expect(transportChildTestids()).toEqual(atRest);
        });

        it('is identical while a ceiling is being edited in the drawer', () => {
            render({ playback: readyState() });
            const atRest = transportChildTestids();
            TestUtils.Simulate.click(q('anuga-playback-display-toggle'));
            TestUtils.Simulate.click(q('anuga-playback-ceiling-depth'));
            expect(q('anuga-playback-ceiling-depth-input')).toBeTruthy();
            expect(transportChildTestids()).toEqual(atRest);
        });

        // TASK-3076 AC8 — the floor is edited in the same row; the transport
        // row's child list is as invariant to it as it is to the ceiling.
        it('is identical while a floor is being edited in the drawer', () => {
            render({ playback: readyState() });
            const atRest = transportChildTestids();
            TestUtils.Simulate.click(q('anuga-playback-display-toggle'));
            TestUtils.Simulate.click(q('anuga-playback-ceiling-depth-floor'));
            expect(q('anuga-playback-ceiling-depth-floor-input')).toBeTruthy();
            expect(transportChildTestids()).toEqual(atRest);
            // and with a floor STORED (active or inert) the row is still the same
            render({ playback: readyState({ colorFloorOverride: { depth: 0.1 } }) });
            expect(transportChildTestids()).toEqual(atRest);
            render({ playback: readyState({ colorMaxOverride: { depth: 1.5 }, colorFloorOverride: { depth: 2 } }) });
            expect(transportChildTestids()).toEqual(atRest);
        });
    });

    describe('AC3 — the result-quantity picker is on the primary path', () => {
        it('sits inside the primary group, after the speed picker and before the divider', () => {
            render({ playback: readyState() });
            const kids = Array.from(q('anuga-playback-transport').children);
            const at = (testid) => kids.findIndex((el) => el.contains(q(testid)));
            expect(at('anuga-playback-quantity')).toBeGreaterThan(at('anuga-playback-speed'));
            expect(at('anuga-playback-quantity')).toBeLessThan(at('anuga-playback-divider'));
            expect(q('anuga-playback-primary-group')).toBeTruthy();
        });

        /* A <select> is always as wide as its WIDEST option, so one verbose
           entry taxes the control permanently even while a short one is
           selected. `Depth-integrated velocity (dIV)` alone held the picker at
           190px. The short form is what the row shows; the full name is on the
           option's tooltip, and unchanged in the drawer and the legend. */
        it('shows short option text, with the full name on each option title', () => {
            render({ playback: readyState({ hasDt: true }) });
            const opts = [...q('anuga-playback-quantity').options];
            const div = opts.find((o) => o.value === 'div');
            expect(div.textContent).toBe('dIV');
            expect(div.title).toBe('Depth-integrated velocity (dIV)');

            const hazard = opts.find((o) => o.value === 'hazard');
            expect(hazard.textContent).toBe('Hazard');
            expect(hazard.title).toBe('Flood hazard (H1–H6)');
        });

        it('every option is short enough to stop setting the control width', () => {
            render({ playback: readyState({ hasDt: true }) });
            [...q('anuga-playback-quantity').options].forEach((o) => {
                expect(o.textContent.length).toBeLessThan(13, `too long: ${o.textContent}`);
                expect(o.title.length > 0).toBe(true);
            });
        });

        /* The full names must remain reachable, or this is a deletion rather
           than a relocation. */
        it('the drawer still carries the FULL name for every quantity', () => {
            render({ playback: readyState({ hasDt: true }) });
            TestUtils.Simulate.click(q('anuga-playback-display-toggle'));
            const table = q('anuga-playback-ceiling-table');
            expect(table.textContent).toContain('Depth-integrated velocity (dIV)');
            expect(table.textContent).toContain('Flood hazard (H1–H6)');
        });

        it('is named "Result quantity", not "result set" and not the state key', () => {
            render({ playback: readyState() });
            const name = q('anuga-playback-quantity').getAttribute('aria-label');
            expect(name).toBe('Result quantity');
        });

        it('changing it calls onSetQuantity', () => {
            const onSetQuantity = expect.createSpy();
            render({ playback: readyState(), onSetQuantity });
            TestUtils.Simulate.change(q('anuga-playback-quantity'), { target: { value: 'speed' } });
            expect(onSetQuantity.calls.length).toBe(1);
            expect(onSetQuantity.calls[0].arguments[0]).toBe('speed');
        });
    });

    describe('AC4 — the colour scale lives in the drawer, one row per result quantity', () => {
        it('is a single-column list of EVERY available quantity', () => {
            render({ playback: readyState({ hasDt: true }) });
            const table = q('anuga-playback-ceiling-table');
            expect(table).toBeTruthy();
            expect(table.children.length).toBe(8);
            render({ playback: readyState({ hasDt: false }) });
            expect(q('anuga-playback-ceiling-table').children.length).toBe(7);
        });

        it('every row carries the ramp swatch that quantity is actually drawn in', () => {
            // hasDt, or Courant is correctly filtered out and has no row to check.
            render({ playback: readyState({ hasDt: true }) });
            ['depth', 'speed', 'stage', 'div', 'hazard', 'froude', 'shear', 'courant'].forEach((id) => {
                const sw = q(`anuga-playback-ceiling-swatch-${id}`);
                expect(sw).toExist(`${id} needs a swatch`);
                expect(sw.style.background).toInclude('linear-gradient');
            });
            // ...and they are not all the same gradient.
            const depth = q('anuga-playback-ceiling-swatch-depth').style.background;
            const shear = q('anuga-playback-ceiling-swatch-shear').style.background;
            expect(depth).toNotBe(shear);
        });

        it('renders the EFFECTIVE ceiling per quantity', () => {
            render({ playback: readyState({ colorMaxOverride: { depth: 1.5 } }) });
            expect(q('anuga-playback-ceiling-depth').textContent).toInclude('1.5');
        });

        it('commits against the row it was edited on, NOT the displayed quantity', () => {
            const onSetColorMax = expect.createSpy();
            render({ playback: readyState({ quantity: 'depth' }), onSetColorMax });
            TestUtils.Simulate.click(q('anuga-playback-ceiling-shear'));
            TestUtils.Simulate.change(q('anuga-playback-ceiling-shear-input'), { target: { value: '50' } });
            TestUtils.Simulate.keyDown(q('anuga-playback-ceiling-shear-input'), { key: 'Enter' });
            expect(onSetColorMax.calls.length).toBe(1);
            expect(onSetColorMax.calls[0].arguments[0]).toBe('shear');
            expect(onSetColorMax.calls[0].arguments[1]).toBe(50);
        });

        it('hazard has no editable ceiling — H1..H6 IS the scale', () => {
            render({ playback: readyState() });
            expect(q('anuga-playback-ceiling-hazard')).toBe(null);
            expect(q('anuga-playback-ceiling-row-hazard')).toExist();
        });

        it('a row switches the displayed quantity without touching any ceiling', () => {
            const onSetQuantity = expect.createSpy();
            const onSetColorMax = expect.createSpy();
            render({ playback: readyState(), onSetQuantity, onSetColorMax });
            TestUtils.Simulate.click(q('anuga-playback-ceiling-show-froude'));
            expect(onSetQuantity.calls[0].arguments[0]).toBe('froude');
            expect(onSetColorMax.calls.length).toBe(0);
        });

        it('never shows the word "max" — that word belongs to the envelope (TASK-2752)', () => {
            render({ playback: readyState({ colorMaxOverride: { depth: 1.5 } }) });
            expect(q('anuga-playback-ceiling-table').textContent.toLowerCase()).toNotInclude('max');
        });
    });

    describe('AC3b — the primary group is JUST the picker and the reserved Max slot', () => {
        it('carries no ceiling control and no text label of its own', () => {
            render({ playback: readyState() });
            const group = q('anuga-playback-primary-group');
            expect(q('anuga-playback-ceiling', group)).toBe(null, 'the ceiling belongs in the drawer');
            expect(group.querySelector('.sv-playback-primary-label')).toBe(null);
            expect(group.querySelector('select')).toExist();
        });
    });

    describe('AC6 — the Max slot is reserved and inert until TASK-2752', () => {
        it('is present, disabled, and announces that it is disabled', () => {
            render({ playback: readyState() });
            const max = q('anuga-playback-max-envelope');
            expect(max).toBeTruthy();
            expect(max.disabled).toBe(true);
            expect(max.getAttribute('aria-disabled')).toBe('true');
        });

        it('explains itself rather than sitting there dead', () => {
            render({ playback: readyState() });
            const title = q('anuga-playback-max-envelope').getAttribute('title') || '';
            expect(title.length > 0).toBe(true);
        });

        it('dispatches nothing at all when clicked', () => {
            const spies = {
                onSetQuantity: expect.createSpy(),
                onSetColorMax: expect.createSpy(),
                onSeek: expect.createSpy(),
                onPlay: expect.createSpy()
            };
            render({ playback: readyState(), ...spies });
            TestUtils.Simulate.click(q('anuga-playback-max-envelope'));
            Object.keys(spies).forEach((k) => expect(spies[k].calls.length).toBe(0));
        });
    });

    /*
     * TASK-2788 (W7, epic 2706) — the two opacity sliders.
     *
     * They are easy to confuse and do different things: "Background opacity"
     * fades ONLY the dry-ground sheet (a shader uniform), "Layer opacity"
     * fades the whole canvas including the water (CSS opacity). Order and
     * range are the affordances that keep them apart, so both are pinned.
     */
    describe('background vs layer opacity — TASK-2788', () => {
        it('puts the background slider ABOVE the layer slider', () => {
            render({ playback: readyState() });
            const bg = q('anuga-playback-background-opacity');
            const layer = q('anuga-playback-opacity');
            expect(bg).toBeTruthy();
            expect(layer).toBeTruthy();
            // DOCUMENT_POSITION_FOLLOWING === 4: layer comes after bg
            expect(bg.compareDocumentPosition(layer) & 4).toBe(4);
        });

        it('runs BOTH sliders 0..100%, so neither lies about its own scale', () => {
            render({ playback: readyState() });
            ['anuga-playback-background-opacity', 'anuga-playback-opacity'].forEach((testid) => {
                const el = q(testid);
                expect(el.getAttribute('min')).toBe('0', `${testid} must start at 0%`);
                expect(el.getAttribute('max')).toBe('1', `${testid} must end at 100%`);
            });
        });

        it('starts transparent — a results layer shows results, not a grey sheet', () => {
            render({ playback: readyState() });
            expect(q('anuga-playback-background-opacity').value).toBe('0');
            expect(q('anuga-playback-background-opacity-value').textContent).toBe('0%');
        });

        it('commits to its OWN handler, never the layer-opacity one', () => {
            const onSetBackgroundOpacity = expect.createSpy();
            const onSetOpacity = expect.createSpy();
            render({ playback: readyState(), onSetBackgroundOpacity, onSetOpacity });
            TestUtils.Simulate.change(q('anuga-playback-background-opacity'), { target: { value: '0.4' } });
            expect(onSetBackgroundOpacity.calls.length).toBe(1);
            expect(onSetBackgroundOpacity.calls[0].arguments[0]).toBe(0.4);
            expect(onSetOpacity.calls.length).toBe(0, 'the two sliders must not be crosswired');
        });
    });
});

/*
 * ===========================================================================
 * TASK-2986 (W1.3, epic 2981) — THE FALLBACK MESSAGE.
 *
 * "Playback needs a larger device" on its own is the thing this re-aim exists
 * to stop shipping. A stranger arriving at a public flood map on a phone does
 * not want a message, they want the flood — so the message names THREE things
 * and the map gets the maximum-depth envelope.
 *
 * Asserted on RENDERED TEXT and on the i18n VALUES, never on a data-testid:
 * a testid proves an element exists, not that it says anything.
 * ===========================================================================
 */
describe('Playback fallback message — TASK-2986', () => {
    let container;
    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
    });
    afterEach(() => {
        ReactDOM.unmountComponentAtNode(container);
        document.body.removeChild(container);
    });

    function fallbackState(over) {
        return {
            ...createInitialPlaybackState(),
            status: PLAYBACK_STATUS.FALLBACK,
            runId: 77,
            layerId: 'layer-77',
            nNode: 3393075,
            nFace: 6786150,
            budgetBytes: 399 * 1024 * 1024,
            budgetSource: 'small-device',
            fallbackReason: 'floor-window-exceeds-budget',
            floorWindowPlanPeakBytes: 420741300,
            fallbackLayerShown: 'added',
            ...over
        };
    }
    function renderBar(playback) {
        ReactDOM.render(<AnugaPlaybackControlBarComponent playback={playback} onReset={() => {}} />, container);
        return container.textContent;
    }
    const q = (sel) => container.querySelector(`[data-testid="${sel}"]`);

    it('AC5 — names the MESH SIZE, THIS DEVICE\'S BUDGET with its SOURCE, and WHAT IS SHOWN INSTEAD', () => {
        const text = renderBar(fallbackState());
        // 1. the mesh, in nodes AND triangles — the substituted counts, not the
        //    placeholder tokens.
        expect(text).toContain('3,393,075');
        expect(text).toContain('6,786,150');
        expect(text).toNotContain('{nodes}');
        expect(text).toNotContain('{triangles}');
        // 2. THIS DEVICE'S budget in MiB, together with its source.
        expect(text).toContain('399 MiB');
        expect(text).toNotContain('{budget}');
        expect(text).toNotContain('{source}');
        expect(text.toLowerCase()).toContain('memory');
        // 3. WHAT IS SHOWN INSTEAD.
        expect(text.toLowerCase()).toContain('maximum depth envelope');
    });

    it('AC5 — the NO-ENVELOPE case says something DIFFERENT, and both disable Play', () => {
        const withEnvelope = renderBar(fallbackState({ fallbackLayerShown: 'added' }));
        expect(q('anuga-playback-playpause').disabled).toBe(true);
        // Unload stays enabled — the run has to be dismissible.
        expect(q('anuga-playback-unload').disabled).toBe(false);
        const without = renderBar(fallbackState({ fallbackLayerShown: 'none' }));
        expect(without).toNotBe(withEnvelope);
        expect(without.toLowerCase()).toContain('no maximum depth envelope');
        expect(q('anuga-playback-playpause').disabled).toBe(true);
        expect(q('anuga-playback-unload').disabled).toBe(false);
        // 'existing' reads the same as 'added' — both put a layer on the map.
        expect(renderBar(fallbackState({ fallbackLayerShown: 'existing' }))).toBe(withEnvelope);
    });

    it('AC5 — a DISTINCT, NON-EMPTY source label for ALL FIVE sources', () => {
        // THE ENUMERATION IS FIVE, NOT FOUR. 'default', 'heap+device' and
        // 'partial' all ship from resolvePlaybackHeapBudget TODAY; TASK-2984
        // adds 'small-device' and 'phone-class'.
        //
        // 'partial' is the one an earlier draft omitted and the one that
        // matters most here: it is what EVERY browser exposing only ONE of the
        // two budget offers gets — every non-Chromium browser (no
        // performance.memory) and much of the phone class this fallback exists
        // to serve. An unhandled 'partial' blanks the source for exactly those
        // users.
        const sources = ['default', 'heap+device', 'partial', 'small-device', 'phone-class'];
        const rendered = sources.map((source) => renderBar(fallbackState({ budgetSource: source })));
        // The unhandled path, as the negative control: this is what a source
        // the map does NOT cover renders as, and no known source may match it.
        const unhandled = renderBar(fallbackState({ budgetSource: 'something-new' }));
        expect(unhandled).toContain('unrecognised');
        rendered.forEach((text, i) => {
            expect(`${sources[i]} nonEmpty=${text.length > 0}`).toBe(`${sources[i]} nonEmpty=true`);
            // NOT the unhandled fallback — that is the shape a missing entry
            // takes, and 'partial' took it in an earlier draft of this map.
            expect(`${sources[i]} handled=${text.indexOf('unrecognised') === -1}`)
                .toBe(`${sources[i]} handled=true`);
        });
        // and every one of the five is DISTINCT from every other
        expect(new Set(rendered).size).toBe(5);
    });

    it('AC5 — every key resolves in ALL FOUR locale files that carry the playback namespace', () => {
        // Asserted on the i18n VALUES, not on the English fallbacks the
        // component passes to this.tr(). Only these four of the seventeen
        // files under hydrata-translations/ carry hydrata.playback.*; the
        // sibling gn-translations/ and ms-translations/ are upstream.
        const LOCALES = { 'en-US': enUS, 'es-ES': esES, 'fr-FR': frFR, 'ht-HT': htHT };
        // Each entry is a key PATH under hydrata.playback — one segment for a
        // flat key, two for a grouped one.
        const REQUIRED = [
            ['status', 'fallback'],
            ['fallback', 'mesh'], ['fallback', 'budget'],
            ['fallback', 'envelopeShown'], ['fallback', 'noEnvelope'],
            ['budgetSource', 'default'], ['budgetSource', 'heapDevice'],
            ['budgetSource', 'partial'], ['budgetSource', 'smallDevice'],
            ['budgetSource', 'phoneClass'], ['budgetSource', 'unknown'],
            // TASK-3076 — the colour-scale floor and the legend's hidden row.
            ['floor'], ['floorTooltip'], ['floorReset'], ['floorInert'],
            ['legendBelowFloorHidden']
        ];
        Object.keys(LOCALES).forEach((locale) => {
            const messages = LOCALES[locale].messages || LOCALES[locale];
            const playback = messages.hydrata.playback;
            REQUIRED.forEach((path) => {
                const value = path.reduce((node, key) => (node ? node[key] : undefined), playback);
                const name = path.join('.');
                expect(`${locale}.${name}=${typeof value}`).toBe(`${locale}.${name}=string`);
                expect(`${locale}.${name} nonEmpty=${!!(value && value.trim())}`)
                    .toBe(`${locale}.${name} nonEmpty=true`);
            });
            // TASK-3076 — the floor is never called "min"/"minimum" (nor "max",
            // the temporal envelope's word) in ANY locale: fr 'plancher', es
            // 'piso', ht 'planche', never 'minimum'/'mínimo'.
            ['floor', 'floorTooltip', 'floorReset', 'floorInert', 'legendBelowFloorHidden'].forEach((key) => {
                const lower = String(playback[key]).toLowerCase();
                expect(`${locale}.${key} says min: ${lower.indexOf('min') !== -1}`).toBe(`${locale}.${key} says min: false`);
                expect(`${locale}.${key} says max: ${lower.indexOf('max') !== -1}`).toBe(`${locale}.${key} says max: false`);
            });
            expect(`${locale} legendBelowFloorHidden has {floor}=${playback.legendBelowFloorHidden.indexOf('{floor}') !== -1}`)
                .toBe(`${locale} legendBelowFloorHidden has {floor}=true`);
            // the two substituted messages must keep their placeholders in
            // EVERY language, or the translated string renders a bare sentence
            // with the numbers silently dropped.
            expect(`${locale} mesh has {nodes}=${playback.fallback.mesh.indexOf('{nodes}') !== -1}`)
                .toBe(`${locale} mesh has {nodes}=true`);
            expect(`${locale} mesh has {triangles}=${playback.fallback.mesh.indexOf('{triangles}') !== -1}`)
                .toBe(`${locale} mesh has {triangles}=true`);
            expect(`${locale} budget has {budget}=${playback.fallback.budget.indexOf('{budget}') !== -1}`)
                .toBe(`${locale} budget has {budget}=true`);
            expect(`${locale} budget has {source}=${playback.fallback.budget.indexOf('{source}') !== -1}`)
                .toBe(`${locale} budget has {source}=true`);
        });
    });
});
