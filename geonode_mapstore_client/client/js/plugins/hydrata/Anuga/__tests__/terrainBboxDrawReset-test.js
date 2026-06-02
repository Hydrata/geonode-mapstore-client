/**
 * TASK-1406 (W2 FE / ISSUE 8) — Verify that terrainBboxEndDrawingEpic resets
 * the MapStore draw state after bbox-draw completes.
 *
 * Root cause: after END_DRAWING fires for owner='terrain-bbox', the epic never
 * dispatched changeDrawingStatus('stop') so MapStore's draw reducer kept
 * drawMethod='BBOX'/drawOwner='terrain-bbox'. The next consumer (e.g. boundary
 * editor) then started in rectangle mode.
 *
 * Fix: each END_DRAWING branch now leads with a CHANGE_DRAWING_STATUS action
 * with status='stop' / owner='terrain-bbox'. These tests are RED before the fix
 * and GREEN after.
 */
import expect from 'expect';
import Rx from 'rxjs';
import { terrainBboxEndDrawingEpic } from '../epics/terrainBboxEpic';

const CHANGE_DRAWING_STATUS = 'CHANGE_DRAWING_STATUS';
const END_DRAWING = 'DRAW:END_DRAWING';

// Helper: drive the epic with an array of actions, collect all dispatched
// actions up to completion.
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

// A minimal valid END_DRAWING geometry (EPSG:4326 polygon corners)
const VALID_END_DRAWING = {
    type: END_DRAWING,
    owner: 'terrain-bbox',
    geometry: {
        type: 'Polygon',
        coordinates: [[[151.0, -33.0], [151.5, -33.0], [151.5, -33.5], [151.0, -33.5], [151.0, -33.0]]],
        projection: 'EPSG:4326'
    }
};

// An END_DRAWING with an unrecognisable geometry (null bbox path)
const INVALID_END_DRAWING = {
    type: END_DRAWING,
    owner: 'terrain-bbox',
    geometry: null
};

// Oversized geometry spanning > MAX_BBOX_SPAN_DEG (95°) in longitude
const OVERSIZED_END_DRAWING = {
    type: END_DRAWING,
    owner: 'terrain-bbox',
    geometry: {
        type: 'Polygon',
        coordinates: [[[0, 0], [95, 0], [95, 10], [0, 10], [0, 0]]],
        projection: 'EPSG:4326'
    }
};

describe('TASK-1406 terrainBboxEndDrawingEpic — draw reset on completion', () => {

    it('valid bbox: FIRST action is CHANGE_DRAWING_STATUS stop for terrain-bbox (ISSUE 8 fix)', (done) => {
        runEpic(terrainBboxEndDrawingEpic, [VALID_END_DRAWING])
            .then(emitted => {
                expect(emitted.length).toBeGreaterThan(0);
                const reset = emitted[0];
                expect(reset.type).toBe(CHANGE_DRAWING_STATUS);
                expect(reset.status).toBe('stop');
                expect(reset.owner).toBe('terrain-bbox');
                done();
            })
            .catch(done);
    });

    it('valid bbox: still sets the bbox + opens confirm popup after the reset', (done) => {
        runEpic(terrainBboxEndDrawingEpic, [VALID_END_DRAWING])
            .then(emitted => {
                const types = emitted.map(a => a.type);
                // Must include SET_TERRAIN_BBOX and SET_TERRAIN_BBOX_CONFIRM
                expect(types).toContain('SET_TERRAIN_BBOX');
                expect(types).toContain('SET_TERRAIN_BBOX_CONFIRM');
                done();
            })
            .catch(done);
    });

    it('invalid geometry: FIRST action is CHANGE_DRAWING_STATUS stop (draw reset even on error)', (done) => {
        runEpic(terrainBboxEndDrawingEpic, [INVALID_END_DRAWING])
            .then(emitted => {
                expect(emitted.length).toBeGreaterThan(0);
                const reset = emitted[0];
                expect(reset.type).toBe(CHANGE_DRAWING_STATUS);
                expect(reset.status).toBe('stop');
                expect(reset.owner).toBe('terrain-bbox');
                done();
            })
            .catch(done);
    });

    it('invalid geometry: also dispatches SET_TERRAIN_BBOX_ERROR', (done) => {
        runEpic(terrainBboxEndDrawingEpic, [INVALID_END_DRAWING])
            .then(emitted => {
                const types = emitted.map(a => a.type);
                expect(types).toContain('SET_TERRAIN_BBOX_ERROR');
                done();
            })
            .catch(done);
    });

    it('oversized bbox: FIRST action is CHANGE_DRAWING_STATUS stop', (done) => {
        runEpic(terrainBboxEndDrawingEpic, [OVERSIZED_END_DRAWING])
            .then(emitted => {
                expect(emitted.length).toBeGreaterThan(0);
                const reset = emitted[0];
                expect(reset.type).toBe(CHANGE_DRAWING_STATUS);
                expect(reset.status).toBe('stop');
                expect(reset.owner).toBe('terrain-bbox');
                done();
            })
            .catch(done);
    });

    it('ignores END_DRAWING for other owners (e.g. vectorDraw)', (done) => {
        const otherOwner = { ...VALID_END_DRAWING, owner: 'vectorDraw' };
        runEpic(terrainBboxEndDrawingEpic, [otherOwner])
            .then(emitted => {
                // Should emit nothing for a non-terrain-bbox owner
                expect(emitted.length).toBe(0);
                done();
            })
            .catch(done);
    });
});
