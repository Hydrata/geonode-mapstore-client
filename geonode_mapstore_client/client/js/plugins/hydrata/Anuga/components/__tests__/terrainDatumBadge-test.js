/*
 * TASK-2971 (epic 2815 W4) — vertical-datum tag/measurement CONFLICT is the
 * loudest state the platform can be in about a terrain's datum, not the
 * quietest. Before this task `datumBadgeSeverity` returned null whenever
 * `datum_guess === 'unknown'` (terrainDatumBadge.js:39, pre-fix), which is
 * exactly the value `infer_vertical_datum` sets on a conflict — so a real
 * conflict rendered nothing at all.
 *
 * This spec pins:
 *   - datumBadgeSeverity('warn') for a conflict, independent of datum_guess.
 *   - the badge renders a WARN with dedicated conflict copy (new msgIds,
 *     not the offset-based hydrata.anuga.terrainDatumBadgeEvidence, which
 *     the conflict object cannot drive — it carries no dod_vs_glo30_median_m).
 *   - a plain 'unknown' (no conflict) STAYS silent — the pre-existing,
 *     deliberate behaviour for an unstamped/legacy terrain (R3).
 *   - Keep/Correct dismiss actions still render for a conflict (A4: pinned
 *     as a deliberate choice, not an accident of reusing the WARN JSX path);
 *     Convert does NOT, because a conflict carries datum_guess 'unknown',
 *     never 'ellipsoid'.
 *
 * Sole importer: anugaInputMenu.js:83 (H2) — no other wiring needed.
 */
import expect from 'expect';
import React from 'react';
import ReactDOM from 'react-dom';
import { Provider } from 'react-redux';
import TerrainDatumBadge, { datumBadgeSeverity } from '../terrainDatumBadge';

// Minimal store — TerrainDatumBadge's connect() only reads getProjectId,
// i.e. state.anuga.projects.data.id (selectorsAnuga.js:200).
function createMockStore() {
    const state = {
        anuga: { projects: { data: { id: 42 } } }
    };
    return {
        getState: () => state,
        subscribe: () => () => {},
        dispatch: () => {}
    };
}

describe('TASK-2971 datumBadgeSeverity — conflict is the loudest state', () => {
    it('returns null for no vertical_datum at all', () => {
        expect(datumBadgeSeverity(null)).toBe(null);
        expect(datumBadgeSeverity(undefined)).toBe(null);
    });

    it('stays silent for a plain unknown guess with no conflict (R3, unchanged)', () => {
        expect(datumBadgeSeverity({ datum_guess: 'unknown' })).toBe(null);
        expect(datumBadgeSeverity({ datum_guess: 'unknown', confidence: 0 })).toBe(null);
    });

    it('WARNs on a tag_measurement_conflict even though datum_guess is unknown', () => {
        const verticalDatum = {
            datum_guess: 'unknown',
            confidence: 0.0,
            tag_measurement_conflict: {
                tag_guess: 'orthometric_egm2008',
                dod_median_m: 27.3,
                expected_ellipsoid_dod_m: 27.6
            }
        };
        expect(datumBadgeSeverity(verticalDatum)).toBe('warn');
    });

    it('still WARNs for the pre-existing ellipsoid case (no regression)', () => {
        expect(datumBadgeSeverity({ datum_guess: 'ellipsoid' })).toBe('warn');
    });

    it('still confirms (ok) high-confidence orthometric with no conflict (no regression)', () => {
        expect(datumBadgeSeverity({ datum_guess: 'orthometric_egm2008', confidence: 0.95 })).toBe('ok');
    });
});

describe('TASK-2971 TerrainDatumBadge render — conflict badge', () => {
    let container;
    beforeEach(() => { container = document.createElement('div'); document.body.appendChild(container); });
    afterEach(() => { ReactDOM.unmountComponentAtNode(container); document.body.removeChild(container); container = undefined; });

    const CONFLICT_TERRAIN = {
        id: 585,
        vertical_datum: {
            datum_guess: 'unknown',
            confidence: 0.0,
            tag_measurement_conflict: {
                tag_guess: 'orthometric_egm2008',
                dod_median_m: 27.3,
                expected_ellipsoid_dod_m: 27.6
            }
        }
    };

    function render(terrain) {
        ReactDOM.render(
            <Provider store={createMockStore()}>
                <TerrainDatumBadge terrain={terrain} />
            </Provider>,
            container
        );
    }

    it('renders nothing for a plain unknown terrain (no conflict) — R3 stays silent', () => {
        render({ id: 1, vertical_datum: { datum_guess: 'unknown' } });
        expect(container.querySelector('.sv-anuga-terrain-datum-badge')).toNotExist();
    });

    it('renders the WARN badge shell for a conflict terrain', () => {
        render(CONFLICT_TERRAIN);
        expect(container.querySelector('[data-testid="terrain-datum-badge-585"]')).toExist();
        expect(container.querySelector('[data-testid="terrain-datum-badge-toggle-585"]')).toExist();
    });

    it('conflict evidence uses the dedicated msgId, not the offset-based one', () => {
        render(CONFLICT_TERRAIN);
        const evidence = container.querySelector('[data-testid="terrain-datum-evidence-585"]');
        expect(evidence).toExist();
        // Message with no IntlProvider in scope falls back to rendering the
        // msgId itself as text — assert on that so the branch actually taken
        // is provably the conflict one, not the offset-based fallback.
        expect(evidence.textContent).toInclude('hydrata.anuga.terrainDatumConflictEvidence');
        expect(evidence.textContent).toNotInclude('hydrata.anuga.terrainDatumBadgeEvidence');
    });

    it('conflict header uses the dedicated msgId', () => {
        render(CONFLICT_TERRAIN);
        const head = container.querySelector('[data-testid="terrain-datum-badge-toggle-585"]');
        expect(head.textContent).toInclude('hydrata.anuga.terrainDatumConflictWarn');
    });

    it('A4: Keep/Correct dismiss actions render for a conflict; Convert does not (datum_guess is unknown, never ellipsoid)', () => {
        render(CONFLICT_TERRAIN);
        expect(container.querySelector('[data-testid="terrain-datum-keep-585"]')).toExist();
        expect(container.querySelector('[data-testid="terrain-datum-correct-585"]')).toExist();
        expect(container.querySelector('[data-testid="terrain-datum-convert-585"]')).toNotExist();
    });

    it('clicking Keep dismisses the conflict badge same as any other WARN', () => {
        render(CONFLICT_TERRAIN);
        container.querySelector('[data-testid="terrain-datum-keep-585"]').click();
        expect(container.querySelector('.sv-anuga-terrain-datum-badge')).toNotExist();
    });

    it('a non-conflict ellipsoid terrain still renders the ORIGINAL warn copy (no regression)', () => {
        render({
            id: 7,
            vertical_datum: { datum_guess: 'ellipsoid', confidence: 0.4, dod_vs_glo30_median_m: -12.3 }
        });
        const head = container.querySelector('[data-testid="terrain-datum-badge-toggle-7"]');
        expect(head.textContent).toInclude('hydrata.anuga.terrainDatumBadgeWarn');
        expect(container.querySelector('[data-testid="terrain-datum-convert-7"]')).toExist();
    });
});
