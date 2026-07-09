/*
 * TASK-1404 (W2 FE) — Tests for the Rainfall translator registered under 'rai'
 * in the VectorDraw translate registry.
 *
 * Mirrors inflowTranslate-test.js exactly (Rainfall shares the same
 * FeatureDataMixin wire schema as Inflow).  The critical regression path:
 * saving a rainfall area (Constant=100) without this translator sends
 * data='[object Object]' and leaves both data_constant=NULL and
 * data_timeseries_id=NULL, violating the rai_data_xor CHECK constraint.
 *
 * These tests are RED before rainfallTranslate.js exists and GREEN after.
 */
import expect from 'expect';
import { translateOut, synthesizeIn } from '../rainfallTranslate';
import {
    getTranslate,
    deriveTranslateKey,
    cleanTranslate,
    registerTranslate
} from '../translateRegistry';

describe('TASK-1404 rainfallTranslate.translateOut', () => {

    describe('kind="constant" — the primary ISSUE 13 regression', () => {
        it('emits data_constant, strips data + data_timeseries_id (ISSUE 13 fix)', () => {
            // This is the exact formValues shape that caused '[object Object]' + NULL+NULL.
            const input = {
                description: 'test',
                data: { kind: 'constant', constant: 100 }
            };
            const out = translateOut(input);
            // Must NOT stringify as '[object Object]'
            expect(out.data).toBe(undefined);
            // Must write the numeric constant
            expect(out.data_constant).toBe(100);
            // TASK-2159: NULL the non-selected XOR column (not omit) so a
            // switch FROM hyetograph/timeseries clears the stale id.
            expect(out.data_timeseries_id).toBe(null);
            // Other fields preserved
            expect(out.description).toBe('test');
        });

        it('coerces string constant to float', () => {
            const out = translateOut({ data: { kind: 'constant', constant: '50.5' } });
            expect(out.data_constant).toBe(50.5);
            expect(out.data).toBe(undefined);
            expect(out.data_timeseries_id).toBe(null);
        });

        it('omits data_constant when constant is empty string', () => {
            const out = translateOut({ data: { kind: 'constant', constant: '' } });
            expect(out.data_constant).toBe(undefined);
            expect(out.data).toBe(undefined);
            // Non-selected column still cleared with explicit null (TASK-2159).
            expect(out.data_timeseries_id).toBe(null);
        });

        it('omits data_constant when constant is null', () => {
            const out = translateOut({ data: { kind: 'constant', constant: null } });
            expect(out.data_constant).toBe(undefined);
            expect(out.data_timeseries_id).toBe(null);
        });
    });

    describe('kind="timeseries"', () => {
        it('emits data_timeseries_id, strips data + data_constant', () => {
            const out = translateOut({ data: { kind: 'timeseries', timeseries_id: 42 } });
            expect(out.data).toBe(undefined);
            expect(out.data_timeseries_id).toBe(42);
            // TASK-2159: NULL the non-selected XOR column (not omit) so a
            // switch FROM constant clears the stale data_constant.
            expect(out.data_constant).toBe(null);
        });

        it('coerces string timeseries_id to int', () => {
            const out = translateOut({ data: { kind: 'timeseries', timeseries_id: '7' } });
            expect(out.data_timeseries_id).toBe(7);
        });

        it('omits data_timeseries_id when id is empty string', () => {
            const out = translateOut({ data: { kind: 'timeseries', timeseries_id: '' } });
            expect(out.data_timeseries_id).toBe(undefined);
            expect(out.data).toBe(undefined);
            // Non-selected column still cleared with explicit null (TASK-2159).
            expect(out.data_constant).toBe(null);
        });
    });

    describe('missing/empty data value', () => {
        it('strips all three columns when data is absent (forces BE CHECK to fire)', () => {
            const out = translateOut({ description: 'test' });
            expect(out.data).toBe(undefined);
            expect(out.data_constant).toBe(undefined);
            expect(out.data_timeseries_id).toBe(undefined);
        });

        it('strips all three when data is null', () => {
            const out = translateOut({ data: null });
            expect(out.data).toBe(undefined);
            expect(out.data_constant).toBe(undefined);
            expect(out.data_timeseries_id).toBe(undefined);
        });
    });

    describe('legacy data column passthrough', () => {
        it('strips data text string (new writes never use the bare data column)', () => {
            const out = translateOut({ data: 'some-old-text' });
            // `data` is a string, not an object → falls to the "no structured value" branch
            // Strips data and both columns.
            expect(out.data).toBe(undefined);
            expect(out.data_constant).toBe(undefined);
            expect(out.data_timeseries_id).toBe(undefined);
        });
    });
});

describe('TASK-1404 rainfallTranslate.synthesizeIn', () => {
    it('synthesizes constant kind from data_constant', () => {
        const out = synthesizeIn({ data_constant: 100, description: 'test' });
        expect(out.data).toEqual({ kind: 'constant', constant: 100 });
        expect(out.data_constant).toBe(undefined);
        expect(out.data_timeseries_id).toBe(undefined);
    });

    it('synthesizes hyetograph kind from data_timeseries_id', () => {
        const out = synthesizeIn({ data_timeseries_id: 5 });
        // TASK-1970 W3: rai_ reconstructs to 'hyetograph', the rai_ timeseries-family kind.
        expect(out.data).toEqual({ kind: 'hyetograph', timeseries_id: 5 });
        expect(out.data_timeseries_id).toBe(undefined);
        expect(out.data_constant).toBe(undefined);
    });

    it('preserves an already-structured data value', () => {
        const structured = { kind: 'constant', constant: 50 };
        const out = synthesizeIn({ data: structured });
        expect(out.data).toEqual(structured);
    });

    it('synthesizes from legacy bare string data', () => {
        const out = synthesizeIn({ data: '25.5' });
        expect(out.data).toEqual({ kind: 'constant', constant: 25.5 });
    });

    it('drops non-numeric legacy string data', () => {
        const out = synthesizeIn({ data: 'some-ts-name' });
        expect(out.data).toBe(undefined);
    });

    it('strips Title-case duplicate keys', () => {
        const out = synthesizeIn({ Data_Constant: 10 });
        expect(out.data).toEqual({ kind: 'constant', constant: 10 });
        expect(out.Data_Constant).toBe(undefined);
    });
});

describe('TASK-1404 rainfallTranslate registry integration', () => {
    // Use registerTranslate directly (not re-importing the module) to avoid webpack
    // module-cache preventing re-registration after cleanTranslate().
    beforeEach(() => {
        cleanTranslate();
        registerTranslate('rai', { translateOut, synthesizeIn });
    });
    afterEach(() => cleanTranslate());

    it('registered translateOut under "rai" emits data_constant (not [object Object])', () => {
        const translator = getTranslate('rai');
        const testInput = { data: { kind: 'constant', constant: 100 } };
        const out = translator.translateOut(testInput);
        // Our translator must strip `data` and emit `data_constant`
        expect(out.data).toBe(undefined);
        expect(out.data_constant).toBe(100);
        expect(out.data_timeseries_id).toBe(null);
    });

    it('registered translateOut under "rai" emits data_timeseries_id for timeseries mode', () => {
        const translator = getTranslate('rai');
        const testInput = { data: { kind: 'timeseries', timeseries_id: 3 } };
        const out = translator.translateOut(testInput);
        expect(out.data).toBe(undefined);
        expect(out.data_timeseries_id).toBe(3);
        expect(out.data_constant).toBe(null);
    });

    it('deriveTranslateKey extracts "rai" from rai_615_rainfall_01', () => {
        expect(deriveTranslateKey('rai_615_rainfall_01')).toBe('rai');
        expect(deriveTranslateKey('geonode:rai_615_rainfall_01')).toBe('rai');
    });
});

/*
 * TASK-1984 — rainfallTranslate must handle kind='hyetograph' (timeseries-family).
 *
 * After TASK-1984, the rai_ discriminator-picker uses kind='hyetograph' instead
 * of kind='timeseries'. The translateOut function must treat 'hyetograph' the
 * same as 'timeseries': emit data_timeseries_id, strip data + data_constant.
 *
 * The wire columns (data_constant / data_timeseries_id) are unchanged —
 * only the FE discriminator kind label changes.
 */
describe('TASK-1984 rainfallTranslate hyetograph kind (timeseries-family)', () => {
    describe('translateOut — kind="hyetograph" treated same as kind="timeseries"', () => {
        it('kind="hyetograph" with timeseries_id emits data_timeseries_id, strips data + data_constant', () => {
            const out = translateOut({ data: { kind: 'hyetograph', timeseries_id: 42 } });
            expect(out.data).toBe(undefined);
            expect(out.data_timeseries_id).toBe(42);
            // TASK-2159: NULL the non-selected XOR column (not omit).
            expect(out.data_constant).toBe(null);
        });

        it('kind="hyetograph" coerces string timeseries_id to int', () => {
            const out = translateOut({ data: { kind: 'hyetograph', timeseries_id: '17' } });
            expect(out.data_timeseries_id).toBe(17);
            expect(out.data).toBe(undefined);
        });

        it('kind="hyetograph" with null timeseries_id: strips data_timeseries_id (BE CHECK fires)', () => {
            const out = translateOut({ data: { kind: 'hyetograph', timeseries_id: null } });
            expect(out.data).toBe(undefined);
            expect(out.data_timeseries_id).toBe(undefined);
            // Non-selected column still cleared with explicit null (TASK-2159).
            expect(out.data_constant).toBe(null);
        });

        it('kind="hyetograph" other fields preserved', () => {
            const out = translateOut({ description: 'Cyclone event', data: { kind: 'hyetograph', timeseries_id: 8 } });
            expect(out.description).toBe('Cyclone event');
            expect(out.data_timeseries_id).toBe(8);
        });
    });
});
