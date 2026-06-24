/*
 * Unit tests for the terrain-upload CRS helpers (TASK-1886).
 *
 * Hermetic: geotiff.fromBlob and CoordinatesUtils.getAvailableCRS are spied so
 * no real TIFF bytes or proj4 registration order is required. Covers the UTM
 * zone math at its boundaries (where an off-by-one would silently mis-zone a
 * DEM), the N/S split, the proj4-sourced UTM WGS84 list, and the three
 * detectGeotiffCrs branches (tagged / CRS-less / corrupt-no-throw).
 */
import expect from 'expect';
import CoordinatesUtils from '../../../../../MapStore2/web/client/utils/CoordinatesUtils';
import {
    utmZoneFromLonLat,
    utmCodeFromBbox,
    listUtmWgs84CRS,
    detectGeotiffCrs
} from '../crsHelpers';

describe('crsHelpers', () => {
    describe('utmZoneFromLonLat', () => {
        it('maps a northern-hemisphere lon/lat to its 326xx zone', () => {
            // Abu Dhabi area sits in UTM zone 40 N -> EPSG:32640.
            expect(utmZoneFromLonLat(56.4, 24.3)).toBe('EPSG:32640');
        });
        it('maps a southern-hemisphere lat to a 327xx zone', () => {
            // Same zone 40, southern hemisphere -> EPSG:32740.
            expect(utmZoneFromLonLat(56.4, -24.3)).toBe('EPSG:32740');
        });
        it('treats the equator (lat === 0) as northern (>= 0)', () => {
            expect(utmZoneFromLonLat(56.4, 0)).toBe('EPSG:32640');
        });
        it('handles the western boundary lon === -180 (zone 1)', () => {
            expect(utmZoneFromLonLat(-180, 10)).toBe('EPSG:32601');
        });
        it('handles lon === 0 (zone 31)', () => {
            expect(utmZoneFromLonLat(0, 10)).toBe('EPSG:32631');
        });
        it('handles the eastern edge lon === 179.9 (zone 60)', () => {
            expect(utmZoneFromLonLat(179.9, 10)).toBe('EPSG:32660');
        });
        it('handles a southern lon === 179.9 (zone 60 S)', () => {
            expect(utmZoneFromLonLat(179.9, -10)).toBe('EPSG:32760');
        });
    });

    describe('utmCodeFromBbox', () => {
        it('returns null for a missing/empty bbox', () => {
            expect(utmCodeFromBbox(null)).toBe(null);
            expect(utmCodeFromBbox({})).toBe(null);
        });
        it('returns null when bounds contain NaN', () => {
            expect(utmCodeFromBbox({ bounds: { minx: NaN, miny: 0, maxx: 1, maxy: 1 } })).toBe(null);
        });
        it('computes the UTM zone of a 4326 bbox centroid (no reprojection)', () => {
            const bbox = { bounds: { minx: 56.0, miny: 24.0, maxx: 56.8, maxy: 24.6 }, crs: 'EPSG:4326' };
            // centroid ~ (56.4, 24.3) -> zone 40 N
            expect(utmCodeFromBbox(bbox)).toBe('EPSG:32640');
        });
        it('reprojects a non-4326 bbox to 4326 first then zones it', () => {
            // Web-Mercator extent around (56.4, 24.3) in EPSG:3857.
            const spy = expect.spyOn(CoordinatesUtils, 'reproject').andCall((point, source, dest) => {
                // Trivially map the projected centroid back to the lon/lat we expect.
                return { x: 56.4, y: 24.3 };
            });
            const bbox = { bounds: { minx: 6200000, miny: 2700000, maxx: 6300000, maxy: 2800000 }, crs: 'EPSG:3857' };
            expect(utmCodeFromBbox(bbox)).toBe('EPSG:32640');
            spy.restore();
        });
    });

    describe('listUtmWgs84CRS', () => {
        it('returns all 120 UTM WGS84 zones with friendly labels, sourced from getAvailableCRS', () => {
            const fake = {};
            for (let z = 1; z <= 60; z++) {
                fake[`EPSG:326${String(z).padStart(2, '0')}`] = { label: `EPSG:326${String(z).padStart(2, '0')}` };
                fake[`EPSG:327${String(z).padStart(2, '0')}`] = { label: `EPSG:327${String(z).padStart(2, '0')}` };
            }
            // Noise that must be filtered out.
            fake['EPSG:4326'] = { label: 'WGS 84' };
            fake['EPSG:3857'] = { label: 'Web Mercator' };
            fake['EPSG:2193'] = { label: 'NZTM' };
            const spy = expect.spyOn(CoordinatesUtils, 'getAvailableCRS').andReturn(fake);

            const list = listUtmWgs84CRS();
            expect(list.length).toBe(120);
            // Sorted, friendly-labelled.
            const z40n = list.find((c) => c.code === 'EPSG:32640');
            const z40s = list.find((c) => c.code === 'EPSG:32740');
            expect(z40n.label).toBe('UTM Zone 40 N (WGS 84)');
            expect(z40s.label).toBe('UTM Zone 40 S (WGS 84)');
            // No non-UTM noise leaked through.
            expect(list.some((c) => c.code === 'EPSG:4326')).toBe(false);
            expect(list.some((c) => c.code === 'EPSG:2193')).toBe(false);
            spy.restore();
        });

        it('uses the real proj4-registered set (≥ 120 UTM zones available with no config)', () => {
            // Proves no new EPSG data is needed: proj4 auto-registers the family.
            const list = listUtmWgs84CRS();
            expect(list.length >= 120).toBe(true);
            expect(list.every((c) => /^EPSG:(326|327)\d{2}$/.test(c.code))).toBe(true);
        });
    });

    describe('detectGeotiffCrs', () => {
        // The parser is injected (detectGeotiffCrs's 2nd arg) so the test stays
        // hermetic without mocking the read-only geotiff ES-module namespace.
        const fakeParser = (geoKeys) => () =>
            Promise.resolve({ getImage: () => Promise.resolve({ getGeoKeys: () => geoKeys }) });
        const throwingParser = () => Promise.reject(new Error('not a tiff'));

        it('returns {hasCrs:true, epsg} for a CRS-tagged GeoTIFF (projected)', (done) => {
            detectGeotiffCrs(new Blob(['x']), fakeParser({ ProjectedCSTypeGeoKey: 32640 })).then((res) => {
                expect(res.hasCrs).toBe(true);
                expect(res.epsg).toBe(32640);
                expect(res.label).toBe('EPSG:32640');
                done();
            }).catch(done);
        });

        it('returns {hasCrs:true, epsg} for a geographic CRS GeoKey', (done) => {
            detectGeotiffCrs(new Blob(['x']), fakeParser({ GeographicTypeGeoKey: 4326 })).then((res) => {
                expect(res.hasCrs).toBe(true);
                expect(res.epsg).toBe(4326);
                done();
            }).catch(done);
        });

        it('returns {hasCrs:false} for a CRS-less GeoTIFF (no CRS GeoKey)', (done) => {
            detectGeotiffCrs(new Blob(['x']), fakeParser({})).then((res) => {
                expect(res.hasCrs).toBe(false);
                expect(res.epsg).toBe(null);
                done();
            }).catch(done);
        });

        it('treats the user-defined sentinel (32767) as no CRS', (done) => {
            detectGeotiffCrs(new Blob(['x']), fakeParser({ ProjectedCSTypeGeoKey: 32767 })).then((res) => {
                expect(res.hasCrs).toBe(false);
                done();
            }).catch(done);
        });

        it('returns {hasCrs:null} WITHOUT throwing for a corrupt/non-TIFF input', (done) => {
            detectGeotiffCrs(new Blob(['not a tiff']), throwingParser).then((res) => {
                expect(res.hasCrs).toBe(null);
                expect(res.epsg).toBe(null);
                done();
            }).catch(done);
        });
    });
});
