import expect from 'expect';
import reducer from '../reducersPiwikPro';

describe('PiwikPro Plugin', () => {
    describe('Reducer', () => {
        const initialState = {};

        it('should return initial state', () => {
            const state = reducer(undefined, { type: 'UNKNOWN' });
            expect(state).toEqual(initialState);
        });

        it('should return same state for unknown actions', () => {
            const existingState = { someData: 'test' };
            const state = reducer(existingState, { type: 'UNKNOWN_ACTION' });
            expect(state).toEqual(existingState);
        });
    });
});
