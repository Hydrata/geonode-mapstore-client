/**
 * Copyright 2026, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * playbackReducer — registers the `anugaPlayback` redux slice (TASK-2627,
 * W3.1, epic 2618) — NOT `playback` (MapStore2 core already owns that key
 * for its own Timeline plugin; see epics/playbackEpics.js's header note for
 * how this was caught live). A thin re-export: every transition lives in
 * the pure playbackController.playbackControllerReducer so it stays
 * testable without a store (see playbackController-test.js). Registered in
 * Anuga.js's `reducers: { anugaPlayback }`.
 */
import { playbackControllerReducer } from '../playbackController';

export default playbackControllerReducer;
