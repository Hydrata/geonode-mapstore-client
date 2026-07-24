import expect from 'expect';
import Rx from 'rxjs';

import {
    createTerrainFromBboxErrorEpic,
    convertTerrainDatumErrorEpic
} from '../terrainBboxEpic';
import {
    createTerrainFromBboxError,
    convertTerrainDatumError
} from '../../actionsAnuga';

// UAT-2 (epic 2359) green-error-toast regression: MapStore's show(opts, level)
// takes level as its SECOND ARG — a `level` key inside opts is spread in and
// then silently clobbered to 'success'. These specs pin the emitted action's
// level (type-only assertions are blind to the bug).
const mockActions = (actions) => {
    const subject = new Rx.Subject();
    const action$ = subject.asObservable();
    action$.ofType = (...types) => action$.filter(a => types.includes(a.type));
    setTimeout(() => {
        actions.forEach(a => subject.next(a));
        subject.complete();
    }, 0);
    return action$;
};

describe('terrainBboxEpic error toasts carry their level (not success-green)', () => {
    it('createTerrainFromBboxErrorEpic emits a level=error notification', (done) => {
        const emitted = [];
        createTerrainFromBboxErrorEpic(mockActions([createTerrainFromBboxError('boom')]))
            .subscribe(a => emitted.push(a), done, () => {
                expect(emitted.length).toBe(1);
                expect(emitted[0].type).toInclude('NOTIFICATION');
                expect(emitted[0].level).toBe('error');
                done();
            });
    });

    it('convertTerrainDatumErrorEpic emits a level=error notification', (done) => {
        const emitted = [];
        convertTerrainDatumErrorEpic(mockActions([convertTerrainDatumError('boom')]))
            .subscribe(a => emitted.push(a), done, () => {
                expect(emitted.length).toBe(1);
                expect(emitted[0].type).toInclude('NOTIFICATION');
                expect(emitted[0].level).toBe('error');
                done();
            });
    });
});
