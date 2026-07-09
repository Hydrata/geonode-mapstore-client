/*
 * TASK-2159 (W3.2) — WFS-T insert/update null-clear robustness (wfstApi.js).
 *
 * The four translators emit an EXPLICIT null for a cleared XOR / off-shape column
 * so a WFS-T UPDATE actually NULLs the stale column on the row (the update path
 * serialises null as `<wfs:Value></wfs:Value>`, which GeoServer stores as NULL —
 * verified live in the W3 closeout). Two wfstApi.js guards make that null-emission
 * safe on the OTHER two surfaces the shared translateOut feeds:
 *
 *  1. wfstInsert STRIPS null-valued keys before building the insert. A fresh row
 *     has nothing to clear, and GeoServer 2.27's WFS-T insert GML-binding THROWS
 *     on an empty numeric/int element (`<geonode:data_timeseries_id></...>` →
 *     "Parsing failed … StringIndexOutOfBoundsException"; empty float → "String
 *     is not assignable from Float"), atomically rejecting creation of every new
 *     rain-on-grid feature. Verified live; independent adversarial review
 *     wf_22688b79 rated this P0.
 *
 *  2. wfstUpdate FILTERS its propertyChange loop by getPropertyDescriptor, so the
 *     now-always-present null XOR keys don't throw (getValue → isGeometryType of
 *     an undefined descriptor) on a describe that lacks them — a schema-drifted /
 *     stale DescribeFeatureType cache. Mirrors the INSERT toFeature filter.
 *
 * The translate registry is process-global across Karma and other specs call
 * cleanTranslate() (translateRegistry-test.js), so we register the real rai/bdy
 * translators in beforeEach rather than rely on the module-load side-effect —
 * this exercises the genuine translateOut null-emission, not the identity fallback.
 */
import expect from 'expect';
import MockAdapter from 'axios-mock-adapter';
import { registerTranslate } from '../translateRegistry';
import { translateOut as rainfallTranslateOut } from '../rainfallTranslate';
import { translateOut as boundaryTranslateOut } from '../boundaryTranslate';

const axios = require('../../../../../MapStore2/web/client/libs/ajax').default;
const { wfstInsert, wfstUpdate } = require('../wfstApi');

const WFS_URL = 'http://localhost:8080/geoserver/wfs';

// A FULLY-UPGRADED rai_ describe — the XOR columns ARE present, so (pre-fix)
// toFeature would keep the null key and emit an empty numeric element.
const DESCRIBE_WITH_XOR = {
    targetPrefix: 'geonode',
    targetNamespace: 'http://geonode.org',
    featureTypes: [{
        typeName: 'rai_5_rainfall',
        properties: [
            { name: 'the_geom', type: 'gml:Polygon', localType: 'Polygon' },
            { name: 'description', type: 'xsd:string', localType: 'string' },
            { name: 'data', type: 'xsd:string', localType: 'string' },
            { name: 'data_constant', type: 'xsd:double', localType: 'double' },
            { name: 'data_timeseries_id', type: 'xsd:int', localType: 'int' }
        ]
    }]
};

// A describe MISSING the XOR columns (un-upgraded legacy table / stale cache).
const DESCRIBE_NO_XOR = {
    targetPrefix: 'geonode',
    targetNamespace: 'http://geonode.org',
    featureTypes: [{
        typeName: 'bdy_5_boundary',
        properties: [
            { name: 'the_geom', type: 'gml:Polygon', localType: 'Polygon' },
            { name: 'description', type: 'xsd:string', localType: 'string' },
            { name: 'boundary', type: 'xsd:string', localType: 'string' },
            { name: 'location', type: 'xsd:string', localType: 'string' }
        ]
    }]
};

const INSERT_OK = '<wfs:TransactionResponse><wfs:InsertResults><wfs:Feature>'
    + '<ogc:FeatureId fid="rai_5_rainfall.99"/></wfs:Feature></wfs:InsertResults>'
    + '</wfs:TransactionResponse>';
const UPDATE_OK = '<wfs:TransactionResponse><wfs:TransactionSummary>'
    + '<wfs:totalUpdated>1</wfs:totalUpdated></wfs:TransactionSummary></wfs:TransactionResponse>';

describe('TASK-2159 wfstInsert strips the null XOR column (no empty numeric element)', () => {
    let mock; let body;
    beforeEach(() => {
        body = null;
        registerTranslate('rai', { translateOut: rainfallTranslateOut });
        mock = new MockAdapter(axios);
        mock.onGet(/\/geoserver\/wfs/).reply(200, DESCRIBE_WITH_XOR);
        mock.onPost(/\/geoserver\/wfs/).reply((cfg) => { body = cfg.data; return [200, INSERT_OK]; });
    });
    // Leave the real translators registered (the normal module-load state) — do
    // NOT cleanTranslate() here or we'd wipe the 'bdy' default for downstream specs.
    afterEach(() => { if (mock) { mock.restore(); mock = null; } });

    it('constant rainfall INSERT emits data_constant and OMITS the null data_timeseries_id', (done) => {
        wfstInsert(WFS_URL, 'geonode:rai_5_rainfall', null, { data: { kind: 'constant', constant: 100 } })
            .then(() => {
                expect(body).toContain('data_constant');
                // The P0 regression: the null XOR column must NOT ride the insert
                // wire — an empty numeric element throws in GeoServer's insert
                // GML-binding and rejects the whole create.
                expect(body.indexOf('data_timeseries_id')).toBe(-1);
                done();
            })
            .catch(done);
    });

    it('timeseries rainfall INSERT emits data_timeseries_id and OMITS the null data_constant', (done) => {
        wfstInsert(WFS_URL, 'geonode:rai_5_rainfall', null, { data: { kind: 'timeseries', timeseries_id: 42 } })
            .then(() => {
                expect(body).toContain('data_timeseries_id');
                expect(body.indexOf('data_constant')).toBe(-1);
                done();
            })
            .catch(done);
    });
});

describe('TASK-2159 wfstUpdate tolerates a describe missing the XOR columns (schema drift)', () => {
    let mock; let body;
    beforeEach(() => {
        body = null;
        registerTranslate('bdy', { translateOut: boundaryTranslateOut });
        mock = new MockAdapter(axios);
        mock.onGet(/\/geoserver\/wfs/).reply(200, DESCRIBE_NO_XOR);
        mock.onPost(/\/geoserver\/wfs/).reply((cfg) => { body = cfg.data; return [200, UPDATE_OK]; });
    });
    // Leave the real translators registered (the normal module-load state) — do
    // NOT cleanTranslate() here or we'd wipe the 'bdy' default for downstream specs.
    afterEach(() => { if (mock) { mock.restore(); mock = null; } });

    it('a non-Time boundary UPDATE resolves (does NOT throw) and skips the absent XOR columns', (done) => {
        // The real bdy translator emits data_constant=null + data_timeseries_id=null
        // off-Time; without the descriptor filter, getValue(null, absent) throws.
        wfstUpdate(WFS_URL, 'geonode:bdy_5_boundary', 'bdy_5_boundary.7', null, {
            boundary: 'Reflective', description: 'X', data_constant: 5
        })
            .then((fid) => {
                expect(fid).toBe('bdy_5_boundary.7');
                expect(body.indexOf('data_constant')).toBe(-1);
                expect(body.indexOf('data_timeseries_id')).toBe(-1);
                done();
            })
            .catch(done);
    });
});
