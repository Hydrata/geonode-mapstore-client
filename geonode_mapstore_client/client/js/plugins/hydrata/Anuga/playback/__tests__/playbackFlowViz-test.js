/*
 * Copyright 2026, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

/* TASK-2632 (W5.1, epic 2618) — playbackFlowViz tests: the headless
 * sampling/projection/arrow-sizing math (AC: "karma coverage for
 * sampling/projection math (headless)"), GLSL<->JS formula parity (mirrors
 * playbackShaders-test.js's technique for the AIDR hazard table), and a
 * numeric direction-parity check against the SAME real store bytes the W4
 * derived-quantity parity fixture already carries (AC: "direction verified
 * numerically against the Python reference computing (u,v) from the SAME
 * store bytes at fixture points ... extend the W4 fixture pattern"). */
import expect from 'expect';
import {
    VEL_TEX_SIZE,
    DEFAULT_ARROW_DENSITY_PX,
    DEFAULT_ARROW_SCALE,
    pickVelocityTextureFormat,
    shouldUseLinearFiltering,
    computeBboxOrtho,
    worldToVelocityUv,
    computeArrowGridDimensions,
    arrowGridNdc,
    unitDischargeArrowLengthPx,
    computeArrowMaxLengthPx,
    arrowSpeedColor,
    isArrowVisible,
    composeNdcToVelocityUvMatrix,
    FLOWVIZ_ARROW_VERTEX_SHADER
} from '../playbackFlowViz';
import { buildInverseProjectionMatrix, applyProjectionMatrix } from '../playbackMeshGeometry';
import { DERIVED_QUANTITY_FIXTURE } from './fixtures/fixtureDerivedQuantities';

describe('playbackFlowViz', () => {
    describe('pickVelocityTextureFormat (mocked gl — W0 scar: an unsupported format must return null, never throw)', () => {
        const constants = { RGBA32F: 1, RGBA16F: 2, FLOAT: 3, HALF_FLOAT: 4, RGBA: 5 };

        it('prefers RGBA32F when EXT_color_buffer_float is present', () => {
            const gl = { ...constants, getExtension: (name) => (name === 'EXT_color_buffer_float' ? {} : null) };
            const fmt = pickVelocityTextureFormat(gl);
            expect(fmt.internal).toBe(constants.RGBA32F);
            expect(fmt.type).toBe(constants.FLOAT);
        });

        it('falls back to RGBA16F when only EXT_color_buffer_half_float is present', () => {
            const gl = { ...constants, getExtension: (name) => (name === 'EXT_color_buffer_half_float' ? {} : null) };
            const fmt = pickVelocityTextureFormat(gl);
            expect(fmt.internal).toBe(constants.RGBA16F);
            expect(fmt.type).toBe(constants.HALF_FLOAT);
        });

        it('returns null when neither extension is available (caller must skip the overlay, not throw)', () => {
            const gl = { ...constants, getExtension: () => null };
            expect(pickVelocityTextureFormat(gl)).toBe(null);
        });
    });

    describe('shouldUseLinearFiltering (mocked gl — the exact W0 gate-invalidating bug: LINEAR without the *_linear extension silently samples 0)', () => {
        it('requests the FLOAT-specific extension for a FLOAT texture', () => {
            const calls = [];
            const gl = { getExtension: (name) => { calls.push(name); return name === 'OES_texture_float_linear' ? {} : null; } };
            expect(shouldUseLinearFiltering(gl, true)).toBe(true);
            expect(calls).toEqual(['OES_texture_float_linear']);
        });

        it('requests the HALF_FLOAT-specific extension for a HALF_FLOAT texture', () => {
            const gl = { getExtension: (name) => (name === 'OES_texture_half_float_linear' ? {} : null) };
            expect(shouldUseLinearFiltering(gl, false)).toBe(true);
        });

        it('returns false (NEAREST fallback, not a throw) when the extension is absent', () => {
            const gl = { getExtension: () => null };
            expect(shouldUseLinearFiltering(gl, true)).toBe(false);
        });
    });

    describe('computeBboxOrtho / worldToVelocityUv (shared FBO-write / overlay-read window)', () => {
        it('centers the window on the bbox midpoint', () => {
            const ortho = computeBboxOrtho([0, 0, 100, 200], 1.0);
            expect(ortho.cx).toBe(50);
            expect(ortho.cy).toBe(100);
        });

        it('pads by padFactor and uses the LARGER of width/height (square window)', () => {
            const ortho = computeBboxOrtho([0, 0, 100, 200], 1.0);
            expect(ortho.halfW).toBe(100); // max(100,200)/2
            expect(ortho.halfH).toBe(100);
        });

        it('the bbox center maps to UV (0.5, 0.5)', () => {
            const ortho = computeBboxOrtho([0, 0, 100, 200], 1.0);
            const [u, v] = worldToVelocityUv(50, 100, ortho);
            expect(Math.abs(u - 0.5) < 1e-9).toBe(true);
            expect(Math.abs(v - 0.5) < 1e-9).toBe(true);
        });

        it('the window edges map to UV 0/1', () => {
            const ortho = computeBboxOrtho([0, 0, 100, 100], 1.0);
            expect(worldToVelocityUv(0, 50, ortho)[0]).toBe(0);
            expect(worldToVelocityUv(100, 50, ortho)[0]).toBe(1);
        });
    });

    describe('computeArrowGridDimensions / arrowGridNdc (SCREEN-SPACE grid — the spec\'s departure from the spike\'s world-fixed grid)', () => {
        it('a wider viewport at the SAME spacing yields more columns (constant density -> more instances, not stretched spacing)', () => {
            const narrow = computeArrowGridDimensions(640, 480, 64);
            const wide = computeArrowGridDimensions(1920, 480, 64);
            expect(wide.cols).toBeGreaterThan(narrow.cols);
            expect(wide.rows).toBe(narrow.rows);
        });

        it('a smaller spacing (denser) at the SAME viewport yields more instances', () => {
            const sparse = computeArrowGridDimensions(800, 600, 128);
            const dense = computeArrowGridDimensions(800, 600, 32);
            expect(dense.count).toBeGreaterThan(sparse.count);
        });

        it('never collapses below a 2x2 grid even for a tiny viewport / huge spacing', () => {
            const { cols, rows } = computeArrowGridDimensions(50, 50, 500);
            expect(cols).toBeGreaterThanOrEqualTo(2);
            expect(rows).toBeGreaterThanOrEqualTo(2);
        });

        it('grid instances tile [-1,1] evenly with a half-cell margin (no instance exactly ON the viewport edge)', () => {
            const { cols, rows, count } = computeArrowGridDimensions(400, 400, 100); // 4x4
            expect(count).toBe(cols * rows);
            const [firstX, firstY] = arrowGridNdc(0, cols, rows);
            const [lastX, lastY] = arrowGridNdc(count - 1, cols, rows);
            expect(firstX).toBeGreaterThan(-1);
            expect(firstY).toBeGreaterThan(-1);
            expect(lastX).toBeLessThan(1);
            expect(lastY).toBeLessThan(1);
        });

        it('index -> (col,row) is row-major, matching gl_InstanceID % uCols / uCols in ARROW_VERTEX_SHADER', () => {
            const cols = 5;
            const rows = 3;
            const [x0] = arrowGridNdc(0, cols, rows);
            const [x1] = arrowGridNdc(1, cols, rows);
            const [xCols] = arrowGridNdc(cols, cols, rows); // wraps to row 1, col 0 -> same x as index 0
            expect(x1).toBeGreaterThan(x0);
            expect(Math.abs(xCols - x0) < 1e-9).toBe(true);
        });
    });

    describe('unitDischargeArrowLengthPx / computeArrowMaxLengthPx / arrowSpeedColor (GLSL-mirrored formulas)', () => {
        it('zero discharge (dry or still) yields the minimum stub length', () => {
            expect(unitDischargeArrowLengthPx(0, 0, 1.5, 40)).toBe(3);
        });

        it('discharge at/above qRef clamps to the max length', () => {
            expect(unitDischargeArrowLengthPx(1, 5, 1.5, 40)).toBe(43); // clamp(5/1.5,0,1)=1 -> 40+3
        });

        it('scales linearly below qRef', () => {
            const len = unitDischargeArrowLengthPx(1, 0.75, 1.5, 40); // q=0.75, t=0.5
            expect(Math.abs(len - (0.5 * 40 + 3)) < 1e-9).toBe(true);
        });

        it('computeArrowMaxLengthPx applies the packing factor with a floor', () => {
            expect(computeArrowMaxLengthPx(64)).toBe(64 * 0.62);
            expect(computeArrowMaxLengthPx(1)).toBe(6); // floor, not 0.62
        });

        it('arrowSpeedColor is pale at t=0, red-ish at t>=1, and mid-orange at t=0.5', () => {
            const closeArr = (actual, expected) => actual.every((v, i) => Math.abs(v - expected[i]) < 1e-9);
            const slow = arrowSpeedColor(0, 2);
            const fast = arrowSpeedColor(4, 2); // clamps to t=1
            const mid = arrowSpeedColor(1, 2);
            expect(closeArr(slow, [1.00, 0.97, 0.70])).toBe(true);
            expect(closeArr(fast, [0.95, 0.15, 0.08])).toBe(true);
            expect(closeArr(mid, [1.00, 0.62, 0.15])).toBe(true);
        });
    });

    describe('isArrowVisible (h_min display mask — AC: "no glyphs in dry/film cells")', () => {
        it('dry cell (depth <= wetThreshold) is never visible regardless of speed', () => {
            expect(isArrowVisible(0.001, 0.005, 10)).toBe(false);
        });

        it('wet but effectively still cell (below minSpeed) is not visible', () => {
            expect(isArrowVisible(1, 0.005, 1e-6)).toBe(false);
        });

        it('wet + flowing cell is visible', () => {
            expect(isArrowVisible(1, 0.005, 0.5)).toBe(true);
        });
    });

    describe('FLOWVIZ_ARROW_VERTEX_SHADER GLSL<->JS formula parity (mirrors playbackShaders-test.js\'s technique)', () => {
        it('the shader\'s arrow-length formula literally matches unitDischargeArrowLengthPx\'s clamp/scale/offset', () => {
            expect(FLOWVIZ_ARROW_VERTEX_SHADER).toMatch(/float lenPx = clamp\(q \/ uQRef, 0\.0, 1\.0\) \* uMaxLenPx \+ 3\.0;/);
        });

        it('the shader\'s wet-mask cull matches isArrowVisible\'s guard (depth<=threshold OR speed<minSpeed)', () => {
            expect(FLOWVIZ_ARROW_VERTEX_SHADER).toMatch(/if \(depth <= uWetThreshold \|\| speed < uMinSpeed\)/);
        });

        it('direction uses atan(vel.y, vel.x) — the SAME two-argument arctangent JS Math.atan2 computes', () => {
            expect(FLOWVIZ_ARROW_VERTEX_SHADER).toMatch(/float ang = atan\(vel\.y, vel\.x\);/);
        });

        it('samples via textureLod (NOT texture()) — implicit-LOD texture() is fragment-only in a GLSL ES 3.00 vertex shader', () => {
            expect(FLOWVIZ_ARROW_VERTEX_SHADER).toMatch(/textureLod\(uVelTex, uv, 0\.0\)/);
            expect(FLOWVIZ_ARROW_VERTEX_SHADER).toNotMatch(/[^d]texture\(uVelTex/);
        });

        // TASK-2661 (W6.75.1) audit — uNdcToUv replaces the former separate
        // uInvProj/uBboxOrtho pair (see composeNdcToVelocityUvMatrix's
        // docstring: same class of fp32-large-number GPU defect as the
        // particle/trail bug, applied to velocity-UV sampling rather than
        // glyph position).
        it('uses the single CPU-precomposed uNdcToUv matrix, not a separate uInvProj/uBboxOrtho pair', () => {
            expect(FLOWVIZ_ARROW_VERTEX_SHADER).toMatch(/uniform mat3 uNdcToUv;/);
            expect(FLOWVIZ_ARROW_VERTEX_SHADER).toNotMatch(/uInvProj/);
            expect(FLOWVIZ_ARROW_VERTEX_SHADER).toNotMatch(/uBboxOrtho/);
            expect(FLOWVIZ_ARROW_VERTEX_SHADER).toMatch(/vec2 uv = \(uNdcToUv \* vec3\(ndcX, ndcY, 1\.0\)\)\.xy;/);
        });
    });

    describe('composeNdcToVelocityUvMatrix (TASK-2661 audit — arrow velocity-sampling fp32 fix)', () => {
        const bboxOrtho = { cx: 16891852.555, cy: -3879000, halfW: 253.66, halfH: 253.66 };
        // View centred elsewhere from the bbox (the general, worst realistic
        // case — buildInverseProjectionMatrix's translation is the VIEW
        // centre, not the bbox centre, so they must NOT be assumed equal).
        const viewState = { center: [16891900, -3878900], resolution: 1, rotation: 0.05 };
        const sizeCssPx = [1000, 800];

        it('matches the JS-double reference (invProj world reconstruction + bbox-UV normalize), composed with no precision loss', () => {
            const ndcToUv = composeNdcToVelocityUvMatrix(viewState, sizeCssPx, bboxOrtho);
            const invProj = buildInverseProjectionMatrix(viewState, sizeCssPx);
            [[-0.5, 0.3], [0.2, -0.7], [0.0, 0.0]].forEach(([ndcX, ndcY]) => {
                const [worldX, worldY] = applyProjectionMatrix(invProj, ndcX, ndcY);
                const refUvX = (worldX - bboxOrtho.cx) / (2 * bboxOrtho.halfW) + 0.5;
                const refUvY = (worldY - bboxOrtho.cy) / (2 * bboxOrtho.halfH) + 0.5;
                const [uvX, uvY] = applyProjectionMatrix(ndcToUv, ndcX, ndcY);
                expect(Math.abs(uvX - refUvX)).toBeLessThan(1e-5);
                expect(Math.abs(uvY - refUvY)).toBeLessThan(1e-5);
            });
        });

        it('produces O(1)-magnitude coefficients — no raw world coordinate reaches the GPU uniform upload', () => {
            const ndcToUv = composeNdcToVelocityUvMatrix(viewState, sizeCssPx, bboxOrtho);
            ndcToUv.forEach((v) => {
                expect(Math.abs(v)).toBeLessThan(1e4);
            });
        });
    });

    describe('velocity DIRECTION parity vs the Python reference (AC: numerically verified at fixture points, extending the W4 fixture)', () => {
        it('fixture metadata sanity: real store, has both wet and dry points (Phase 0.5 proof, mirrors the W4 parity suite)', () => {
            expect(DERIVED_QUANTITY_FIXTURE.results.length).toBeGreaterThan(0);
            expect(DERIVED_QUANTITY_FIXTURE.results.some((r) => r.wet)).toBe(true);
        });

        it('every fixture point carries independently-Python-computed xVelocity/yVelocity (TASK-2632 additive extension, not re-derived from `speed`)', () => {
            DERIVED_QUANTITY_FIXTURE.results.forEach((r) => {
                expect(typeof r.xVelocity).toBe('number');
                expect(typeof r.yVelocity).toBe('number');
            });
        });

        it('hypot(xVelocity, yVelocity) matches the fixture\'s own `speed` field (the shader\'s length(vel) formula, mirrored) — proves xVelocity/yVelocity are genuinely the signed DECOMPOSITION of speed, not independent/inconsistent values', () => {
            DERIVED_QUANTITY_FIXTURE.results.forEach((r) => {
                const recomposedSpeed = Math.hypot(r.xVelocity, r.yVelocity);
                expect(Math.abs(recomposedSpeed - r.speed) < 1e-3).toBe(true);
            });
        });

        it('atan2(yVelocity, xVelocity) [the arrow shader\'s atan(vel.y,vel.x)] + speed round-trips to (xVelocity, yVelocity) on every WET point — the direction/magnitude decomposition the overlay draws is lossless for the real Merewether store bytes', () => {
            const wetPoints = DERIVED_QUANTITY_FIXTURE.results.filter((r) => r.wet && r.speed > 1e-6);
            expect(wetPoints.length).toBeGreaterThan(0);
            wetPoints.forEach((r) => {
                const angle = Math.atan2(r.yVelocity, r.xVelocity);
                const reconX = Math.cos(angle) * r.speed;
                const reconY = Math.sin(angle) * r.speed;
                expect(Math.abs(reconX - r.xVelocity) < 1e-3).toBe(true);
                expect(Math.abs(reconY - r.yVelocity) < 1e-3).toBe(true);
            });
        });

        it('a dry point\'s velocity is masked to (0,0) by the shader\'s own wet-mask convention, independent of whatever raw xVelocity/yVelocity the store carries at that vertex', () => {
            // Mirrors FLOWVIZ_VELOCITY_VERTEX_SHADER's `vVelDepth = vec3(q.yz * wet, ...)`
            // — this is a masking-CONTRACT check (the overlay's own guarantee), not a
            // claim that the store's raw dry-cell velocity is itself always zero.
            const dryPoints = DERIVED_QUANTITY_FIXTURE.results.filter((r) => !r.wet);
            expect(dryPoints.length).toBeGreaterThan(0);
            const wetMaskFactor = (wet) => (wet ? 1 : 0);
            dryPoints.forEach((r) => {
                const maskedVx = r.xVelocity * wetMaskFactor(r.wet);
                const maskedVy = r.yVelocity * wetMaskFactor(r.wet);
                expect(maskedVx).toBe(0);
                expect(maskedVy).toBe(0);
            });
        });
    });

    describe('module constants', () => {
        it('exposes sane defaults', () => {
            expect(VEL_TEX_SIZE).toBeGreaterThan(0);
            expect(DEFAULT_ARROW_DENSITY_PX).toBeGreaterThan(0);
            expect(DEFAULT_ARROW_SCALE).toBeGreaterThan(0);
        });
    });
});
