/**
 * Copyright 2026, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * playbackMemoryPolicy — TASK-2708 (W1.2, epic 2706). THE module that owns
 * the playback client's residency policy. Nothing else in the playback
 * chain is allowed to invent a memory constant: the chunk cache's ceiling,
 * the prefetch window's depth and the dtype the cache holds are all derived
 * HERE, from the store's own declared shape.
 *
 * ============================================================================
 * PROOF 4 — THE RESIDENCY POLICY, STATED
 * ============================================================================
 *
 * WHAT WENT WRONG. The shipped 2618 client sized its chunk cache with a fixed
 * constant (playbackChunkCache.DEFAULT_MAX_BYTES = 64 MiB) and its prefetch
 * window with a fixed chunk COUNT (playbackController's radius 2). Neither
 * scales with the mesh. On run 1328 — 3,393,075 nodes, 6,779,432 triangles,
 * time-chunked at 10 — one DEQUANTIZED chunk is
 *     10 x 3,393,075 x 4 B (Float32) = 135,723,000 B = 129.4 MiB
 * i.e. TWICE the entire cache ceiling. A single element that cannot fit in its
 * own cache makes the LRU thrash by construction, and radius 2 asks for
 * 3 quantities x 5 chunks = 1,941 MiB of simultaneously-live decoded arrays.
 * Measured on prod: heap 81 -> 2,876 MiB, 6-8 main-thread stalls totalling
 * ~8 s (worst 5,722 ms), every fetch COMPLETED, player never rendered.
 *
 * THE POLICY, IN ONE SENTENCE. Hold the three quantity arrays for the
 * current time-chunk plus a bounded lookahead, in their STORED uint16 form,
 * inside a cache whose ceiling is computed from the store's own chunk
 * footprint against a total heap budget — and dequantize one frame's row at
 * a time, off the main thread.
 *
 * 1. WHICH QUANTITIES STAY RESIDENT: all three (depth, x_velocity,
 *    y_velocity), always. This is NOT negotiable and was explicitly
 *    re-litigated and rejected during review. playbackEpics requires all
 *    three before a chunk counts as playable; playbackShaders' vertex shader
 *    binds aQty0/aQty1 as vec3 (depth, xVel, yVel) and computes
 *    `length(q.yz)` on every vertex regardless of uColorMode; playbackFlowViz
 *    and playbackParticles read the SAME velocity attributes while depth is
 *    the displayed colour. "Hold only the active quantity" would silently
 *    regress shipped 2618 flow-viz and particles. quantityCount is therefore
 *    a constant of the render contract, not a tuning knob.
 *
 * 2. RESIDENCY DTYPE: the cache holds the STORED uint16, never the
 *    dequantized Float32 (TASK-2708 change (c)). Dequantization is
 *    `physical = offset + stored * scale`, exact and cheap, and is applied to
 *    one frame's row (nNode elements) at slice time in
 *    loadPlaybackFrame — not to a whole chunk at decode time. This alone
 *    halves time-series residency (2 B/element instead of 4 B) and is
 *    lossless: the same Float32 values reach the renderer, just later and in
 *    1/chunkLengthT of the volume.
 *
 * 3. HOW THE CEILING IS DERIVED FROM THE STORE:
 *      storedChunkBytes   = chunkLengthT x nNode x 2          (uint16)
 *      fixedBytes         = geometryBytes + renderBytes       (see below)
 *      timeSeriesBudget   = budgetBytes - fixedBytes
 *      chunksPerQuantity  = clamp(floor(timeSeriesBudget /
 *                                (quantityCount x storedChunkBytes)),
 *                                MIN_CHUNKS_PER_QUANTITY,
 *                                MAX_CHUNKS_PER_QUANTITY)
 *      cacheMaxBytes      = quantityCount x chunksPerQuantity x storedChunkBytes
 *    AMENDED BY TASK-2984 (W1.1, epic 2981), 2026-09-08. That upper clamp is
 *    GONE: MAX_CHUNKS_PER_QUANTITY was renamed FLOOR_WINDOW_CHUNKS_PER_QUANTITY
 *    and the rule became
 *      chunksPerQuantity = max(todaysN, deepN)     [monotone: never shallower]
 *      deepN             = clamp(floor((windowBudget - fixedBytes) /
 *                                (quantityCount x storedChunkBytes)),
 *                                MIN_CHUNKS_PER_QUANTITY,
 *                                min(totalChunks, callerUpperBound))
 *      windowBudget      = min(budgetBytes - PLAN_TRANSIENT_EXCESS_BYTES,
 *                              PLAN_UNCAP_MAX_PEAK_BYTES)
 *    where `todaysN` is EXACTLY the formula above, kept verbatim so the
 *    monotone property is provable rather than argued. See the constants and
 *    computePlaybackMemoryPlan below.
 *    Everything on the right-hand side except the two clamps comes from the
 *    store's own metadata. A bigger mesh gets a bigger cache and a shallower
 *    window; a smaller mesh gets a deeper window. The next mesh being bigger
 *    again does not need a code change.
 *
 * 4. PREFETCH DEPTH: asymmetric, because playback runs forwards. Of the
 *    chunksPerQuantity slots, at most ONE is spent behind the playhead (so a
 *    short scrub-back is still a cache hit) and the rest ahead:
 *      bufferWindowRadius = min(1, floor((chunksPerQuantity - 1) / 2))
 *      bufferWindowAhead  = chunksPerQuantity - 1 - bufferWindowRadius
 *    MIN_CHUNKS_PER_QUANTITY = 2 is a STRUCTURAL floor, not a preference: a
 *    zarr chunk is the atomic decompress unit, and loadPlaybackFrame needs
 *    frame0 and frame1, which straddle two chunks at every chunk boundary. A
 *    1-chunk cache would evict the chunk it is still reading at every
 *    boundary crossing — the same thrash, one order of magnitude down.
 *    MAX_CHUNKS_PER_QUANTITY = 3 (one behind, current, one ahead) was the
 *    point past which lookahead was judged to stop buying anything: the
 *    controller clock is 20 Hz and even a chunk-1 store's third slot is
 *    already 3 timesteps of runway, while each extra slot costs a whole
 *    chunk x 3 quantities. TASK-2984 REVERSED THAT JUDGEMENT for stores the
 *    budget can genuinely hold — 3 became the FLOOR window, not the cap, and
 *    813_417_1412 now holds all 11 of its chunks at the shipped default
 *    budget. What the extra slots buy is a fill that has already landed
 *    before the playhead reaches it (epic 2981's whole subject).
 *
 * 5. THE ARITHMETIC, AGAINST THE REVIEW'S OWN FLOORS (run 1328:
 *    nNode 3,393,075, nFace 6,779,432). fixedBytes is what the shipped
 *    renderer holds for this mesh no matter what the time-series policy is:
 *      geometry  20 x nNode + 16 x nFace  = 176,332,412 B  (168.2 MiB)
 *        node_x/node_y/elevation/friction/vertexInradius Float32 = 20 x nNode
 *        inradius Float32 (per FACE) 4 x nFace + face_node_connectivity
 *        Int32 3-per-face 12 x nFace = 16 x nFace
 *      render    48 x nNode            = 162,867,600 B  (155.3 MiB)
 *        layer's private nodeX/nodeY clone (Float32, 8 x nNode — the worker
 *        transfer would otherwise detach Redux's copy, playbackEpics:271),
 *        reprojected x3857/y3857 (Float64, 16 x nNode, retained by the
 *        flow-viz overlay, AnugaPlaybackRenderer:250-255), and frame0+frame1
 *        (each {depth,xVelocity,yVelocity} Float32 = 12 x nNode -> 24 x nNode)
 *      fixedBytes                        = 339,200,012 B  (323.5 MiB)
 *
 *    chunk-10 (what prod writes today), budget 800 MiB:
 *      storedChunkBytes 67,861,500 B (64.7 MiB); timeSeriesBudget 499,660,788
 *      -> floor(499,660,788 / 203,584,500) = 2 chunks/quantity
 *      -> cacheMaxBytes 407,169,000 B (388.3 MiB); radius 0, ahead 1
 *      -> peak 746,369,012 B = 711.8 MiB   <= 800 MiB budget. A 3.9x
 *         reduction against the 2,876 MiB measured on prod.
 *      The review's floors are met exactly: this IS "3 quantities x 1 chunk
 *      + next-chunk prefetch on all three", which the review priced at
 *      ~530 MiB before the derived-buffer terms it had omitted.
 *
 *    chunk-1 (TASK-2719's re-chunked store), budget 400 MiB:
 *      storedChunkBytes 6,786,150 B; the affordable count (24) is clamped by
 *      MAX_CHUNKS_PER_QUANTITY to 3 -> cacheMaxBytes 61,075,350 B (58.2 MiB);
 *      (post-TASK-2984 at a 400 MiB budget this store still plans 3: the
 *      window budget is min(400 - 680, 440) MiB, i.e. negative, so deepN
 *      clamps to the structural floor and the monotone max() returns 3.)
 *      radius 1, ahead 1
 *      -> peak 400,275,362 B = 381.7 MiB   <= 400 MiB budget.
 *
 *    NOT COUNTED, deliberately, and why: (a) gunzip transients and the raw
 *    decoded buffer now live in the DECODE WORKER's heap, not the main
 *    thread's (TASK-2708 change (d)) — the main thread only ever receives the
 *    finished uint16 via a transfer; (b) packQuantityVec3's Float32Array(3n)
 *    and AnugaPlaybackRenderer.setMesh's Float32Array(2n) are function-local
 *    and released the moment gl.bufferData copies them to the GPU; (c) the
 *    identify path's own reprojection (16 x nNode = 51.8 MiB,
 *    playbackEpics.getReprojectedMesh) is allocated lazily on the FIRST
 *    Inspect click and never during load/play/scrub, which is what PROOF 2a/2b
 *    measure. It is reported as `onDemandIdentifyBytes` so it is stated
 *    rather than hidden.
 *
 * 6. WHAT THIS POLICY DOES NOT FIX. On a chunk-10 store the smallest
 *    residency granule is 10 timesteps x 3 quantities = 194 MiB, so the
 *    600 MiB figure floated in the 2026-08-10 draft is unreachable there by
 *    construction, whatever the cache does. That is the entire argument for
 *    TASK-2719 (export at chunk 1), and this module's own numbers are the
 *    evidence: the same budget buys 3 slots of lookahead at chunk 1 and 2 at
 *    chunk 10, for a sixth of the bytes.
 */

import { QUANTITY_ARRAYS } from './playbackChunkShape';

/** The stored dtype of every quantized array in the schema (schema Section 3). */
export const STORED_BYTES_PER_ELEMENT = 2; // uint16
/** What the RENDERER receives per element, after per-frame dequantization. */
export const PHYSICAL_BYTES_PER_ELEMENT = 4; // Float32

/**
 * Total main-thread heap the playback client is allowed to add above the
 * pre-selection baseline, for a legacy chunk-10 store. Epic 2706 AC2's
 * "honest number": ~3.6x below the 2,876 MiB measured on prod, and the most a
 * chunk-10 store can be squeezed to without changing the export (TASK-2719).
 */
export const PLAYBACK_HEAP_BUDGET_BYTES = 800 * 1024 * 1024;

/** See PROOF 4 note 4 — a structural floor (frame0/frame1 straddle a boundary). */
export const MIN_CHUNKS_PER_QUANTITY = 2;
/**
 * See PROOF 4 note 4 — one behind, current, one ahead.
 *
 * TASK-2984 (W1.1, epic 2981) RENAMED this from MAX_CHUNKS_PER_QUANTITY. It is
 * no longer a CAP: it is the FLOOR window, the depth HEAD plans and the depth
 * the monotone rule can never go below at the same budget. What now stops the
 * 4-slot window that froze the tab is PLAN_UNCAP_MAX_PEAK_BYTES, not this
 * number — see RULE B clause 7 in computePlaybackMemoryPlan.
 */
export const FLOOR_WINDOW_CHUNKS_PER_QUANTITY = 3;

// ============================================================================
// TASK-2984 (W1.1, epic 2981) — THE THREE MEASURED CONSTANTS.
//
// Every one is FROZEN by operator ruling "ABA" of 2026-09-08 plus the same
// day's follow-up ceiling ruling, on the evidence of TASK-3013's W0.4 memory
// instrument (docs/reports/2026-09-08-task-3013-w04-memory-instrument.html).
// If a measurement contradicts one, that is an ESCALATION, not an edit.
// ============================================================================

/**
 * The most a loaded MapStore tab was measured to hold BEFORE playback asks for
 * anything. W0.4 idle baselines ranged 192.5–280.3 MiB across nine legs; the
 * maximum, 280.3 MiB, is the 813_417_1412 @cap3072 leg. Operator ruling Q1=A.
 *
 * *** IT IS NOT SUBTRACTED FROM THE BUDGET. IT FLOORS THE READING. ***
 * resolvePlaybackHeapBudget's heap offer already nets the live usedJSHeapSize
 * (`jsHeapSizeLimit - usedJSHeapSize`), and PLAYBACK_HEAP_BUDGET_BYTES is a
 * MARGINAL budget ("above the pre-selection baseline"), so
 * `usable = budgetBytes - APP_BASELINE_FLOOR_BYTES` would charge the idle tab
 * TWICE — and PLAN_TRANSIENT_EXCESS_BYTES is frozen NET of this baseline
 * precisely so it is charged ONCE. Its ONLY use is RULE A clause 1.
 *
 * It exists because usedJSHeapSize is coarse, rate-limited, and can read
 * near-zero in a fresh tab: a reservation must not under-charge when the
 * reading it replaces is absent, stale or frozen.
 */
export const APP_BASELINE_FLOOR_BYTES = 280 * 1024 * 1024;

/**
 * The ADDITIVE allowance for everything the plan does not price: decode
 * transients, the reprojection worker's copies, GPU driver allocations and
 * MapStore's own retained state. Measured NET OF THE IDLE BASELINE, i.e.
 * (peak heap − idle baseline − plan.peakResidentBytes).
 *
 * OPERATOR RULING 2026-09-08, decision `2026-09-08-w1-e-overrun`: 680 MiB,
 * flat. It SUPERSEDES the 566.0 MiB of ruling Q2=B, which was the maximum of
 * the W0.4 sample (741_410_1328_chunk2 @cap3072, 1221.1 − 215.1 − 440.0).
 *
 * WHY IT ROSE, and this is the part that settles attribution: TASK-2984's
 * AC15 re-measured that same leg on the shipped rule and got 589.3 and
 * 597.4 MiB net — over 566 on BOTH required runs. A third run of the SAME
 * leg with playbackMemoryPolicy.js and playbackEpics.js REVERTED to HEAD
 * (gmc 126b4ab28) burned 664.1 MiB net — the WORST of the three, on a
 * bit-identical 440.0 MiB plan. So the over-run is a property of the shipped
 * client on the chunk-2 store, NOT of the deepening rule this module adds.
 * 680 covers every observation on record, the HEAD control included.
 *
 * WHY NOT HIGHER. Breakeven is 694.3 MiB: 11 of 11 chunks of 813_417_1412
 * need a 105.673 MiB window budget, so 800 − 105.673 = 694.3 is the largest E
 * at which the epic's headline (the whole 11-chunk store at the shipped
 * 800 MiB default) survives. 680 keeps it with 14.3 MiB of margin, and if a
 * future measurement pushes E past 694 the AC2 scale table fails loudly
 * rather than degrading silently.
 *
 * NO OTHER CONSTANT MOVED. No leg died (capVerdict PASS on the 1412 leg,
 * INCONCLUSIVE and never DEAD on every chunk-2 leg, peak cgroup 2231.9 MiB
 * under a 3072 MiB cap), so PLAN_UNCAP_MAX_PEAK_BYTES stays at 440 MiB and
 * APP_BASELINE_FLOOR_BYTES stays at 280 MiB.
 *
 * THREE WARNINGS:
 *  (i) IT IS A LOWER BOUND. Every W0.4 leg that fed the original fit ran
 *      HEAD's 3-chunk window, so no measurement of a DEEPER window has fed it.
 *  (ii) DO NOT MIX THE BASES. The `excess` column of the W0.4 report prints
 *      the RAW excess (baseline included), 781.1 MiB for the same leg. This
 *      constant is net; a raw number compared against it reads as an over-run
 *      on legs that have already passed.
 *  (iii) IT IS FITTED TO THE MAXIMUM OF A NOISY SAMPLE, so it can only ever
 *      rise. The measured spread on ONE configuration is 381.8–664.1 MiB,
 *      i.e. 282 MiB. Re-shaping E as `base + fixedResidencyBytes` was
 *      considered and NOT taken (it does not reduce the variance and is
 *      fitted to 8 points across 2 shapes); revisit it when TASK-3025's
 *      runtime override yields prod telemetry across more shapes.
 */
export const PLAN_TRANSIENT_EXCESS_BYTES = 680 * 1024 * 1024;

/**
 * A hard ceiling on the PLANNED peak — the second, independent bound in
 * RULE B clause 7. Operator ruling Q3=A ("the ceiling comes DOWN to what
 * actually survived") plus the follow-up ceiling ruling of 2026-09-08:
 * 440 MiB is the ONLY plan 741_410_1328_chunk2 has ever survived (W0.4
 * @cap3072 PASS at plan.peakResidentBytes 461,350,712 B = 440.0 MiB; DEAD at
 * caps 384, 768 and 1536).
 *
 * WHAT IT COSTS, so nobody "fixes" it: at 440 MiB the chunk-2 store NEVER
 * deepens beyond HEAD's 3 at any budget in 128–2048 MiB, and neither does the
 * prod chunk-10 shape. The big-device win is carried by 813_417_1412 (3 → 11
 * at the shipped 800 MiB default) and by 741_410_1328_chunk1 (3 → 6 at
 * 1371 MiB). That is the operator's decision, not a defect. Raising it
 * re-creates the documented renderer freeze.
 */
export const PLAN_UNCAP_MAX_PEAK_BYTES = 440 * 1024 * 1024;

/** At or below this navigator.deviceMemory value the 800 MiB floor no longer applies. */
export const SMALL_DEVICE_MEMORY_GIB = 4;
/**
 * A structural floor on the small-device path ONLY, so a stale or near-zero
 * headroom reading cannot collapse the budget to nothing.
 */
export const SMALL_DEVICE_MIN_BUDGET_BYTES = 128 * 1024 * 1024;
/**
 * Used ONLY when no memory signal exists at all AND the coarse phone class
 * fires (iOS Safari and Firefox expose neither performance.memory nor
 * navigator.deviceMemory). A HEURISTIC, not a measurement — what calibrates it
 * is TASK-3013's capped legs, where a 1536 MiB cgroup killed a 440 MiB plan.
 */
export const PHONE_CLASS_BUDGET_BYTES = 256 * 1024 * 1024;

function clamp(value, lo, hi) {
    return Math.min(hi, Math.max(lo, value));
}

// ============================================================================
// TASK-2743 UAT-08 (W6, epic 2706) — SIZE THE BUDGET TO THE MACHINE.
//
// The operator, on the playback stall: "Is there a way to pre-load this a bit
// more aggressively, or safely in response to available memory somehow?"
//
// PLAYBACK_HEAP_BUDGET_BYTES above is a single 800 MiB constant, chosen for
// the worst machine we are willing to support. On run 1328 it buys exactly 2
// chunk slots per quantity, which the asymmetric split turns into 0 behind
// and 1 ahead — a lookahead of ONE chunk, started only as the playhead
// crosses into the previous one. That is the shallowest window the policy can
// express, and it is handed to a 32 GiB workstation and a 4 GiB laptop alike.
//
// The browser will tell us, if asked — but it has to be asked the RIGHT
// question. `performance.memory.jsHeapSizeLimit` is this tab's V8 ceiling
// (4,192 MiB on the workstation, measured), and a first cut spent a fraction
// of it directly. That is wrong, and UAT caught it wrong: this plan is a
// MARGINAL budget (fixedResidencyBytes + cacheMaxBytes are what playback ADDS)
// while the limit is a TOTAL. MapStore, the basemap and the map itself are
// already sitting in that heap before playback allocates a byte.
//
// Measured consequence on map 1461, with the limit-based budget: 1,886.4 MiB,
// 4 chunk slots, a plan reporting peak 1,100.1 MiB and withinBudget true — and
// a renderer process that reached 3.4 GB RSS and stopped responding to CDP
// entirely during a cold load. That is the same tab freeze TASK-2708 exists to
// have fixed, re-introduced by a budget that double-counted the baseline.
//
// So the signal is HEADROOM, not the ceiling: jsHeapSizeLimit minus what the
// tab is already using at planning time, which is exactly the quantity a
// marginal plan should be compared against. Cross-checked against
// navigator.deviceMemory (a coarse figure every modern browser reports), take
// the more pessimistic, clamp.
//
// (navigator.deviceMemory IS NOT SPEC-CAPPED AT 8 GiB in current Chromium —
// TASK-2984 corrected that claim, which stood here until 2026-09-08. It
// reports 16 on a 16 GB box in a secure context, PROVEN on the development
// box and recorded the same way by the W0 census environment block. The
// values are still coarse — powers of two — but the ceiling is not 8.)
//
// Two properties make this safe to put into a policy that was itself tuned
// by measuring a tab freeze:
//   1. The fractions are of headroom the browser has actually measured, not of
//      physical RAM and not of a ceiling something else is already occupying.
//   2. The budget is monotone in the machine's own signals, and every plan
//      derived from it is monotone in the budget (clause 9's max()).
//
// ---------------------------------------------------------------------------
// TASK-2984 (W1.1, epic 2981) REWROTE THE TWO CLAIMS THAT USED TO SIT HERE.
// Both were FALSIFIED by this task; they are restated rather than deleted so
// the change is legible to the next reader.
//
// WAS: "It can only ever RAISE the budget. The clamp's lower bound IS the
// existing 800 MiB constant." NO LONGER TRUE, and that was the defect. The
// clamp's lo is a FLOOR, so min(offers) was floored UP to 800 MiB and three of
// four modelled target devices got the SAME number: iPhone/iOS Safari 800 (no
// signals), Android 4 GB 800 (its own signals offered 163 MiB), Android 2 GB
// 800 (offered 163), old 4 GB desktop 800 — while the two laptops (64 GB and
// 8 GB) were indistinguishable at 1,571. A phone handed the 741_410_1328
// chunk-2 store therefore downloaded 63 MB of geometry and held 440 MiB of
// typed arrays. RULE A clause 2's small-device path is what stops that, and
// it can go DOWN — to SMALL_DEVICE_MIN_BUDGET_BYTES.
//
// WAS: "THE WINDOW CAP DOES NOT MOVE. MAX_CHUNKS_PER_QUANTITY stays at 3."
// NO LONGER TRUE either. The cap became the FLOOR window
// (FLOOR_WINDOW_CHUNKS_PER_QUANTITY); a plan may only ever go DEEPER than
// HEAD's at the same budget, never shallower (clause 9's max()). What now
// stops the 4-slot window that froze the tab is PLAN_UNCAP_MAX_PEAK_BYTES —
// a bound on the PLANNED PEAK IN BYTES, not on a slot count — and the prod
// chunk-10 shape is swept to prove it never reaches 4 at any budget.
//
// AND THE PLAN STILL UNDERSTATES THE TAB — BUT NOT BY A CONSTANT FACTOR.
// This block used to state the understatement as "a factor of 2.5", and an
// earlier cut of this epic turned that into a DIVISOR. It is not a constant of
// nature. TASK-3013's W0.4 instrument measured the ratio across nine legs at
// 2.45x-12.84x RAW and 1.87x-6.33x NET of the idle baseline
// (docs/reports/2026-09-08-task-3013-w04-memory-instrument.html). REPORT the
// ratio; never divide by it. What the policy charges instead is ADDITIVE and
// measured: PLAN_TRANSIENT_EXCESS_BYTES, the maximum observed
// (peak heap - idle baseline - plan peak) over the legs that survived.
//
// FIVE THINGS THIS MODULE DOES NOT CLAIM, stated so nobody over-reads it:
//  (a) jsHeapSizeLimit does NOT bound what this module budgets. PROVEN on the
//      development box: 4,096 MiB of Uint16Array allocated and filled under a
//      3,586 MiB jsHeapSizeLimit, no RangeError, renderer RSS 4,172 MiB. Every
//      byte the plan prices is an ArrayBuffer backing store, which V8
//      allocates OUTSIDE that limit. The headroom offer is a proxy, not a
//      ceiling.
//  (b) the live usedJSHeapSize is coarse and rate-limited in real browsers, so
//      "headroom" can be minutes stale — harmless in a fresh tab, wrong after
//      a run switch. TASK-3013's --enable-precise-memory-info fixes the RIG
//      only; it does not change what a user's Chrome reports.
//      APP_BASELINE_FLOOR_BYTES is the guard on exactly this hole.
//  (c) a plan that FITS THE BUDGET is not a prediction that THE TAB WILL
//      SURVIVE — see clause 12's second deliberate asymmetry, and the W0.4 leg
//      that died at 1078.2 MiB of heap on a plan whose verdict was 'ok'.
//  (d) the ceiling is a SAFETY control, not a tuning knob (operator ruling
//      q-3). No runtime override may raise a deeper-than-HEAD plan above the
//      effective ceiling; RULE C clause 17 sanitises every override in this
//      module for that reason.
//  (e) the big-store outcome is NOT solved here. At the ruled ceiling the
//      944.8 MiB chunk-2 fill is unreachable at every budget; that win belongs
//      to W3.0's spatially reordered export (fewer bytes), not to a deeper
//      window.
// ============================================================================

/** The share of this tab's REMAINING heap playback may plan against. */
export const HEAP_HEADROOM_BUDGET_FRACTION = 0.45;
/** The share of the device's reported RAM playback may plan against. */
export const DEVICE_MEMORY_BUDGET_FRACTION = 0.20;
/**
 * The ceiling on the derived budget. 2 GiB is not a memory limit so much as a
 * statement about diminishing returns: past it the plan is already holding
 * every chunk of every store we produce, and the extra slots buy nothing.
 */
export const PLAYBACK_HEAP_BUDGET_MAX_BYTES = 2048 * 1024 * 1024;
// --- RULE C, TASK-2984 clause 17: the bands every runtime override is
// sanitised against, IN THIS MODULE, so no future transport (the W4.5
// per-tester URL param, the per-site admin valve) can bypass the clamp.
/** [lo, hi] inclusive — hi is the largest budget this module can ever resolve. */
export const PLAN_TRANSIENT_EXCESS_BAND_BYTES = [0, PLAYBACK_HEAP_BUDGET_MAX_BYTES];
/** [lo, hi] inclusive — hi is the largest budget this module can ever resolve. */
export const PLAN_UNCAP_MAX_PEAK_BAND_BYTES = [0, PLAYBACK_HEAP_BUDGET_MAX_BYTES];
/**
 * [lo, hi] inclusive — hi is the shipped budget constant (800 MiB), 2.9x the
 * largest idle baseline ever measured (280.3 MiB). A floor above it cannot be
 * meaningful: it would zero the heap offer on every machine.
 */
export const APP_BASELINE_FLOOR_BAND_BYTES = [0, PLAYBACK_HEAP_BUDGET_BYTES];

/**
 * RULE C clause 17 — honour a runtime override ONLY if it is a finite number
 * inside its exported band; otherwise use the shipped constant.
 *
 * Zero is in band for all three and is SAFE, not dangerous: E = 0 or
 * ceiling = 0 collapses the window budget, so clause 9's max() simply returns
 * HEAD's own plan. There is no in-band value that can make a plan deeper than
 * the EFFECTIVE ceiling allows — that invariant is swept in the specs.
 *
 * @param {*} value the caller's (possibly hostile) value
 * @param {number[]} band [lo, hi], inclusive
 * @param {number} shipped the constant to fall back to
 * @returns {number}
 */
function sanitiseOverride(value, band, shipped) {
    return (typeof value === 'number' && isFinite(value) && value >= band[0] && value <= band[1])
        ? value
        : shipped;
}

/**
 * TASK-2984 RULE A clause 5 — the coarse phone class, as a PURE predicate.
 *
 * BOTH CLAUSES ARE LOAD-BEARING. `maxTouchPoints > 0` alone misfires on
 * touchscreen laptops (the box this epic was developed on is one, and karma
 * runs in a real browser there). `uaMobile` alone is Chromium-only and never
 * fires on the iOS Safari case the predicate exists for — which is also the
 * case with NO memory signals at all, so it is the one that most needs
 * catching.
 *
 * KNOW WHERE THE KNIFE-EDGE IS: karma runs ChromeHeadlessCI with no
 * --window-size, so the headless viewport's minimum dimension is at or below
 * 600 and the `viewportMinPx <= 600` half is ALREADY TRUE in the test browser.
 * Only `maxTouchPoints === 0` keeps the predicate false under karma. The specs
 * pin the test environment itself for that reason: a future runner change that
 * gives the test browser touch points must show up as ONE named failure, not
 * as five unrelated budget specs going red.
 *
 * @param {object} [signals]
 * @param {boolean} [signals.uaMobile] navigator.userAgentData?.mobile
 * @param {number} [signals.maxTouchPoints] navigator.maxTouchPoints
 * @param {number} [signals.viewportMinPx] Math.min(innerWidth, innerHeight)
 * @returns {boolean}
 */
export function isCoarsePhoneClass({ uaMobile, maxTouchPoints, viewportMinPx } = {}) {
    return uaMobile === true || (maxTouchPoints > 0 && viewportMinPx <= 600);
}

/**
 * The heap budget THIS machine can pay for.
 *
 * All inputs are optional and every one of them is absent in karma and in some
 * real browser; with none of them, this returns exactly
 * `{budgetBytes: PLAYBACK_HEAP_BUDGET_BYTES, source: 'default'}` — the shipped
 * value, byte for byte.
 *
 * TASK-2984 (W1.1, epic 2981) CHANGED THIS FUNCTION IN TWO WAYS:
 *
 *  1. THE HEAP OFFER CHARGES THE APPLICATION BASELINE AT LEAST ONCE. The
 *     reading it nets — usedJSHeapSize — is coarse, rate-limited and can read
 *     near-zero in a fresh tab, so it is floored at APP_BASELINE_FLOOR_BYTES.
 *     THE deviceMemory OFFER IS DELIBERATELY LEFT ALONE: that offer is a
 *     statement about the MACHINE, not about this tab, and netting a
 *     per-tab baseline out of it is a category error (it would also move the
 *     pessimistic-signal case from 1228.8 to 1013.8 MiB, and that spec is
 *     correct as it stands).
 *
 *  2. THE 800 MiB FLOOR NO LONGER APPLIES TO A SMALL DEVICE. clamp()'s lo is
 *     a FLOOR, so before this task min(offers) was floored UP to 800 MiB on
 *     every device — a phone whose own signals offered 163 MiB was handed 800
 *     and downloaded 63 MB of geometry. When any offer exists AND the device
 *     says it is small (deviceMemory <= SMALL_DEVICE_MEMORY_GIB) OR the coarse
 *     phone class fires, the budget is clamped to
 *     [SMALL_DEVICE_MIN_BUDGET_BYTES, PLAYBACK_HEAP_BUDGET_MAX_BYTES] instead.
 *
 *     THE PHONE-CLASS DISJUNCT IS NOT DECORATION. Chrome on any Android device
 *     with >= 6 GB RAM reports navigator.deviceMemory 8, so a
 *     deviceMemory-only test never fires for a large and growing share of real
 *     phones. Consulting the phone class only when signals are ABSENT (an
 *     earlier draft) leaves exactly that hole open.
 *
 * @param {object} [signals]
 * @param {number} [signals.jsHeapSizeLimit] performance.memory.jsHeapSizeLimit, bytes
 * @param {number} [signals.usedJSHeapSize] performance.memory.usedJSHeapSize, bytes —
 *   what the tab is ALREADY holding; the budget is spent out of what is left
 * @param {number} [signals.deviceMemoryGiB] navigator.deviceMemory, GiB
 * @param {boolean} [signals.uaMobile] navigator.userAgentData?.mobile
 * @param {number} [signals.maxTouchPoints] navigator.maxTouchPoints
 * @param {number} [signals.viewportMinPx] Math.min(innerWidth, innerHeight)
 * @param {number} [signals.appBaselineFloorBytes=APP_BASELINE_FLOOR_BYTES] RULE C
 * @returns {{budgetBytes: number, source: string, appBaselineFloorBytes: number,
 *   overrideSource: string}}
 *   `source` is one of FIVE values: 'default', 'heap+device', 'partial',
 *   'small-device', 'phone-class'. `overrideSource` (TASK-3032) is a SEPARATE
 *   field — 'shipped' | 'override' — saying whether the EFFECTIVE
 *   appBaselineFloorBytes came from the caller or from the shipped constant.
 *   It is not a sixth `source` value: a consumer switching on `source` is
 *   unaffected.
 */
export function resolvePlaybackHeapBudget({
    jsHeapSizeLimit,
    usedJSHeapSize,
    deviceMemoryGiB,
    uaMobile,
    maxTouchPoints,
    viewportMinPx,
    appBaselineFloorBytes: appBaselineFloorBytesIn = APP_BASELINE_FLOOR_BYTES
} = {}) {
    const appBaselineFloorBytes = sanitiseOverride(
        appBaselineFloorBytesIn, APP_BASELINE_FLOOR_BAND_BYTES, APP_BASELINE_FLOOR_BYTES
    );
    // TASK-3032 (W4.x, epic 2981) — WHERE the effective floor came from.
    // `appBaselineFloorBytes` above already reports the value that was USED,
    // which is enough right up until the case that matters most: an override
    // REJECTED by the band clamp resolves to exactly APP_BASELINE_FLOOR_BYTES
    // and is byte-identical to no override at all. For the W4.5 tester rung
    // (TASK-3025) that makes three different bugs — the transport failed, the
    // parameter name was wrong, the clamp rejected the value — indistinguishable
    // in the census. Computed EXACTLY as computePlaybackMemoryPlan computes it
    // (clause 20), so the two halves of the seam answer in the same vocabulary.
    // It reports the EFFECTIVE value, not the caller's intent: an override that
    // equals the shipped constant reads 'shipped', because nothing moved.
    const overrideSource =
        appBaselineFloorBytes === APP_BASELINE_FLOOR_BYTES ? 'shipped' : 'override';
    const offers = [];
    if (jsHeapSizeLimit > 0) {
        // RULE A clause 1 — the baseline FLOORS THE READING. It is never
        // subtracted from the resolved budget: the line below already nets
        // live usage, and PLAN_TRANSIENT_EXCESS_BYTES is frozen net of this
        // same baseline, so subtracting it again charges the idle tab twice.
        const used = Math.max(usedJSHeapSize > 0 ? usedJSHeapSize : 0, appBaselineFloorBytes);
        offers.push(Math.max(0, jsHeapSizeLimit - used) * HEAP_HEADROOM_BUDGET_FRACTION);
    }
    if (deviceMemoryGiB > 0) {
        offers.push(deviceMemoryGiB * 1024 * 1024 * 1024 * DEVICE_MEMORY_BUDGET_FRACTION);
    }
    const phoneClass = isCoarsePhoneClass({ uaMobile, maxTouchPoints, viewportMinPx });
    if (!offers.length) {
        // RULE A clause 4 — iOS Safari and Firefox expose NEITHER signal, so
        // this branch is a large fraction of real traffic, not an edge case.
        return phoneClass
            ? { budgetBytes: PHONE_CLASS_BUDGET_BYTES, source: 'phone-class', appBaselineFloorBytes, overrideSource }
            : { budgetBytes: PLAYBACK_HEAP_BUDGET_BYTES, source: 'default', appBaselineFloorBytes, overrideSource };
    }
    const smallDevice = phoneClass
        || (typeof deviceMemoryGiB === 'number'
            && isFinite(deviceMemoryGiB)
            && deviceMemoryGiB <= SMALL_DEVICE_MEMORY_GIB);
    if (smallDevice) {
        // RULE A clause 2 — the budget may now go DOWN. The lo bound is
        // structural, not a preference: a stale or near-zero headroom reading
        // must not collapse the budget to nothing.
        return {
            budgetBytes: clamp(
                Math.floor(Math.min(...offers)),
                SMALL_DEVICE_MIN_BUDGET_BYTES,
                PLAYBACK_HEAP_BUDGET_MAX_BYTES
            ),
            source: 'small-device',
            appBaselineFloorBytes,
            overrideSource
        };
    }
    // RULE A clause 3 — unchanged from TASK-2743.
    const budgetBytes = clamp(
        Math.floor(Math.min(...offers)),
        PLAYBACK_HEAP_BUDGET_BYTES,
        PLAYBACK_HEAP_BUDGET_MAX_BYTES
    );
    return {
        budgetBytes,
        source: offers.length === 2 ? 'heap+device' : 'partial',
        appBaselineFloorBytes,
        overrideSource
    };
}

/**
 * The same, read off the live browser. Split from the pure function above so
 * every test drives the arithmetic directly and nothing has to stub a global.
 *
 * THIS IS STILL THE ONLY FUNCTION IN THIS MODULE THAT TOUCHES A GLOBAL, and it
 * must stay that way — RULE C clause 21 forbids getConfigProp, URLSearchParams,
 * localStorage, a `window` or `store.getState()` read, and any module-level
 * `let` or settable anywhere in this file. Karma runs every playback spec in
 * ONE webpack bundle and playbackMemoryPolicy-test.js has zero reset hooks
 * under byte-exact assertions, so a leaked module-level override would produce
 * order-dependent failures across ~30 specs.
 *
 * @param {object} [overrides] RULE C — passed straight through to
 *   resolvePlaybackHeapBudget; in TASK-2984 the only writer builds `{}`.
 * @returns {{budgetBytes: number, source: string, saveData: boolean,
 *   appBaselineFloorBytes: number, overrideSource: string}}
 *   TASK-3032 — `overrideSource` rides through on the `...resolved` spread
 *   below, so the environment reader and the pure resolver report the same
 *   answer and a prod census taken through either can falsify itself.
 */
export function resolvePlaybackHeapBudgetFromEnvironment(overrides = {}) {
    const perf = typeof performance !== 'undefined' ? performance : null;
    const nav = typeof navigator !== 'undefined' ? navigator : null;
    const win = typeof window !== 'undefined' ? window : null;
    const connection = nav && nav.connection;
    // THE SPREAD ORDER IS DELIBERATE AND IS A SAFETY PROPERTY, not style: the
    // overrides go FIRST, so the six MEASURED SIGNALS below always win. A
    // future transport (TASK-3025) cannot forge this machine's heap limit,
    // device memory or phone class through the override channel — the only
    // thing it can reach here is `appBaselineFloorBytes`, which is itself
    // band-clamped in resolvePlaybackHeapBudget. Reversing these two would
    // hand a URL parameter control of the budget's inputs.
    const resolved = resolvePlaybackHeapBudget({
        ...overrides,
        jsHeapSizeLimit: perf && perf.memory ? perf.memory.jsHeapSizeLimit : undefined,
        usedJSHeapSize: perf && perf.memory ? perf.memory.usedJSHeapSize : undefined,
        deviceMemoryGiB: nav ? nav.deviceMemory : undefined,
        uaMobile: nav && nav.userAgentData ? nav.userAgentData.mobile : undefined,
        maxTouchPoints: nav ? nav.maxTouchPoints : undefined,
        viewportMinPx: win ? Math.min(win.innerWidth, win.innerHeight) : undefined
    });
    // RULE B clause 11 — Save-Data is a USER'S stated preference about bytes,
    // not a memory signal, so it rides here rather than in the budget: it stops
    // the plan pre-rolling past the floor window and does nothing else.
    return { ...resolved, saveData: !!(connection && connection.saveData) };
}

/**
 * Per-node bytes the shipped mesh path holds for the store's static arrays:
 * node_x, node_y, elevation, friction, vertexInradius — five Float32.
 */
const GEOMETRY_BYTES_PER_NODE = 5 * 4;
/**
 * Per-face bytes: inradius (Float32, per face) + face_node_connectivity
 * (Int32, three per face).
 */
const GEOMETRY_BYTES_PER_FACE = 4 + 3 * 4;
/**
 * Per-node bytes the shipped RENDER path holds once the mesh is live: the
 * layer's private nodeX/nodeY clone (2 x Float32), the reprojected
 * x3857/y3857 the flow-viz overlay retains (2 x Float64), and frame0+frame1
 * (2 frames x 3 quantities x Float32).
 */
const RENDER_BYTES_PER_NODE = 2 * 4 + 2 * 8 + 2 * 3 * 4;
/** Identify's own lazily-built reprojection (2 x Float64), first Inspect click only. */
const IDENTIFY_BYTES_PER_NODE = 2 * 8;

/**
 * A planar triangulation has very close to two triangles per node (Euler);
 * run 1328 measures 6,779,432 / 3,393,075 = 1.998. Used ONLY when the caller
 * cannot yet know the real face count — the manifest declares chunk_shapes
 * for the quantized arrays (hence nNode) but not the mesh arrays' shapes, so
 * the plan is built at manifest-load from this estimate and REBUILT with the
 * exact nFace as soon as face_node_connectivity has landed
 * (playbackEpics -> PlaybackChunkFetcher.applyMemoryPlan).
 */
export const FACES_PER_NODE_ESTIMATE = 2;


/**
 * The node EXTENT of one chunk, from the quantized arrays' chunk_shapes
 * ([chunk_length_t, node_extent], TASK-2724's manifest block). Returns
 * undefined rather than guessing when the store declared nothing usable — the
 * caller falls back to the mesh's own length, which is only known later.
 *
 * NOT the array's node count, despite the name — TASK-2729. The two are equal
 * only because the exporter writes a SINGLE node chunk; on a node-chunked
 * store this is Nc, not N. That is fine HERE, because the only consumer sizes
 * a cache and a too-small chunk estimate is a conservative one. It is NOT fine
 * as a guard: this takes the FIRST usable value across QUANTITY_ARRAYS, so a
 * store where only y_velocity is node-chunked returns depth's value and looks
 * healthy. The guard lives in playbackChunkShape.assertNodeExtentMatchesMesh
 * and compares EVERY array; do not build one on this function.
 *
 * @param {object} manifest
 * @returns {number|undefined}
 */
export function readNodeCount(manifest) {
    const shapes = (manifest && manifest.chunk_shapes) || {};
    return QUANTITY_ARRAYS
        .map((name) => (Array.isArray(shapes[name]) ? shapes[name][1] : undefined))
        .find((n) => typeof n === 'number' && isFinite(n) && n > 0);
}

/**
 * The bytes this mesh costs no matter what the time-series policy is — see
 * PROOF 4 note 5. Split out so a test (and a future reviewer) can see each
 * term rather than one opaque total.
 * @param {{nNode: number, nFace?: number}} store
 */
export function fixedResidencyBytes({ nNode, nFace }) {
    const faces = nFace > 0 ? nFace : Math.round(nNode * FACES_PER_NODE_ESTIMATE);
    const geometryBytes = GEOMETRY_BYTES_PER_NODE * nNode + GEOMETRY_BYTES_PER_FACE * faces;
    const renderBytes = RENDER_BYTES_PER_NODE * nNode;
    return {
        nFace: faces,
        geometryBytes,
        renderBytes,
        onDemandIdentifyBytes: IDENTIFY_BYTES_PER_NODE * nNode,
        total: geometryBytes + renderBytes
    };
}

/**
 * THE plan. Everything the data plane needs to know about how much of this
 * store it may hold, derived from the store's own shape.
 *
 * `bytesPerResidentElement` and `forceChunksPerQuantity` are overridable ONLY
 * so a test can price the pre-fix shape (Float32 residency, a fixed 64 MiB
 * ceiling, radius 2) with the same arithmetic as the fix and show it blowing
 * the same budget — see playbackMemoryPolicy-test.js PROOF 1. Production never
 * passes them.
 *
 * ===========================================================================
 * TASK-2984 (W1.1, epic 2981) — THE RULE, IN TWO SENTENCES.
 *
 *   Plan the window HEAD would plan, then DEEPEN it as far as a measured
 *   budget holds, under a hard ceiling on the planned peak.
 *   A plan may never be SHALLOWER than HEAD's at the same budget.
 *
 * The arithmetic:
 *   todaysN     = exactly what HEAD computes (kept verbatim, so the monotone
 *                 property is PROVABLE rather than argued)
 *   windowBudget= min(budgetBytes - planTransientExcessBytes, uncapMaxPeakBytes)
 *   deepN       = clamp(floor((windowBudget - fixedBytes) / perChunkAcrossQ),
 *                       MIN_CHUNKS_PER_QUANTITY,
 *                       min(totalChunks, callerUpperBound))
 *   chunksPerQuantity = max(todaysN, deepN)
 *
 * THE TWO BOUNDS IN windowBudget ARE INDEPENDENT AND BOTH LOAD-BEARING:
 * subtracting E keeps the REAL tab inside the device's budget (without it a
 * 256 MiB phone budget buys 813_417_1412's whole store); the ceiling keeps the
 * PLANNED peak below what a browser has actually been observed to survive
 * (without it the prod chunk-10 shape reaches 4 slots at a 1667 MiB budget —
 * the 1,100 MiB whole-store plan that drove a renderer to 3.4 GB RSS and
 * stopped answering CDP). Deleting either term turns a spec red, on purpose.
 *
 * THERE IS NO THIRD TERM. APP_BASELINE_FLOOR_BYTES does NOT appear in this
 * arithmetic. It is charged exactly once, inside resolvePlaybackHeapBudget,
 * and PLAN_TRANSIENT_EXCESS_BYTES is frozen NET of it. `budgetBytes -
 * APP_BASELINE_FLOOR_BYTES` here would charge the idle tab twice and is the
 * form the operator's ruling was adjudicated AGAINST.
 *
 * THE DEEPENING IS PARTIAL. A store may be held to ANY depth the budget
 * affords; it does not have to be held whole. 813_417_1412 goes 3 -> 11 of 11
 * at the shipped 800 MiB default and 741_410_1328_chunk1 goes 3 -> 6 of 31 at
 * 1371 MiB. Whole-or-nothing was tried and removed: it deepened no real store
 * on any device.
 * ===========================================================================
 *
 * @param {object} store
 * @param {number} store.nNode nodes per timestep (manifest.chunk_shapes[q][1])
 * @param {number} [store.nFace] triangles; estimated from nNode when unknown
 * @param {number} store.chunkLengthT the store's own time-chunk length (resolveChunkLengthT)
 * @param {number} [store.totalChunks] the store's chunk count; deepening needs it
 * @param {number} [store.budgetBytes=PLAYBACK_HEAP_BUDGET_BYTES]
 * @param {number} [store.quantityCount=QUANTITY_ARRAYS.length]
 * @param {number} [store.bytesPerResidentElement=STORED_BYTES_PER_ELEMENT]
 * @param {number} [store.maxChunksPerQuantity] an optional UPPER bound (TASK-2743).
 *   IT HAS NO DEFAULT, DELIBERATELY — see the destructuring comment below.
 * @param {number} [store.forceChunksPerQuantity] test-only override
 * @param {boolean} [store.saveData] navigator.connection.saveData — do not pre-roll
 * @param {number} [store.planTransientExcessBytes=PLAN_TRANSIENT_EXCESS_BYTES] RULE C
 * @param {number} [store.uncapMaxPeakBytes=PLAN_UNCAP_MAX_PEAK_BYTES] RULE C
 * @param {number} [store.appBaselineFloorBytes=APP_BASELINE_FLOOR_BYTES] RULE C —
 *   ECHOED ONLY. It takes no part in this function's arithmetic; it is carried
 *   so one `policyOverrides` object can be spread into all three call sites and
 *   a prod census can read back the floor the budget resolution actually used.
 * @returns {object} the plan
 */
export function computePlaybackMemoryPlan({
    nNode,
    nFace,
    chunkLengthT,
    totalChunks,
    budgetBytes = PLAYBACK_HEAP_BUDGET_BYTES,
    quantityCount = QUANTITY_ARRAYS.length,
    bytesPerResidentElement = STORED_BYTES_PER_ELEMENT,
    // TASK-2743 UAT-08 — a caller may ask for a SHALLOWER window than the
    // policy plans (a constrained embed, a test). It survives TASK-2984 as an
    // optional UPPER bound and is never clamped to the floor window.
    //
    // *** THIS PARAMETER HAS NO DEFAULT, AND THAT IS DELIBERATE (clause 7b).
    // It used to read `maxChunksPerQuantity = MAX_CHUNKS_PER_QUANTITY`. Both
    // production call sites in playbackEpics.js OMIT the argument, so with the
    // default in place `callerUpperBound` below would be 3 for every real
    // caller, `deepN` could never exceed 3, and THIS WHOLE TASK WOULD BE A
    // SILENT NO-OP WITH EVERY EXISTING TEST STILL GREEN. `requestedMax` below
    // already handles `undefined` correctly, so removing it changes nothing
    // else. Contrast RULE C's defaults, which are SAFE for exactly the reason
    // this one was not: they ARE the shipped constants, so an omitting caller
    // gets precisely the intended arithmetic.
    maxChunksPerQuantity,
    forceChunksPerQuantity,
    saveData,
    // --- RULE C: the runtime-tunable seam. The W4.5 task (TASK-3025) resolves
    // these from a per-tester URL param and a per-site admin row; here they are
    // named optional inputs defaulting to the shipped constants, sanitised
    // where they are destructured so no transport can ever bypass the bands.
    planTransientExcessBytes: planTransientExcessBytesIn = PLAN_TRANSIENT_EXCESS_BYTES,
    uncapMaxPeakBytes: uncapMaxPeakBytesIn = PLAN_UNCAP_MAX_PEAK_BYTES,
    appBaselineFloorBytes: appBaselineFloorBytesIn = APP_BASELINE_FLOOR_BYTES
} = {}) {
    if (!(nNode > 0) || !(chunkLengthT > 0)) {
        throw new Error(
            `computePlaybackMemoryPlan: needs the store's own nNode and chunkLengthT ` +
            `(got nNode=${nNode}, chunkLengthT=${chunkLengthT}). There is no default — a ` +
            'guessed footprint is how the fixed 64 MiB ceiling froze the tab (TASK-2708).'
        );
    }
    const planTransientExcessBytes = sanitiseOverride(
        planTransientExcessBytesIn, PLAN_TRANSIENT_EXCESS_BAND_BYTES, PLAN_TRANSIENT_EXCESS_BYTES
    );
    const uncapMaxPeakBytes = sanitiseOverride(
        uncapMaxPeakBytesIn, PLAN_UNCAP_MAX_PEAK_BAND_BYTES, PLAN_UNCAP_MAX_PEAK_BYTES
    );
    const appBaselineFloorBytes = sanitiseOverride(
        appBaselineFloorBytesIn, APP_BASELINE_FLOOR_BAND_BYTES, APP_BASELINE_FLOOR_BYTES
    );
    // RULE C clause 20 — 'shipped' vs 'override' is what lets a prod census
    // tell "my override took" from "my override was clamped away". Without it
    // such a census cannot falsify its own result.
    const overrideSource = (
        planTransientExcessBytes === PLAN_TRANSIENT_EXCESS_BYTES
        && uncapMaxPeakBytes === PLAN_UNCAP_MAX_PEAK_BYTES
        && appBaselineFloorBytes === APP_BASELINE_FLOOR_BYTES
    ) ? 'shipped' : 'override';

    const fixed = fixedResidencyBytes({ nNode, nFace });
    const storedChunkBytes = chunkLengthT * nNode * bytesPerResidentElement;
    const perChunkAcrossQuantities = quantityCount * storedChunkBytes;
    const timeSeriesBudget = Math.max(0, budgetBytes - fixed.total);
    const affordable = Math.floor(timeSeriesBudget / perChunkAcrossQuantities);

    // --- RULE B clause 6: todaysN, EXACTLY what HEAD computes, kept verbatim.
    // A store with only one chunk cannot be given two, and asking for more
    // chunks than exist just wastes ceiling.
    const requestedMax = clamp(
        maxChunksPerQuantity > 0 ? Math.floor(maxChunksPerQuantity) : FLOOR_WINDOW_CHUNKS_PER_QUANTITY,
        MIN_CHUNKS_PER_QUANTITY,
        FLOOR_WINDOW_CHUNKS_PER_QUANTITY
    );
    const hardMax = totalChunks > 0
        ? Math.min(requestedMax, totalChunks)
        : requestedMax;
    const todaysChunksPerQuantity = clamp(affordable, Math.min(MIN_CHUNKS_PER_QUANTITY, hardMax), hardMax);

    // --- RULE B clauses 7-8: the deepening.
    const windowBudgetBytes = Math.min(budgetBytes - planTransientExcessBytes, uncapMaxPeakBytes);
    // maxChunksPerQuantity bounds the DEEP path from above too, but it is NOT
    // clamped to the floor window here — that is the whole point of clause 15.
    const callerUpperBound = maxChunksPerQuantity > 0
        ? Math.max(MIN_CHUNKS_PER_QUANTITY, Math.floor(maxChunksPerQuantity))
        : Infinity;
    // Only computed when the store told us how many chunks it has. A store
    // that did not is a REAL PRODUCTION PATH, not a defensive branch: the
    // epic's `totalChunks0` is undefined for every format_version-1 store
    // (741_410_1328/zarr.json declares n_time null), and an unbounded ceiling
    // would plan ~2.3 million slots on the karma fixture.
    const deepChunksPerQuantity = totalChunks > 0
        ? clamp(
            Math.floor((windowBudgetBytes - fixed.total) / perChunkAcrossQuantities),
            MIN_CHUNKS_PER_QUANTITY,
            Math.min(totalChunks, callerUpperBound)
        )
        : null;

    // --- RULE B clause 9. THE max() IS WHAT MAKES IT MONOTONE: the plan can
    // only ever be DEEPER than HEAD's at the same budget, never shallower.
    // saveData is a user's stated preference about bytes, so it holds the plan
    // at the floor window — that is its ONLY implementation.
    const chunksPerQuantity = forceChunksPerQuantity > 0
        ? forceChunksPerQuantity
        : (saveData || !(totalChunks > 0))
            ? todaysChunksPerQuantity
            : Math.max(todaysChunksPerQuantity, deepChunksPerQuantity);

    const bufferWindowRadius = Math.min(1, Math.floor((chunksPerQuantity - 1) / 2));
    const bufferWindowAhead = chunksPerQuantity - 1 - bufferWindowRadius;
    const cacheMaxBytes = quantityCount * chunksPerQuantity * storedChunkBytes;
    const peakResidentBytes = fixed.total + cacheMaxBytes;
    const wholeStorePeakBytes = totalChunks > 0
        ? fixed.total + quantityCount * totalChunks * storedChunkBytes
        : null;

    // --- RULE B clause 12: THE VERDICT.
    //
    // NOTE THE DELIBERATE ASYMMETRY, AND DO NOT "CORRECT" IT: the FLOOR WINDOW
    // constant is 3, but the verdict is judged at MIN_CHUNKS_PER_QUANTITY = 2,
    // the STRUCTURAL floor below which playback cannot function at all. Judging
    // at 3 would move chunk-2's floor-window peak from 401.1 to 439.9 MiB and
    // the 14.6 M-node synthetic's from 1724.5 to 1891.4 MiB, flipping a store
    // that fits into one that is refused.
    const structuralFloorSlots = Math.min(MIN_CHUNKS_PER_QUANTITY, totalChunks || MIN_CHUNKS_PER_QUANTITY);
    const floorWindowPlanPeakBytes = fixed.total + quantityCount * structuralFloorSlots * storedChunkBytes;
    const verdict = floorWindowPlanPeakBytes > budgetBytes ? 'fallback' : 'ok';
    // A SECOND DELIBERATE ASYMMETRY, AND THE HONEST LIMIT OF THIS MODULE: the
    // VERDICT is judged against the GROSS budgetBytes, while the DEEPENING is
    // judged against budgetBytes - planTransientExcessBytes. Charging E to the
    // verdict too produces a rule that refuses everything on a phone.
    //
    // SO: verdict 'ok' means THE PLAN FITS THE BUDGET. It does NOT mean THE TAB
    // WILL SURVIVE. TASK-3013's W0.4 rig measured 741_410_1328_chunk2 at an
    // 800 MiB budget — verdict 'ok', floor-window peak 401.1 MiB, window 440.0
    // MiB — reaching 1078.2 MiB of heap and DYING inside a 1536 MiB cgroup.
    // `floorWindowPlanPeakBytes` and `planTransientExcessBytes` are both
    // exposed so a consumer can compute the pessimistic total itself.
    const fallbackReason = verdict === 'fallback'
        ? (fixed.total > budgetBytes ? 'fixed-mesh-exceeds-budget' : 'floor-window-exceeds-budget')
        : null;

    return {
        nNode,
        nFace: fixed.nFace,
        chunkLengthT,
        quantityCount,
        bytesPerResidentElement,
        storedChunkBytes,
        geometryBytes: fixed.geometryBytes,
        renderBytes: fixed.renderBytes,
        onDemandIdentifyBytes: fixed.onDemandIdentifyBytes,
        fixedBytes: fixed.total,
        timeSeriesBudget,
        affordableChunksPerQuantity: affordable,
        maxChunksPerQuantity: requestedMax,
        chunksPerQuantity,
        bufferWindowRadius,
        bufferWindowAhead,
        cacheMaxBytes,
        peakResidentBytes,
        budgetBytes,
        withinBudget: peakResidentBytes <= budgetBytes,
        // --- TASK-2984 clause 13. `deepChunksPerQuantity` is what the budget
        // alone would buy; `chunksPerQuantity` is that or HEAD's, whichever is
        // deeper. TASK-2986 reads `verdict`/`fallbackReason`/
        // `floorWindowPlanPeakBytes`; TASK-2995 and the prod census read the
        // rest. There is no correctedAffordableChunksPerQuantity, no
        // planUnderstatementFactor and no uncapEligible — those belonged to
        // rules this task removed.
        wholeStorePeakBytes,
        floorWindowPlanPeakBytes,
        windowBudgetBytes,
        deepChunksPerQuantity,
        planTransientExcessBytes,
        uncapMaxPeakBytes,
        appBaselineFloorBytes,
        overrideSource,
        verdict,
        fallbackReason,
        saveData: !!saveData
    };
}

/** Human-readable one-liner for a log line or a test failure message. */
export function describePlan(plan) {
    const mib = (b) => `${(b / 1048576).toFixed(1)} MiB`;
    return [
        `nNode=${plan.nNode} nFace=${plan.nFace} chunkLengthT=${plan.chunkLengthT}`,
        `chunk=${mib(plan.storedChunkBytes)} x ${plan.quantityCount} quantities`,
        `slots=${plan.chunksPerQuantity} (behind ${plan.bufferWindowRadius}, ahead ${plan.bufferWindowAhead})`,
        `cache=${mib(plan.cacheMaxBytes)} fixed=${mib(plan.fixedBytes)}`,
        `peak=${mib(plan.peakResidentBytes)} / budget ${mib(plan.budgetBytes)}`
    ].join(' | ');
}

/**
 * The stable, greppable prefix every "this plan does not fit" breadcrumb
 * carries (TASK-2732, W3, epic 2706).
 *
 * ONE definition, so the emitted line, the spec that asserts it and W4's
 * telemetry work (TASK-2712..2714) all read the same string rather than each
 * carrying its own regex over prose. It keeps the `[playback] ` convention the
 * TASK-2744 AC20 score line already uses — so both console breadcrumbs grep
 * together — while `memory plan OVER BUDGET` stays unique to this one, which
 * is what makes a prefix-filtered warn count unambiguous.
 *
 * The POLICY stays pure: it defines the string, it never emits it. The warn
 * lives at playbackEpics.js's manifest-time plan seam, the only production
 * caller of computePlaybackMemoryPlan.
 */
export const PLAYBACK_BUDGET_WARN_PREFIX = '[playback] memory plan OVER BUDGET —';

export default computePlaybackMemoryPlan;
