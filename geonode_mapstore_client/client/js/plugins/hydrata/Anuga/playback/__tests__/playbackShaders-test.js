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
import { MESH_VERTEX_SHADER } from '../playbackShaders';
import { AIDR_HAZARD_TABLE, QUANTITY_MODE_INDEX } from '../playbackDerivedQuantities';

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
});
