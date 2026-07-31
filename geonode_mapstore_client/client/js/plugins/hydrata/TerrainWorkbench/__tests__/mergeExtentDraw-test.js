/**
 * TASK-2582 (W2a) — Merge extent draw lifecycle: owner-isolated ('merge-extent')
 * rectangle draw backing the Combined-surface panel's 'Set extent' button.
 *
 * Mirrors terrainBboxDrawReset-test.js's draw-reset coverage for the NEW
 * 'merge-extent' owner: twMergeExtentEndDrawingEpic (epicsTerrainWorkbench.js)
 * listens for END_DRAWING tagged 'merge-extent', extracts the WGS84 bbox via
 * the SHARED extractBboxFromDrawAction helper (terrainBboxEpic.js — imported,
 * never copy-pasted), resets the draw interaction on EVERY branch (no
 * draw-state leak — mirrors the terrain-bbox precedent), and stores the
 * extent via TW_SET_MERGE_EXTENT.
 */
import expect from 'expect';
import Rx from 'rxjs';
import { twMergeExtentEndDrawingEpic } from '../epicsTerrainWorkbench';
import { TW_SET_MERGE_EXTENT, TW_SET_MERGE_EXTENT_DRAWING } from '../actionsTerrainWorkbench';

const CHANGE_DRAWING_STATUS = 'CHANGE_DRAWING_STATUS';
const END_DRAWING = 'DRAW:END_DRAWING';

// Helper: drive the epic with an array of actions, collect all dispatched
// actions up to completion. Mirrors terrainBboxDrawReset-test.js's runEpic.
const runEpic = (epic, actions) =>
    new Promise((resolve, reject) => {
        const subject = new Rx.Subject();
        const action$ = subject.asObservable();
        action$.ofType = (...types) => action$.filter(a => types.includes(a.type));
        const emitted = [];
        epic(action$, {}).subscribe(
            a => emitted.push(a),
            reject,
            () => resolve(emitted)
        );
        actions.forEach(a => subject.next(a));
        subject.complete();
    });

// A minimal valid END_DRAWING geometry (EPSG:4326 polygon corners) tagged for
// the NEW 'merge-extent' owner.
const VALID_END_DRAWING = {
    type: END_DRAWING,
    owner: 'merge-extent',
    geometry: {
        type: 'Polygon',
        coordinates: [[[151.0, -33.0], [151.5, -33.0], [151.5, -33.5], [151.0, -33.5], [151.0, -33.0]]],
        projection: 'EPSG:4326'
    }
};

// An END_DRAWING with an unrecognisable geometry (null bbox path).
const INVALID_END_DRAWING = {
    type: END_DRAWING,
    owner: 'merge-extent',
    geometry: null
};

describe('TASK-2582 twMergeExtentEndDrawingEpic — Merge extent draw lifecycle', () => {
    it('valid draw: FIRST action is CHANGE_DRAWING_STATUS stop for merge-extent (owner-isolated reset)', (done) => {
        runEpic(twMergeExtentEndDrawingEpic, [VALID_END_DRAWING])
            .then(emitted => {
                expect(emitted.length).toBeGreaterThan(0);
                const reset = emitted[0];
                expect(reset.type).toBe(CHANGE_DRAWING_STATUS);
                expect(reset.status).toBe('stop');
                expect(reset.owner).toBe('merge-extent');
                done();
            })
            .catch(done);
    });

    it('valid draw: stores the normalised WGS84 bbox via TW_SET_MERGE_EXTENT', (done) => {
        runEpic(twMergeExtentEndDrawingEpic, [VALID_END_DRAWING])
            .then(emitted => {
                const setAction = emitted.find(a => a.type === TW_SET_MERGE_EXTENT);
                expect(setAction).toExist();
                expect(setAction.extent).toEqual([151.0, -33.5, 151.5, -33.0]);
                done();
            })
            .catch(done);
    });

    it('invalid geometry: resets draw + clears the drawing flag WITHOUT setting an extent (no draw-state leak)', (done) => {
        runEpic(twMergeExtentEndDrawingEpic, [INVALID_END_DRAWING])
            .then(emitted => {
                expect(emitted.length).toBe(2);
                expect(emitted[0].type).toBe(CHANGE_DRAWING_STATUS);
                expect(emitted[0].status).toBe('stop');
                expect(emitted[0].owner).toBe('merge-extent');
                expect(emitted[1].type).toBe(TW_SET_MERGE_EXTENT_DRAWING);
                expect(emitted[1].active).toBe(false);
                // No merge extent stored from unreadable geometry.
                expect(emitted.some(a => a.type === TW_SET_MERGE_EXTENT)).toBe(false);
                done();
            })
            .catch(done);
    });

    it('ignores END_DRAWING for other owners (e.g. terrain-bbox — owner isolation)', (done) => {
        const otherOwner = { ...VALID_END_DRAWING, owner: 'terrain-bbox' };
        runEpic(twMergeExtentEndDrawingEpic, [otherOwner])
            .then(emitted => {
                expect(emitted.length).toBe(0);
                done();
            })
            .catch(done);
    });
});
