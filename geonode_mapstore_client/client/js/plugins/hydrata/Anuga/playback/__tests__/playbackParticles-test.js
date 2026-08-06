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
    PARTICLE_ADVECT_FRAGMENT_SHADER
} from '../playbackParticles';

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
});
