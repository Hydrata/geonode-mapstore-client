/*
 * Copyright 2026, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

/*
 * TASK-2629 (W4.1, epic 2618) — playbackShaders source-level checks.
 * GLSL cannot import playbackDerivedQuantities.js's AIDR_HAZARD_TABLE at
 * runtime (a hand transcription lives inside MESH_VERTEX_SHADER's
 * classifyHazardIndex — see that function's own header comment), so this
 * suite parses the GLSL source text and asserts its literal thresholds
 * match the JS table byte-for-byte, in order — the two CANNOT drift without
 * failing this test (the brief's "so they cannot drift" requirement, applied
 * to the JS<->GLSL pair since GLSL has no import mechanism to share the
 * Python<->JS pair's approach).
 */
import expect from 'expect';
import { MESH_VERTEX_SHADER, MESH_FRAGMENT_SHADER, linkProgram } from '../playbackShaders';
import { AIDR_HAZARD_TABLE, QUANTITY_MODE_INDEX } from '../playbackDerivedQuantities';
import { buildQuantityColormapLUT, uploadLUTTexture, DEPTH_SLD_STOPS, DEPTH_SLD_MAX } from '../playbackColormap';

describe('playbackShaders', () => {
    describe('MESH_VERTEX_SHADER classifyHazardIndex mirrors AIDR_HAZARD_TABLE exactly', () => {
        const rows = MESH_VERTEX_SHADER.match(/if \(dv <= [\d.]+ && d <= [\d.]+ && v <= [\d.]+\) return [\d.]+;/g);

        it('has exactly one `if` row per AIDR_HAZARD_TABLE entry', () => {
            expect(rows).toBeTruthy();
            expect(rows.length).toBe(AIDR_HAZARD_TABLE.length);
        });

        it('every row\'s (maxDV, maxD, maxV, classIndex) matches AIDR_HAZARD_TABLE in order', () => {
            rows.forEach((row, i) => {
                const m = row.match(/if \(dv <= ([\d.]+) && d <= ([\d.]+) && v <= ([\d.]+)\) return ([\d.]+);/);
                expect(m).toBeTruthy();
                const [, maxDV, maxD, maxV, classIndex] = m;
                const expected = AIDR_HAZARD_TABLE[i];
                expect(Number(maxDV)).toBe(expected.maxDV);
                expect(Number(maxD)).toBe(expected.maxD);
                expect(Number(maxV)).toBe(expected.maxV);
                expect(Number(classIndex)).toBe(expected.classIndex);
            });
        });

        it('falls through to the H6 catch-all (classIndex 5) after the last explicit row', () => {
            expect(MESH_VERTEX_SHADER).toMatch(/return 5\.0;/);
        });
    });

    describe('uColorMode branches cover all eight QUANTITY_MODE_INDEX values', () => {
        it('every mode index 0-7 appears as an `if (uColorMode == N)`/`else` branch', () => {
            Object.values(QUANTITY_MODE_INDEX).forEach((modeIndex) => {
                if (modeIndex === 0) {
                    // mode 0 (depth) is the leading `if`, not `else if`.
                    expect(MESH_VERTEX_SHADER).toMatch(/if \(uColorMode == 0\)/);
                } else if (modeIndex < 7) {
                    expect(MESH_VERTEX_SHADER).toMatch(new RegExp(`else if \\(uColorMode == ${modeIndex}\\)`));
                }
                // mode 7 (courant) is the trailing `else` — no literal "== 7" needed.
            });
        });
    });

    describe('static per-vertex attributes for the new derived-quantity inputs', () => {
        it('declares aFriction at location 4 and aInradius at location 5 (playbackMeshGeometry.computeVertexInradius\'s output)', () => {
            expect(MESH_VERTEX_SHADER).toMatch(/layout\(location=4\) in float aFriction;/);
            expect(MESH_VERTEX_SHADER).toMatch(/layout\(location=5\) in float aInradius;/);
        });

        it('declares the g/rhoW/dt uniforms the derived formulas need (never hardcoded store constants)', () => {
            ['uG', 'uRhoW', 'uDt', 'uColorMin'].forEach((name) => {
                expect(MESH_VERTEX_SHADER).toMatch(new RegExp(`uniform float ${name};`));
            });
        });
    });

    // TASK-2752 (W8.2, epic 2706) — the supplied-scalar envelope attribute.
    describe('static per-vertex attribute for the temporal-max envelope (TASK-2752)', () => {
        it('declares aEnvelope at location 6 and the uEnvelopeMode switch uniform', () => {
            expect(MESH_VERTEX_SHADER).toMatch(/layout\(location=6\) in float aEnvelope;/);
            expect(MESH_VERTEX_SHADER).toMatch(/uniform float uEnvelopeMode;/);
        });
    });
});

/*
 * TASK-2752 (W8.2, epic 2706) AC5 — the supplied-scalar (Max envelope)
 * renderer mode. A GL smoke/readback test asserting the DRAWN field equals
 * the supplied `aEnvelope` array verbatim, and specifically that it is NOT
 * a derivation of aQty0/aQty1 — the actual production GLSL source
 * (MESH_VERTEX_SHADER/MESH_FRAGMENT_SHADER), not a reimplementation.
 *
 * Pattern mirrors playbackColormap-test.js's "uploadLUTTexture (minimal GL
 * smoke check)": skip (not fail) when this sandbox has no WebGL2 context at
 * all, since the AC asks for MINIMAL GL smoke coverage — the real render
 * path is live-verified in a real browser.
 */

/**
 * A big-triangle covering the whole clip space with ONE vertex value
 * (no interpolation ambiguity — all three vertices carry identical
 * per-vertex attributes), so every drawn pixel reads the same vValue.
 */
function drawBigTriangle(gl, program, uniforms, { qty, envelope, envelopeMode, backgroundAlpha = 0 }) {
    const posBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);

    const elevBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, elevBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 0]), gl.STATIC_DRAW);

    const qty0Buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, qty0Buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
        qty[0], qty[1], qty[2], qty[0], qty[1], qty[2], qty[0], qty[1], qty[2]
    ]), gl.STATIC_DRAW);

    const frictionBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, frictionBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 0]), gl.STATIC_DRAW);

    const inradiusBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, inradiusBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([1, 1, 1]), gl.STATIC_DRAW);

    const envelopeBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, envelopeBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([envelope, envelope, envelope]), gl.STATIC_DRAW);

    gl.useProgram(program);
    gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, elevBuf);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 1, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, qty0Buf);
    gl.enableVertexAttribArray(2);
    gl.vertexAttribPointer(2, 3, gl.FLOAT, false, 0, 0);
    // aQty1 (location 3) — bind the SAME buffer as aQty0 so mixT is a no-op
    // regardless of its value; this test never varies mixT.
    gl.bindBuffer(gl.ARRAY_BUFFER, qty0Buf);
    gl.enableVertexAttribArray(3);
    gl.vertexAttribPointer(3, 3, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, frictionBuf);
    gl.enableVertexAttribArray(4);
    gl.vertexAttribPointer(4, 1, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, inradiusBuf);
    gl.enableVertexAttribArray(5);
    gl.vertexAttribPointer(5, 1, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, envelopeBuf);
    gl.enableVertexAttribArray(6);
    gl.vertexAttribPointer(6, 1, gl.FLOAT, false, 0, 0);

    gl.uniformMatrix3fv(uniforms.uProj, false, [1, 0, 0, 0, 1, 0, 0, 0, 1]);
    gl.uniform1f(uniforms.uMixT, 0);
    gl.uniform1i(uniforms.uColorMode, 0); // depth — irrelevant when uEnvelopeMode is on
    gl.uniform1f(uniforms.uColorMax, 20);
    gl.uniform1f(uniforms.uColorMin, 0);
    gl.uniform1f(uniforms.uWetThreshold, 1e-5);
    gl.uniform1f(uniforms.uG, 9.8);
    gl.uniform1f(uniforms.uRhoW, 1000);
    gl.uniform1f(uniforms.uDt, 0);
    gl.uniform1f(uniforms.uBackgroundAlpha, backgroundAlpha);
    gl.uniform1f(uniforms.uEnvelopeMode, envelopeMode ? 1 : 0);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, uniforms._lutTexture);
    gl.uniform1i(uniforms.uLUT, 0);

    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    const pixel = new Uint8Array(4);
    gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
    return pixel;
}

describe('MESH_VERTEX_SHADER supplied-scalar mode — TASK-2752 AC5', () => {
    let gl;
    let program;
    let uniforms;
    let lut;

    beforeEach(function() {
        const canvas = document.createElement('canvas');
        canvas.width = 4;
        canvas.height = 4;
        gl = canvas.getContext('webgl2');
        if (!gl) {
            // SwiftShader/headless GL is not guaranteed in every CI sandbox —
            // same posture as playbackColormap-test.js's uploadLUTTexture spec.
            this.skip();
            return;
        }
        program = linkProgram(gl, MESH_VERTEX_SHADER, MESH_FRAGMENT_SHADER);
        lut = buildQuantityColormapLUT(DEPTH_SLD_STOPS, DEPTH_SLD_MAX, 256);
        const lutTexture = uploadLUTTexture(gl, lut, 256);
        uniforms = {
            uProj: gl.getUniformLocation(program, 'uProj'),
            uMixT: gl.getUniformLocation(program, 'uMixT'),
            uColorMode: gl.getUniformLocation(program, 'uColorMode'),
            uColorMax: gl.getUniformLocation(program, 'uColorMax'),
            uColorMin: gl.getUniformLocation(program, 'uColorMin'),
            uWetThreshold: gl.getUniformLocation(program, 'uWetThreshold'),
            uG: gl.getUniformLocation(program, 'uG'),
            uRhoW: gl.getUniformLocation(program, 'uRhoW'),
            uDt: gl.getUniformLocation(program, 'uDt'),
            uBackgroundAlpha: gl.getUniformLocation(program, 'uBackgroundAlpha'),
            uEnvelopeMode: gl.getUniformLocation(program, 'uEnvelopeMode'),
            uLUT: gl.getUniformLocation(program, 'uLUT'),
            _lutTexture: lutTexture
        };
    });

    // GL_LINEAR-filtered LUT sampling means an exact texel-boundary vValue
    // (e.g. 0.25 into a 256-wide texture, texel_coord === 64.0 exactly) sits
    // AT the 50/50 blend point between two texels, where GPU rounding is not
    // guaranteed bit-identical — a real interpolation artifact, not a defect
    // this test should chase. A small per-channel tolerance (same idiom as
    // playbackColormap-test.js's own "interpolates correctly between two
    // real stops" case) makes the assertion robust to that without weakening
    // what it actually proves: WHICH region of the ramp got drawn.
    function expectNearColor(actual, expected, tolerance = 2) {
        ['R', 'G', 'B'].forEach((ch, i) => {
            expect(Math.abs(actual[i] - expected[i]) <= tolerance).toBe(true, `${ch}: ${actual[i]} vs ${expected[i]}`);
        });
    }

    it('draws the SUPPLIED aEnvelope value, not a derivation of aQty0/aQty1, when uEnvelopeMode is on', function() {
        if (!gl) {
            this.skip();
            return;
        }
        // depth=5, vx=3, vy=4 (speed 5) — chosen so the DERIVED depth/speed
        // modes would BOTH plausibly land near the envelope value below if
        // this test were accidentally still deriving; the envelope value 17
        // has no relationship to depth/speed/dIV of this qty at all, so a
        // match against it is only possible via the SUPPLIED path.
        const pixel = drawBigTriangle(gl, program, uniforms, { qty: [5, 3, 4], envelope: 17, envelopeMode: true });
        // vValue = clamp((17 - 0) / (20 - 0)) = 0.85 -> texel ~round(0.85*255) = 217
        const expectedTexel = Math.round(0.85 * 255);
        const expected = [lut[expectedTexel * 4], lut[expectedTexel * 4 + 1], lut[expectedTexel * 4 + 2]];
        expectNearColor(pixel, expected);
    });

    it('draws the DERIVED depth value when uEnvelopeMode is off — the untouched default path', function() {
        if (!gl) {
            this.skip();
            return;
        }
        // SAME qty/envelope inputs as the previous case, envelope mode OFF.
        const pixel = drawBigTriangle(gl, program, uniforms, { qty: [5, 3, 4], envelope: 17, envelopeMode: false });
        // vValue = clamp((5 - 0) / (20 - 0)) = 0.25 -> texel ~round(0.25*255) = 64
        const expectedTexel = Math.round(0.25 * 255);
        const expected = [lut[expectedTexel * 4], lut[expectedTexel * 4 + 1], lut[expectedTexel * 4 + 2]];
        expectNearColor(pixel, expected);
    });

    it('the two modes draw DIFFERENT colours for the same vertex data — envelope mode is not a no-op', function() {
        if (!gl) {
            this.skip();
            return;
        }
        const withEnvelope = drawBigTriangle(gl, program, uniforms, { qty: [5, 3, 4], envelope: 17, envelopeMode: true });
        const withoutEnvelope = drawBigTriangle(gl, program, uniforms, { qty: [5, 3, 4], envelope: 17, envelopeMode: false });
        // 0.85 vs 0.25 of the ramp are nowhere near each other — a coarse
        // (not ±2) difference check, so this proves a REAL colour change,
        // not filtering noise.
        const delta = Math.abs(withEnvelope[0] - withoutEnvelope[0])
            + Math.abs(withEnvelope[1] - withoutEnvelope[1])
            + Math.abs(withEnvelope[2] - withoutEnvelope[2]);
        expect(delta > 10).toBe(true, `expected a visibly different colour, got withEnvelope=${withEnvelope}, withoutEnvelope=${withoutEnvelope}`);
    });

    it('a zero-filled envelope (no data loaded) renders as DRY (the background tint), never a false wet reading', function() {
        if (!gl) {
            this.skip();
            return;
        }
        // AnugaPlaybackRenderer.setMesh's default (zero-filled envelopeBuf)
        // for a store/quantity with no envelope loaded — AC4's "plays
        // exactly as today" for the underlying data plane, and this shader
        // contract's own share of that: vWet must be 0, not a bogus "wet at
        // value 0" reading.
        const pixel = drawBigTriangle(gl, program, uniforms, {
            qty: [5, 3, 4], envelope: 0, envelopeMode: true,
            backgroundAlpha: 1 // opaque, so the dry tint is visible in the readback
        });
        // MESH_FRAGMENT_SHADER's dry-ground tint, premultiplied by alpha=1:
        // vec3(0.16, 0.15, 0.13) * 255, rounded.
        expectNearColor(pixel, [Math.round(0.16 * 255), Math.round(0.15 * 255), Math.round(0.13 * 255)], 1);
    });
});
