/*
 * TASK-2158 (W3.1) — wfstUpdate OGC ExceptionReport guard.
 *
 * GeoServer returns HTTP-200 with an <ows:ExceptionReport> body when a WFS-T
 * transaction is REJECTED (e.g. a rai_data_xor CHECK violation on a rain-on-grid
 * feature). Before this guard, wfstUpdate RESOLVED on that 200 → the save epic
 * fired a SAVE_SUCCESS toast on a no-op write. wfstInsert (wfstApi.js ~line 104)
 * and wfstDelete (~line 189) already delegate to the same throwIfOGCException
 * choke point; wfstUpdate was the one silent gap.
 *
 * Mirrors the MockAdapter harness in translateRegistry-test.js: mock the WFS
 * endpoint's DescribeFeatureType GET + the Transaction POST via axios-mock-adapter.
 *
 * An unregistered layer prefix ('zzz') routes translateOut through the identity
 * fallback, so this test isolates the guard from any translator behaviour.
 */
import expect from 'expect';
import MockAdapter from 'axios-mock-adapter';

const axios = require('../../../../../MapStore2/web/client/libs/ajax').default;
const { wfstUpdate } = require('../wfstApi');

const WFS_URL = 'http://localhost:8080/geoserver/wfs';
const TYPE_NAME = 'geonode:zzz_5_rainfall';

const DESCRIBE_STUB = {
    targetPrefix: 'geonode',
    targetNamespace: 'http://geonode.org',
    featureTypes: [{
        typeName: 'zzz_5_rainfall',
        properties: [
            { name: 'the_geom', type: 'gml:Polygon', localType: 'Polygon' },
            { name: 'description', type: 'xsd:string', localType: 'string' }
        ]
    }]
};

// A GeoServer-shaped rejection: HTTP 200 carrying an ExceptionReport whose
// ExceptionText names the CHECK constraint the datastore rejected on.
const XOR_MESSAGE = 'new row for relation "zzz_5_rainfall" violates check constraint "rai_data_xor"';
const EXCEPTION_REPORT_200 =
    '<ows:ExceptionReport><ows:Exception><ows:ExceptionText>'
    + XOR_MESSAGE
    + '</ows:ExceptionText></ows:Exception></ows:ExceptionReport>';

const CLEAN_TRANSACTION_200 =
    '<wfs:TransactionResponse><wfs:TransactionSummary>'
    + '<wfs:totalUpdated>1</wfs:totalUpdated>'
    + '</wfs:TransactionSummary></wfs:TransactionResponse>';

describe('TASK-2158 wfstUpdate OGC ExceptionReport guard', () => {
    let mock;

    beforeEach(() => {
        mock = new MockAdapter(axios);
        mock.onGet(/\/geoserver\/wfs/).reply(200, DESCRIBE_STUB);
    });

    afterEach(() => {
        if (mock) { mock.restore(); mock = null; }
    });

    it('rejects with the parsed ExceptionText when the 200 body is an ows:ExceptionReport', (done) => {
        mock.onPost(/\/geoserver\/wfs/).reply(200, EXCEPTION_REPORT_200);
        wfstUpdate(WFS_URL, TYPE_NAME, 'zzz_5_rainfall.7', null, { description: 'X' })
            .then(() => {
                done(new Error('wfstUpdate resolved on an ExceptionReport 200 — the guard did not fire'));
            })
            .catch((err) => {
                expect(err).toExist();
                // The first line of the parsed ExceptionText surfaces to the save toast.
                expect(err.message).toBe(XOR_MESSAGE);
                done();
            });
    });

    it('resolves with the featureId when the 200 body is a clean TransactionResponse', (done) => {
        mock.onPost(/\/geoserver\/wfs/).reply(200, CLEAN_TRANSACTION_200);
        wfstUpdate(WFS_URL, TYPE_NAME, 'zzz_5_rainfall.7', null, { description: 'X' })
            .then((fid) => {
                expect(fid).toBe('zzz_5_rainfall.7');
                done();
            })
            .catch(done);
    });
});
