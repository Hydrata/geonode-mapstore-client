/*
 * TASK-1491 regression — AnugaContainer.mapStateToProps must be safe for an
 * ANONYMOUS viewer whose SimpleView/ANUGA slices were never populated.
 *
 * Root cause: the selector read `state?.simpleView.hasOwnProperty('visibleIntroduction')`
 * — the optional chain stopped at `.simpleView`, so `.hasOwnProperty(...)` was
 * invoked on `undefined` and threw `Cannot read properties of undefined
 * (reading 'hasOwnProperty')`. That escaped to the MapStore error boundary and
 * replaced the entire ViewerRoute ("Oops, something has gone wrong"), so no map
 * or plugins mounted. initAnugaEpic is auth-gated (pollingEpics.js:174), so for
 * an anon user state.simpleView / state.anuga are undefined — i.e. the `{}`-ish
 * state below is the anon viewer's reality, not a synthetic edge case.
 *
 * Guard: optional-chain through `.hasOwnProperty` while preserving the original
 * semantics (explicit visibleIntroduction wins; absent key defaults to true).
 */
import expect from 'expect';
import { mapStateToProps } from '../anugaContainer';

describe('anugaContainer mapStateToProps (TASK-1491 anon null-guard)', () => {
    it('does not throw when state.simpleView is undefined (anon viewer)', () => {
        expect(() => mapStateToProps({})).toNotThrow();
    });
    it('defaults visibleIntroduction to true when simpleView is absent', () => {
        expect(mapStateToProps({}).visibleIntroduction).toBe(true);
    });
    it('defaults visibleIntroduction to true when simpleView has no such key', () => {
        expect(mapStateToProps({ simpleView: {} }).visibleIntroduction).toBe(true);
    });
    it('honours an explicit visibleIntroduction=false set on the project config', () => {
        expect(mapStateToProps({ simpleView: { visibleIntroduction: false } }).visibleIntroduction).toBe(false);
    });
});
