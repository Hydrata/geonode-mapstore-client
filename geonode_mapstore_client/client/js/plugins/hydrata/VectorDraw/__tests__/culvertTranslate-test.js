/**
 * TASK-1594 (W1) — culvertTranslate round-trip tests.
 *
 * Tests:
 * 1. translateOut coerces numeric strings to floats.
 * 2. translateOut sets empty numeric fields to null.
 * 3. translateOut normalises barrels: empty/missing → 1, string → int.
 * 4. synthesizeIn normalises Title-case WFS keys to lowercase.
 * 5. Round-trip: translateOut ∘ synthesizeIn is identity on canonical-case input.
 * 6. Registration: the 'cul' key is registered in translateRegistry.
 */

import expect from 'expect';
import { translateOut, synthesizeIn } from '../culvertTranslate';
import { getTranslate } from '../translateRegistry';

describe('culvertTranslate', () => {

    describe('translateOut', () => {
        it('passes shape through unchanged', () => {
            const result = translateOut({ shape: 'pipe', diameter_m: 0.9 });
            expect(result.shape).toEqual('pipe');
        });

        it('coerces numeric string to float', () => {
            const result = translateOut({ upstream_invert_m: '10.5', downstream_invert_m: '9.8' });
            expect(result.upstream_invert_m).toEqual(10.5);
            expect(result.downstream_invert_m).toEqual(9.8);
        });

        it('sets empty string numeric fields to null', () => {
            const result = translateOut({ width_m: '', height_m: '' });
            expect(result.width_m).toBe(null);
            expect(result.height_m).toBe(null);
        });

        it('normalises barrels empty string to 1', () => {
            expect(translateOut({ barrels: '' }).barrels).toEqual(1);
        });

        it('normalises barrels missing to 1', () => {
            expect(translateOut({}).barrels).toEqual(1);
        });

        it('parses barrels from string', () => {
            expect(translateOut({ barrels: '3' }).barrels).toEqual(3);
        });

        it('leaves already-numeric values unchanged', () => {
            const result = translateOut({ diameter_m: 0.9, barrels: 2 });
            expect(result.diameter_m).toEqual(0.9);
            expect(result.barrels).toEqual(2);
        });

        // TASK-2159 — clear the shape-dependent dimension attrs that do NOT
        // apply to the selected shape with explicit null (not stale carry-over).
        // A pipe uses diameter_m; box/arch use width_m + height_m. Burning
        // priority (Culvert model) reads min(height_m, diameter_m), so a stale
        // diameter on a box or a stale width/height on a pipe would corrupt the
        // burn depth. The invert/barrels/description attrs apply to every shape
        // and are left untouched.
        it('shape=pipe NULLs the box/arch dims (width_m, height_m), keeps diameter_m', () => {
            const result = translateOut({ shape: 'pipe', diameter_m: 0.9, width_m: 1.2, height_m: 1.1 });
            expect(result.diameter_m).toEqual(0.9);
            expect(result.width_m).toBe(null);
            expect(result.height_m).toBe(null);
        });

        it('shape=box NULLs the pipe dim (diameter_m), keeps width_m + height_m', () => {
            const result = translateOut({ shape: 'box', width_m: 1.5, height_m: 1.2, diameter_m: 0.9 });
            expect(result.width_m).toEqual(1.5);
            expect(result.height_m).toEqual(1.2);
            expect(result.diameter_m).toBe(null);
        });

        it('shape=arch NULLs the pipe dim (diameter_m), keeps width_m + height_m', () => {
            const result = translateOut({ shape: 'arch', width_m: 2.0, height_m: 1.5, diameter_m: 0.7 });
            expect(result.width_m).toEqual(2.0);
            expect(result.height_m).toEqual(1.5);
            expect(result.diameter_m).toBe(null);
        });

        it('shape-independent attrs (inverts, barrels, description) survive a shape switch', () => {
            const result = translateOut({
                shape: 'pipe', diameter_m: 0.9, width_m: 1.2, height_m: 1.1,
                upstream_invert_m: 10.5, downstream_invert_m: 9.8, barrels: 2, description: 'Main'
            });
            expect(result.upstream_invert_m).toEqual(10.5);
            expect(result.downstream_invert_m).toEqual(9.8);
            expect(result.barrels).toEqual(2);
            expect(result.description).toEqual('Main');
        });

        it('no shape selected: does NOT force-null any dimension (indeterminate)', () => {
            const result = translateOut({ width_m: 1.5, height_m: 1.2, diameter_m: 0.9 });
            expect(result.width_m).toEqual(1.5);
            expect(result.height_m).toEqual(1.2);
            expect(result.diameter_m).toEqual(0.9);
        });
    });

    describe('synthesizeIn', () => {
        it('normalises Title-case keys to lowercase', () => {
            const wire = {
                Shape: 'box',
                Width_M: 1.5,
                Height_M: 1.2,
                Upstream_Invert_M: 5.0,
                Downstream_Invert_M: 4.5,
                Barrels: 1,
                Description: 'Main drain'
            };
            const out = synthesizeIn(wire);
            expect(out.shape).toEqual('box');
            expect(out.width_m).toEqual(1.5);
            expect(out.height_m).toEqual(1.2);
            expect(out.upstream_invert_m).toEqual(5.0);
            expect(out.downstream_invert_m).toEqual(4.5);
            expect(out.barrels).toEqual(1);
            expect(out.description).toEqual('Main drain');
            // Title-case keys must be stripped
            expect(out.Shape).toBe(undefined);
            expect(out.Width_M).toBe(undefined);
        });

        it('passes lowercase keys through unchanged', () => {
            const wire = { shape: 'pipe', diameter_m: 0.9 };
            const out = synthesizeIn(wire);
            expect(out.shape).toEqual('pipe');
            expect(out.diameter_m).toEqual(0.9);
        });
    });

    describe('round-trip', () => {
        it('translateOut then synthesizeIn is identity on canonical-case input', () => {
            const original = {
                shape: 'arch', width_m: 2.0, height_m: 1.5,
                upstream_invert_m: 12.3, downstream_invert_m: 11.9,
                barrels: 2, description: 'Road culvert'
            };
            const roundTripped = synthesizeIn(translateOut({ ...original }));
            expect(roundTripped.shape).toEqual(original.shape);
            expect(roundTripped.width_m).toEqual(original.width_m);
            expect(roundTripped.barrels).toEqual(original.barrels);
        });
    });

    describe('registry', () => {
        it("registers under the 'cul' key", () => {
            const translator = getTranslate('cul');
            expect(typeof translator.translateOut).toEqual('function');
            expect(typeof translator.synthesizeIn).toEqual('function');
        });

        it("registered translateOut matches the exported function", () => {
            const translator = getTranslate('cul');
            const props = { shape: 'pipe', diameter_m: '1.2', barrels: '' };
            const direct = translateOut(props);
            const fromRegistry = translator.translateOut(props);
            expect(fromRegistry).toEqual(direct);
        });
    });
});
