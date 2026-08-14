/*
 * Copyright 2026, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

/* TASK-2633 (W5.2, epic 2618) — playbackParticles tests: the headless
 * spawn/kill, speed-scaling, and camera-key math (AC: wet mask + boundary
 * behaviour correct, speed-exaggeration + density controls work), plus
 * GLSL<->JS formula parity (mirrors playbackShaders-test.js's technique). */
import expect from 'expect';
import {
    PARTICLE_BASE_SPEED_SCALE,
    DEFAULT_SPEED_EXAGGERATION,
    DEFAULT_PARTICLE_GRID,
    MIN_PARTICLE_GRID,
    MAX_PARTICLE_GRID,
    PARTICLE_MIN_SPEED,
    PARTICLE_DROP_RATE,
    PARTICLE_STALL_DROP_RATE,
    computeAdvectionSpeedScale,
    clampParticleGrid,
    isParticleFlowing,
    pickRespawnRate,
    buildCameraKey,
    hasCameraMoved,
    initialParticlePositions,
    composePosToClipMatrix,
    PARTICLE_ADVECT_FRAGMENT_SHADER,
    PARTICLE_RENDER_VERTEX_SHADER,
    // TASK-2743 UAT-02 (W6, epic 2706) — seed and cull against the view.
    PARTICLE_RESPAWN_VIEW_MARGIN,
    PARTICLE_CULL_VIEW_MARGIN,
    FULL_UV_RECT,
    computeParticleViewRects,
    isParticleInView
} from '../playbackParticles';
import { buildProjectionMatrix, applyProjectionMatrix } from '../playbackMeshGeometry';
import { computeBboxOrtho, worldToVelocityUv } from '../playbackFlowViz';

describe('playbackParticles', () => {
    describe('computeAdvectionSpeedScale (the "speed exaggeration" control)', () => {
        it('the default exaggeration (1) yields the base scale', () => {
            expect(computeAdvectionSpeedScale(DEFAULT_SPEED_EXAGGERATION)).toBe(PARTICLE_BASE_SPEED_SCALE);
        });

        it('scales linearly with the exaggeration multiplier', () => {
            expect(computeAdvectionSpeedScale(2)).toBe(PARTICLE_BASE_SPEED_SCALE * 2);
            expect(computeAdvectionSpeedScale(0.5)).toBe(PARTICLE_BASE_SPEED_SCALE * 0.5);
        });

        it('falls back to the default for a falsy/zero exaggeration (never a zero/undefined scale)', () => {
            expect(computeAdvectionSpeedScale(0)).toBe(PARTICLE_BASE_SPEED_SCALE * DEFAULT_SPEED_EXAGGERATION);
            expect(computeAdvectionSpeedScale(undefined)).toBe(PARTICLE_BASE_SPEED_SCALE * DEFAULT_SPEED_EXAGGERATION);
        });
    });

    describe('clampParticleGrid (the "density" control)', () => {
        it('defaults to DEFAULT_PARTICLE_GRID when omitted', () => {
            expect(clampParticleGrid(undefined)).toBe(DEFAULT_PARTICLE_GRID);
        });

        it('clamps below MIN_PARTICLE_GRID up to the minimum', () => {
            expect(clampParticleGrid(1)).toBe(MIN_PARTICLE_GRID);
        });

        it('clamps above MAX_PARTICLE_GRID down to the maximum', () => {
            expect(clampParticleGrid(10000)).toBe(MAX_PARTICLE_GRID);
        });

        it('rounds a fractional value', () => {
            expect(clampParticleGrid(100.6)).toBe(101);
        });

        it('DEFAULT_PARTICLE_GRID^2 lands in the AC\'s "start modest (10-50k default)" range', () => {
            const count = DEFAULT_PARTICLE_GRID * DEFAULT_PARTICLE_GRID;
            expect(count).toBeGreaterThanOrEqualTo(10000);
            expect(count).toBeLessThanOrEqualTo(50000);
        });
    });

    describe('isParticleFlowing / pickRespawnRate (AC: "spawn/kill respecting the wet mask and mesh extent")', () => {
        it('a dry cell (depth <= wetThreshold) is never flowing, regardless of speed', () => {
            expect(isParticleFlowing(0.001, 0.005, 10)).toBe(false);
        });

        it('a wet but effectively-still cell (speed below minSpeed) is not flowing', () => {
            expect(isParticleFlowing(1, 0.005, 1e-6)).toBe(false);
        });

        it('a wet + flowing cell IS flowing', () => {
            expect(isParticleFlowing(1, 0.005, 0.5)).toBe(true);
        });

        it('an off-mesh UV reads back depth=0 from the velocity FBO clear colour — treated identically to a dry cell (this module\'s header — no separate bounds test needed)', () => {
            // depth=0, speed=0 is EXACTLY what a never-triangle-covered texel
            // in the velocity FBO reads back as (FLOWVIZ_VELOCITY_FRAGMENT_SHADER's
            // clear colour) — proving "mesh extent" and "wet mask" collapse
            // to the SAME check for spawn/kill purposes.
            expect(isParticleFlowing(0, 0.005, 0)).toBe(false);
        });

        it('pickRespawnRate returns the SLOW drop rate for a flowing particle (trails stay coherent)', () => {
            expect(pickRespawnRate(1, 0.005, 0.5)).toBe(PARTICLE_DROP_RATE);
        });

        it('pickRespawnRate returns the FAST stall rate for a dry/still/off-mesh particle (avoids the "frozen dots" W0 spike bug)', () => {
            expect(pickRespawnRate(0.001, 0.005, 10)).toBe(PARTICLE_STALL_DROP_RATE);
            expect(pickRespawnRate(1, 0.005, 1e-9)).toBe(PARTICLE_STALL_DROP_RATE);
        });
    });

    describe('buildCameraKey / hasCameraMoved (AC/wave brief: trails reset on camera move)', () => {
        it('the SAME viewState+size produces the SAME key', () => {
            const viewState = { center: [100, 200], resolution: 5, rotation: 0 };
            const size = [800, 600];
            expect(buildCameraKey(viewState, size)).toBe(buildCameraKey(viewState, size));
        });

        it('a pan (center change) changes the key', () => {
            const size = [800, 600];
            const k1 = buildCameraKey({ center: [100, 200], resolution: 5, rotation: 0 }, size);
            const k2 = buildCameraKey({ center: [101, 200], resolution: 5, rotation: 0 }, size);
            expect(hasCameraMoved(k1, k2)).toBe(true);
        });

        it('a zoom (resolution change) changes the key', () => {
            const size = [800, 600];
            const k1 = buildCameraKey({ center: [100, 200], resolution: 5, rotation: 0 }, size);
            const k2 = buildCameraKey({ center: [100, 200], resolution: 4, rotation: 0 }, size);
            expect(hasCameraMoved(k1, k2)).toBe(true);
        });

        it('a canvas resize changes the key', () => {
            const viewState = { center: [100, 200], resolution: 5, rotation: 0 };
            const k1 = buildCameraKey(viewState, [800, 600]);
            const k2 = buildCameraKey(viewState, [400, 300]);
            expect(hasCameraMoved(k1, k2)).toBe(true);
        });

        it('an unchanged camera pose does NOT report movement', () => {
            const viewState = { center: [100, 200], resolution: 5, rotation: 0.2 };
            const size = [800, 600];
            expect(hasCameraMoved(buildCameraKey(viewState, size), buildCameraKey(viewState, size))).toBe(false);
        });
    });

    describe('initialParticlePositions', () => {
        it('produces gridSize^2 RGBA texels, rg in [0,1), b=0, a=1', () => {
            const grid = 4;
            let calls = 0;
            const positions = initialParticlePositions(grid, () => {
                calls += 1;
                return 0.5;
            });
            expect(positions.length).toBe(grid * grid * 4);
            expect(calls).toBe(grid * grid * 2); // one r + one g draw per particle
            for (let i = 0; i < grid * grid; i++) {
                expect(positions[i * 4]).toBe(0.5);
                expect(positions[i * 4 + 1]).toBe(0.5);
                expect(positions[i * 4 + 2]).toBe(0);
                expect(positions[i * 4 + 3]).toBe(1);
            }
        });

        it('is deterministic for a given randomFn (testability)', () => {
            let n = 0;
            const seq = () => (n++ % 7) / 7;
            const a = initialParticlePositions(3, seq);
            n = 0;
            const b = initialParticlePositions(3, seq);
            expect(Array.from(a)).toEqual(Array.from(b));
        });
    });

    describe('composePosToClipMatrix (TASK-2661, W6.75.1 — "trails vertical-grid" fp32 fix)', () => {
        // Real Merewether S3-run fixture bbox (spec citation): an Australian
        // longitude, cx > 2^24 (16777216) where the OLD shader math's fp32
        // ULP is ~2m. cy is a representative NSW latitude (Merewether,
        // ~-32.95 deg) — its magnitude (~3.88e6) sits BELOW 2^24, which is
        // exactly why the live bug's screen-Y stayed sub-pixel while
        // screen-X snapped to a lattice (this module's header).
        const bboxOrtho = { cx: 16891852.555, cy: -3879000, halfW: 253.66, halfH: 253.66 };
        const viewState = { center: [bboxOrtho.cx, bboxOrtho.cy], resolution: 1, rotation: 0 };
        const sizeCssPx = [1000, 800];
        const projMatrix = buildProjectionMatrix(viewState, sizeCssPx);

        // Fround-simulates the OLD (buggy) shader exactly:
        //   localMeters = uBboxOrtho.xy + (pos*2-1)*uBboxOrtho.zw   (fp32 GPU ops)
        //   clip = uProj * vec3(localMeters, 1)                     (fp32 GPU ops)
        // uBboxOrtho/uProj are uploaded via gl.uniform*, which rounds every
        // component to fp32 on upload — Math.fround on each raw scalar
        // reproduces that rounding.
        function oldShaderScreenPx(u, v) {
            const fr = Math.fround;
            const cx = fr(bboxOrtho.cx);
            const cy = fr(bboxOrtho.cy);
            const halfW = fr(bboxOrtho.halfW);
            const halfH = fr(bboxOrtho.halfH);
            const m = Array.from(projMatrix, fr);
            const lmx = fr(cx + fr(fr(u * 2 - 1) * halfW));
            const lmy = fr(cy + fr(fr(v * 2 - 1) * halfH));
            const clipx = fr(fr(fr(m[0] * lmx) + fr(m[3] * lmy)) + m[6]);
            const clipy = fr(fr(fr(m[1] * lmx) + fr(m[4] * lmy)) + m[7]);
            return [
                fr((clipx * 0.5 + 0.5) * sizeCssPx[0]),
                fr((clipy * 0.5 + 0.5) * sizeCssPx[1])
            ];
        }

        // Fround-simulates the NEW shader: clip = uPosToClip * vec3(pos,1),
        // where uPosToClip is composePosToClipMatrix's JS-float64-composed
        // result (already an O(1)-magnitude Float32Array by construction —
        // no raw world coordinate ever reaches the GPU).
        function newShaderScreenPx(u, v, posToClip) {
            const fr = Math.fround;
            const m = posToClip; // already Float32Array (fp32)
            const clipx = fr(fr(fr(m[0] * u) + fr(m[3] * v)) + m[6]);
            const clipy = fr(fr(fr(m[1] * u) + fr(m[4] * v)) + m[7]);
            return [
                fr((clipx * 0.5 + 0.5) * sizeCssPx[0]),
                fr((clipy * 0.5 + 0.5) * sizeCssPx[1])
            ];
        }

        function maxAdjacentStep(values) {
            const sorted = [...new Set(values)].sort((a, b) => a - b);
            let max = 0;
            for (let i = 1; i < sorted.length; i++) {
                max = Math.max(max, sorted[i] - sorted[i - 1]);
            }
            return max;
        }

        // A dense sweep over 20% of the bbox in BOTH axes (spec's proof
        // methodology: "52 distinct screen-x ... vs 299 screen-y ... over
        // 20% of the bbox").
        const N = 2000;
        const samples = [];
        for (let i = 0; i < N; i++) {
            samples.push([0.4 + 0.2 * (i / N), 0.4 + 0.2 * ((i * 37 % N) / N)]);
        }

        it('CONTROL — the OLD math (raw uBboxOrtho/uProj fp32 reconstruction) quantizes screen-X to a multi-pixel lattice', () => {
            const xs = samples.map(([u, v]) => oldShaderScreenPx(u, v)[0]);
            const maxStepX = maxAdjacentStep(xs);
            // Measured (this fixture): ~3.9px steps — comfortably above 1px,
            // proving the OLD math fails the sub-pixel bar the NEW math must
            // clear below. Bound loosely (>1px) so the assertion tracks the
            // BUG'S CLASS, not an exact float-rounding coincidence.
            expect(maxStepX).toBeGreaterThan(1);
        });

        it('NEW — composePosToClipMatrix keeps distinct-screen-position steps sub-pixel in BOTH axes', () => {
            const posToClip = composePosToClipMatrix(bboxOrtho, projMatrix);
            const xs = samples.map(([u, v]) => newShaderScreenPx(u, v, posToClip)[0]);
            const ys = samples.map(([u, v]) => newShaderScreenPx(u, v, posToClip)[1]);
            expect(maxAdjacentStep(xs)).toBeLessThan(1);
            expect(maxAdjacentStep(ys)).toBeLessThan(1);
        });

        it('matches a JS-double reference projection (no precision regression vs the mathematically exact transform)', () => {
            const posToClip = composePosToClipMatrix(bboxOrtho, projMatrix);
            [[0.5, 0.5], [0.1, 0.9], [0.73, 0.22]].forEach(([u, v]) => {
                const localX = bboxOrtho.cx + (u * 2 - 1) * bboxOrtho.halfW;
                const localY = bboxOrtho.cy + (v * 2 - 1) * bboxOrtho.halfH;
                const [refClipX, refClipY] = applyProjectionMatrix(projMatrix, localX, localY);
                const [clipX, clipY] = applyProjectionMatrix(posToClip, u, v);
                expect(Math.abs(clipX - refClipX)).toBeLessThan(1e-4);
                expect(Math.abs(clipY - refClipY)).toBeLessThan(1e-4);
            });
        });
    });

    describe('PARTICLE_RENDER_VERTEX_SHADER GLSL<->JS wiring (TASK-2661)', () => {
        it('uses the single CPU-precomposed uPosToClip matrix, not a separate uProj/uBboxOrtho pair', () => {
            expect(PARTICLE_RENDER_VERTEX_SHADER).toMatch(/uniform mat3 uPosToClip;/);
            expect(PARTICLE_RENDER_VERTEX_SHADER).toNotMatch(/uProj/);
            expect(PARTICLE_RENDER_VERTEX_SHADER).toNotMatch(/uBboxOrtho/);
        });

        it('every GPU intermediate for the output position is now O(1) — one matrix multiply, no world-meter reconstruction', () => {
            expect(PARTICLE_RENDER_VERTEX_SHADER).toMatch(/vec3 clip = uPosToClip \* vec3\(pos, 1\.0\);/);
        });
    });

    describe('PARTICLE_ADVECT_FRAGMENT_SHADER GLSL<->JS formula parity', () => {
        it('the shader\'s advection step matches `pos + vel * dt * speedScale`, wrapped with fract()', () => {
            expect(PARTICLE_ADVECT_FRAGMENT_SHADER).toMatch(/pos = fract\(pos \+ vel \* uDt \* uSpeedScale\);/);
        });

        it('the shader\'s notFlowing test matches isParticleFlowing\'s inverse (dry OR still)', () => {
            expect(PARTICLE_ADVECT_FRAGMENT_SHADER).toMatch(/float dry = step\(depth, uWetThreshold\);/);
            expect(PARTICLE_ADVECT_FRAGMENT_SHADER).toMatch(/float still = step\(length\(vel\), uMinSpeed\);/);
            expect(PARTICLE_ADVECT_FRAGMENT_SHADER).toMatch(/float notFlowing = max\(dry, still\);/);
        });

        it('the shader mixes uDropRate/uStallDropRate by notFlowing — matches pickRespawnRate\'s two-way choice', () => {
            expect(PARTICLE_ADVECT_FRAGMENT_SHADER).toMatch(/float rate = mix\(uDropRate, uStallDropRate, notFlowing\);/);
        });
    });

    describe('module constants sanity', () => {
        it('MIN < DEFAULT < MAX for the particle grid range', () => {
            expect(MIN_PARTICLE_GRID).toBeLessThan(DEFAULT_PARTICLE_GRID);
            expect(DEFAULT_PARTICLE_GRID).toBeLessThan(MAX_PARTICLE_GRID);
        });

        it('PARTICLE_STALL_DROP_RATE is much larger than PARTICLE_DROP_RATE (fast recycle for non-flowing particles)', () => {
            expect(PARTICLE_STALL_DROP_RATE).toBeGreaterThan(PARTICLE_DROP_RATE * 10);
        });

        it('PARTICLE_MIN_SPEED is a small positive threshold', () => {
            expect(PARTICLE_MIN_SPEED).toBeGreaterThan(0);
            expect(PARTICLE_MIN_SPEED).toBeLessThan(0.01);
        });
    });

    // ── TASK-2743 UAT-02 (W6, epic 2706) ────────────────────────────────────
    // Particles were seeded uniform over the WHOLE square-padded run bbox while
    // a working view covers ~1% of it, so almost none were ever on screen, and
    // the stall-recycle asymmetry then piled the survivors into the wet 4%.
    describe('computeParticleViewRects (UAT-02: seed and cull against the view)', () => {
        // 4000 x 4000 m window -> computeBboxOrtho half 2000 (padFactor 1.0).
        const ortho = computeBboxOrtho([0, 0, 4000, 4000], 1.0);
        const centred = { center: [2000, 2000], resolution: 0.5, rotation: 0 };
        const size = [1000, 1000]; // -> a 500 x 500 m viewport

        it('sizes both rects from the view half-extent, margin as a DIRECT multiplier', () => {
            const { respawn, cull } = computeParticleViewRects(centred, size, ortho);
            expect(+respawn.du.toFixed(6)).toBe(0.1625); // 250 * 1.3 / 2000
            expect(+respawn.dv.toFixed(6)).toBe(0.1625);
            expect(+cull.du.toFixed(6)).toBe(0.25); // 250 * 2.0 / 2000
            expect(+respawn.u.toFixed(6)).toBe(0.41875);
            expect(+respawn.v.toFixed(6)).toBe(0.41875);
        });

        it('agrees with worldToVelocityUv about where the view centre is', () => {
            // Pins the mapping against the shipped one rather than trusting the
            // two to stay in step by inspection.
            const off = { center: [2500, 1500], resolution: 0.5, rotation: 0 };
            const { respawn } = computeParticleViewRects(off, size, ortho);
            const [cu, cv] = worldToVelocityUv(2500, 1500, ortho);
            expect(+(respawn.u + respawn.du / 2).toFixed(6)).toBe(+cu.toFixed(6));
            expect(+(respawn.v + respawn.dv / 2).toFixed(6)).toBe(+cv.toFixed(6));
        });

        it('the cull rect always CONTAINS the respawn rect, at every camera in a table', () => {
            // Respawning outside the cull rect would recycle at 0.30/frame
            // forever — the two rects must never invert.
            [0, Math.PI / 4, Math.PI / 3].forEach((rotation) => {
                [[2000, 2000], [800, 3200], [3900, 100], [2000, 3950]].forEach((center) => {
                    const { respawn, cull } = computeParticleViewRects({ center, resolution: 0.5, rotation }, size, ortho);
                    expect(cull.u <= respawn.u + 1e-9).toBe(true);
                    expect(cull.v <= respawn.v + 1e-9).toBe(true);
                    expect(cull.u + cull.du >= respawn.u + respawn.du - 1e-9).toBe(true);
                    expect(cull.v + cull.dv >= respawn.v + respawn.dv - 1e-9).toBe(true);
                });
            });
        });

        it('widens the rect under rotation — the view AABB, not the view rect', () => {
            const straight = computeParticleViewRects(centred, size, ortho).respawn;
            const turned = computeParticleViewRects({ ...centred, rotation: Math.PI / 4 }, size, ortho).respawn;
            expect(+(turned.du / straight.du).toFixed(5)).toBe(+Math.SQRT2.toFixed(5));
        });

        it('falls back to the FULL domain when the view is off the mesh entirely', () => {
            // The degeneracy that would otherwise stack all 43,264 particles on
            // one texel.
            const off = computeParticleViewRects({ center: [1e6, 1e6], resolution: 0.5, rotation: 0 }, size, ortho);
            expect({ ...off.respawn }).toEqual({ u: 0, v: 0, du: 1, dv: 1 });
            expect({ ...off.cull }).toEqual({ u: 0, v: 0, du: 1, dv: 1 });
            expect(FULL_UV_RECT.du).toBe(1);
        });

        it('is the full domain when zoomed out past the window — i.e. exactly today', () => {
            const wide = computeParticleViewRects({ center: [2000, 2000], resolution: 20, rotation: 0 }, size, ortho);
            expect({ ...wide.respawn }).toEqual({ u: 0, v: 0, du: 1, dv: 1 });
            expect({ ...wide.cull }).toEqual({ u: 0, v: 0, du: 1, dv: 1 });
        });

        it('returns the full domain for missing/degenerate inputs rather than throwing', () => {
            expect({ ...computeParticleViewRects(null, size, ortho).respawn }).toEqual({ u: 0, v: 0, du: 1, dv: 1 });
            expect({ ...computeParticleViewRects(centred, null, ortho).respawn }).toEqual({ u: 0, v: 0, du: 1, dv: 1 });
            expect({ ...computeParticleViewRects(centred, size, null).respawn }).toEqual({ u: 0, v: 0, du: 1, dv: 1 });
            expect({ ...computeParticleViewRects({ ...centred, resolution: 0 }, size, ortho).respawn }).toEqual({ u: 0, v: 0, du: 1, dv: 1 });
        });

        it('isParticleInView agrees with the shader\'s four step() tests on a 16x16 grid', () => {
            const { cull } = computeParticleViewRects(centred, size, ortho);
            const glsl = (u, v) => {
                const offLo = [u <= cull.u ? 1 : 0, v <= cull.v ? 1 : 0];
                const offHi = [cull.u + cull.du <= u ? 1 : 0, cull.v + cull.dv <= v ? 1 : 0];
                return Math.max(Math.max(offLo[0], offLo[1]), Math.max(offHi[0], offHi[1])) < 1;
            };
            let checked = 0;
            for (let i = 0; i < 16; i++) {
                for (let j = 0; j < 16; j++) {
                    const u = i / 15; const v = j / 15;
                    expect(isParticleInView(u, v, cull)).toBe(glsl(u, v));
                    checked++;
                }
            }
            expect(checked).toBe(256);
        });
    });

    describe('pickRespawnRate inView arm + the advect shader wiring (UAT-02)', () => {
        it('an off-view particle recycles at the STALL rate even when it is flowing', () => {
            expect(pickRespawnRate(1.0, 0.005, 0.5, PARTICLE_MIN_SPEED, PARTICLE_DROP_RATE, PARTICLE_STALL_DROP_RATE, false))
                .toBe(PARTICLE_STALL_DROP_RATE);
        });

        it('every pre-existing caller is unaffected — inView defaults true', () => {
            expect(pickRespawnRate(1.0, 0.005, 0.5)).toBe(PARTICLE_DROP_RATE);
            expect(pickRespawnRate(0.0, 0.005, 0.5)).toBe(PARTICLE_STALL_DROP_RATE);
        });

        it('the advect shader takes both rects and respawns inside the respawn rect', () => {
            const S = PARTICLE_ADVECT_FRAGMENT_SHADER;
            expect(S).toMatch(/uniform vec4 uRespawnRect;/);
            expect(S).toMatch(/uniform vec4 uCullRect;/);
            expect(S).toMatch(/vec2 respawn = uRespawnRect\.xy \+ vec2\(hash\(seed \+ 1\.3\), hash\(seed \+ 7\.7\)\) \* uRespawnRect\.zw;/);
            expect(S).toMatch(/notFlowing = max\(notFlowing, offView\);/);
        });

        it('the three pinned advect lines are still byte-identical', () => {
            const S = PARTICLE_ADVECT_FRAGMENT_SHADER;
            expect(S).toMatch(/pos = fract\(pos \+ vel \* uDt \* uSpeedScale\);/);
            expect(S).toMatch(/float notFlowing = max\(dry, still\);/);
            expect(S).toMatch(/float rate = mix\(uDropRate, uStallDropRate, notFlowing\);/);
        });

        it('LOCK: the advection frame did not move — no window argument was smuggled in', () => {
            // The tripwire against re-attempting the view-following velocity
            // window without its ~8.5x speed compensation.
            expect(computeAdvectionSpeedScale.length).toBe(1);
            expect(computeAdvectionSpeedScale(1)).toBe(PARTICLE_BASE_SPEED_SCALE);
            expect(PARTICLE_RESPAWN_VIEW_MARGIN < PARTICLE_CULL_VIEW_MARGIN).toBe(true);
        });
    });

});
