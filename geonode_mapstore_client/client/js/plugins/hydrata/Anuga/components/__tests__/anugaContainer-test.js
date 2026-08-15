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
 * TASK-2777 (epic 2765 W3) — THE READ ITSELF IS GONE, so the crash it caused
 * cannot recur by construction rather than by guard. `visibleIntroduction` was
 * mapped into props that this container never rendered, with an absent-key
 * default of TRUE; the introduction's visibility now lives entirely in
 * SimpleView (introductionGate.js decides, simpleViewContainer renders).
 *
 * The COVERAGE IS UPDATED, NOT DELETED. The valuable half of TASK-1491 was
 * never the default — it was "this selector runs, unthrown, against the
 * anonymous viewer's empty state", which is still true of the ~20 reads that
 * remain and is still the shape that took the whole ViewerRoute down. The
 * defaulting assertions are replaced by an assertion that the prop is GONE, so
 * a future re-introduction of an always-on default has to argue with a test.
 */
import expect from 'expect';
import { mapStateToProps, AnugaContainer } from '../anugaContainer';

describe('AnugaContainer resultsPlaybackEnabled (TASK-2631, W6.2 — dark-ship default)', () => {
    it('defaults to false — the whole playback surface (control bar, legend, identify readout, W6.1 preview button) ships dark by construction', () => {
        expect(AnugaContainer.defaultProps.resultsPlaybackEnabled).toBe(false);
    });
});

describe('anugaContainer mapStateToProps (TASK-1491 anon null-guard)', () => {
    it('does not throw when state.simpleView is undefined (anon viewer)', () => {
        expect(() => mapStateToProps({})).toNotThrow();
    });
    it('does not throw when simpleView exists but is empty', () => {
        expect(() => mapStateToProps({ simpleView: {} })).toNotThrow();
    });
    it('still resolves the props it does map, against the anon empty state', () => {
        // The crash took the ViewerRoute down for everyone, so the assertion
        // that matters is that this selector completes for the anon shape and
        // returns a usable object — not the value of any one key.
        const props = mapStateToProps({});
        expect(typeof props).toBe('object');
        expect(props.isAnugaProject).toBe(undefined);
    });
});

describe('anugaContainer no longer maps visibleIntroduction (TASK-2777)', () => {
    // It was a dead prop with an always-on default: nothing here rendered it,
    // and `state.simpleView` is undefined for an anonymous viewer, so the
    // absent-key branch returned TRUE for exactly the audience that would have
    // been trapped behind a permanently open modal had anyone wired a render
    // to it. Visibility is now decided by SimpleView/introductionGate.js alone.
    it('does not emit visibleIntroduction for the anon empty state', () => {
        expect('visibleIntroduction' in mapStateToProps({})).toBe(false);
    });
    it('does not emit it even when the SimpleView slice carries the key', () => {
        expect('visibleIntroduction' in mapStateToProps({
            simpleView: { visibleIntroduction: false }
        })).toBe(false);
    });
    it('does not declare it as a prop', () => {
        expect(AnugaContainer.propTypes.visibleIntroduction).toBe(undefined);
    });
});
