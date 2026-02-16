import Rx from "rxjs";
const axios = require('../../../../MapStore2/web/client/libs/ajax');
import { getToken } from '../../../../MapStore2/web/client/utils/SecurityUtils';
import {
    HGEVAL_START_REPORT,
    HGEVAL_SAVE_REPORT,
    queryProgress,
    queryResult,
    rasterResult,
    reportComplete,
    reportError,
    saveSuccess,
    saveError,
    validationError,
    setStep
} from "./actionsHGeval";
import { VECTOR_LAYERS, TOTAL_QUERIES, NICARAGUA_BOUNDS } from "./utils/layerConfig";
import { buildWfsContainsQuery } from "./utils/wfsQuery";

/**
 * Build auth headers for custom Django API endpoints.
 * MapStore's axios interceptor only adds tokens for /geoserver/ and /api/v2/ URLs.
 * Our /nicp/api/ endpoints need the bearer token added manually.
 */
function getBearerHeaders() {
    const token = getToken();
    return token ? { 'Authorization': `Bearer ${token}` } : {};
}

/**
 * Compute warnings from collected report data and raster values.
 */
function computeWarnings(reportData, rasterVals) {
    const warnings = [];

    if (rasterVals?.precip_driest_quarter != null && rasterVals.precip_driest_quarter < 100) {
        warnings.push(`The driest quarter has only ${rasterVals.precip_driest_quarter}mm of rainfall. Seasonal water shortages may affect groundwater recharge.`);
    }
    if (rasterVals?.precip_annual != null && rasterVals.precip_annual < 750) {
        warnings.push('Total annual precipitation is less than 750mm. Low rainfall may limit groundwater availability.');
    }

    const geology = reportData['geonode:master_geology_01'];
    if (geology?.FLG_Lperm === 1 || geology?.FLG_Lperm === '1') {
        warnings.push('Low permeability geology has been identified at this location. Drilling may encounter hard rock with limited water yield.');
    }
    if (geology?.FLG_PotCon === 1 || geology?.FLG_PotCon === '1') {
        warnings.push('Potential contamination sources have been identified in the geological record for this area.');
    }
    if (geology?.FLG_Drill === 1 || geology?.FLG_Drill === '1') {
        warnings.push('Drilling difficulty has been flagged for this area due to geological conditions.');
    }
    if (geology?.FLG_Thick === 1 || geology?.FLG_Thick === '1') {
        warnings.push('Aquifer thickness concerns have been identified. The aquifer may be thin at this location.');
    }

    const landform = reportData['geonode:landform_01'];
    if (landform?.Lnd_Code === 4 || landform?.Lnd_Code === '4') {
        warnings.push('This location appears to be on a ridge or near a hilltop. Groundwater levels may be deeper than average.');
    }

    if (reportData['geonode:islands_01']?.OBJECTID != null) {
        warnings.push('This location is on an island. Freshwater resources may be limited and vulnerable to saltwater intrusion.');
    }
    if (reportData['geonode:wq_saltwater_intrusion_01']?.SI_Risk) {
        warnings.push('Saltwater intrusion risk has been identified in this area. Water quality testing is recommended.');
    }
    if (reportData['geonode:wq_arsenic_01']?.As_Risk) {
        warnings.push('Arsenic risk has been mapped in this area. Water quality testing for arsenic is strongly recommended.');
    }
    if (reportData['geonode:wq_nitrate_01']?.N03_Risk) {
        warnings.push('Nitrate contamination risk (>40 mg/L) has been mapped in this area.');
    }
    if (reportData['geonode:wq_industrial_contamination_01']?.InCon_Risk) {
        warnings.push('Industrial contamination risk has been identified near this location.');
    }
    const chloride = reportData['geonode:wq_chloride_01'];
    if (chloride?.cl_risk || chloride?.Cl_Risk) {
        warnings.push('Chloride contamination risk (>500 mg/L) has been mapped in this area.');
    }

    return warnings;
}

/**
 * Validate that coordinates are within Nicaragua and not in a lake.
 */
function validateLocation(reportData) {
    const country = reportData['geonode:admin_level_0'];
    if (!country || !country.NAME_0) {
        return 'Location is outside Nicaragua. Please select a point within the country.';
    }
    const lake = reportData['geonode:lakes_02'];
    if (lake && lake.name) {
        return `Location is inside ${lake.name}. Please select a point on land.`;
    }
    return null;
}

/**
 * Epic: When HGEVAL_START_REPORT is dispatched, run all WFS queries + raster API in parallel.
 */
export const startReportEpic = (action$, store) =>
    action$
        .ofType(HGEVAL_START_REPORT)
        .switchMap(() => {
            const state = store.getState();
            const coords = state?.hgeval?.coordinates;
            if (!coords) {
                return Rx.Observable.of(reportError('No coordinates selected'));
            }

            const { lon, lat } = coords;

            // Quick bounds check before querying
            if (lon < NICARAGUA_BOUNDS.minLon || lon > NICARAGUA_BOUNDS.maxLon ||
                lat < NICARAGUA_BOUNDS.minLat || lat > NICARAGUA_BOUNDS.maxLat) {
                return Rx.Observable.of(
                    validationError('Location is outside Nicaragua. Please select a point within the country.'),
                    setStep('form')
                );
            }

            const geoserverUrl = state?.gnsettings?.geoserverUrl || '/geoserver';
            const wfsUrl = geoserverUrl + '/ows';
            let completedCount = 0;

            // Build WFS query observables
            const wfsQueries = VECTOR_LAYERS.map(layer => {
                const xml = buildWfsContainsQuery(layer.name, layer.properties, lon, lat);
                return Rx.Observable
                    .from(axios.post(wfsUrl, xml, {
                        headers: { 'Content-Type': 'application/xml' }
                    }))
                    .map(response => {
                        const features = response?.data?.features;
                        const props = (features && features.length > 0) ? features[0].properties : null;
                        completedCount++;
                        return [
                            queryResult(layer.name, props),
                            queryProgress(completedCount, TOTAL_QUERIES)
                        ];
                    })
                    .catch(() => {
                        completedCount++;
                        return Rx.Observable.of([
                            queryResult(layer.name, null),
                            queryProgress(completedCount, TOTAL_QUERIES)
                        ]);
                    });
            });

            // Build raster API observable
            const rasterApiUrl = state?.hgeval?.rasterApiUrl || '/nicp/api/raster/';
            const authHeaders = getBearerHeaders();
            const rasterQuery = Rx.Observable
                .from(axios.get(`${rasterApiUrl}?lon=${lon}&lat=${lat}`, { headers: authHeaders }))
                .map(response => {
                    completedCount++;
                    return [
                        rasterResult(response?.data?.values),
                        queryProgress(completedCount, TOTAL_QUERIES)
                    ];
                })
                .catch(() => {
                    completedCount++;
                    return Rx.Observable.of([
                        rasterResult(null),
                        queryProgress(completedCount, TOTAL_QUERIES)
                    ]);
                });

            // Run all queries in parallel, then validate and compute warnings
            return Rx.Observable.merge(...wfsQueries, rasterQuery)
                .mergeMap(actions => Rx.Observable.from(actions))
                .concat(
                    Rx.Observable.defer(() => {
                        const currentState = store.getState();
                        const allReportData = currentState?.hgeval?.reportData || {};
                        const allRasterValues = currentState?.hgeval?.rasterValues;

                        // Validate location
                        const locationError = validateLocation(allReportData);
                        if (locationError) {
                            return Rx.Observable.of(
                                validationError(locationError),
                                setStep('form')
                            );
                        }

                        const warnings = computeWarnings(allReportData, allRasterValues);
                        return Rx.Observable.of(reportComplete(warnings));
                    })
                );
        });

/**
 * Epic: Save report to Django backend.
 */
export const saveReportEpic = (action$, store) =>
    action$
        .ofType(HGEVAL_SAVE_REPORT)
        .switchMap(() => {
            const state = store.getState();
            const hgeval = state?.hgeval;
            const reportApiUrl = hgeval?.reportApiUrl || '/nicp/api/reports/';
            const payload = {
                name: hgeval?.form?.name || 'Untitled Report',
                description: hgeval?.form?.description || '',
                sector: hgeval?.form?.sector || '',
                preferred_contact: hgeval?.form?.preferred_contact || '',
                contact_phone_number: hgeval?.form?.contact_phone_number || '',
                longitude: hgeval?.coordinates?.lon,
                latitude: hgeval?.coordinates?.lat,
                report_data: hgeval?.reportData || {},
                raster_values: hgeval?.rasterValues || {},
                warnings: hgeval?.warnings || []
            };

            return Rx.Observable
                .from(axios.post(reportApiUrl, payload, { headers: getBearerHeaders() }))
                .map(response => saveSuccess(response.data))
                .catch(err => Rx.Observable.of(
                    saveError(err?.response?.data?.detail || err?.data?.detail || 'Failed to save report')
                ));
        });
