import Rx from "rxjs";
import axios from '../../../../MapStore2/web/client/libs/ajax';
import { getToken } from '../../../../MapStore2/web/client/utils/SecurityUtils';
import { CLICK_ON_MAP, registerEventListener, unRegisterEventListener } from '../../../../MapStore2/web/client/actions/map';
import { purgeMapInfoResults, hideMapinfoMarker, toggleMapInfoState } from '../../../../MapStore2/web/client/actions/mapInfo';
import {
    HGEVAL_SET_STEP,
    HGEVAL_START_REPORT,
    HGEVAL_SAVE_REPORT,
    HGEVAL_SIGNUP_AND_SAVE,
    HGEVAL_LOGIN_AND_SAVE,
    HGEVAL_RESET,
    HGEVAL_REPORT_ERROR,
    setCoordinates,
    queryProgress,
    queryResult,
    rasterResult,
    reportComplete,
    reportError,
    saveSuccess,
    saveError,
    signupSuccess,
    signupError,
    loginSuccess,
    loginError,
    validationError,
    setStep,
    mapImageResult
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
 * Extract MapTiler API key from localConfig background layers.
 * The key is injected into terrain layer URLs at deploy time.
 */
function getMaptilerKey(state) {
    const plugins = state?.localConfig?.plugins?.map_viewer || [];
    for (const p of plugins) {
        const cfg = p?.cfg;
        if (cfg?.defaultTerrain?.url) {
            const match = cfg.defaultTerrain.url.match(/[?&]key=([^&]+)/);
            if (match) return match[1];
        }
    }
    // Fallback: check background layers in map state
    const layers = state?.layers?.flat || [];
    for (const l of layers) {
        if (l?.url && l.url.includes('maptiler.com') && l.url.includes('key=')) {
            const match = l.url.match(/[?&]key=([^&]+)/);
            if (match) return match[1];
        }
    }
    return null;
}

/**
 * Fetch a MapTiler static map image and convert to a data URL.
 * Returns an Observable that emits the mapImageResult action.
 */
function fetchMapImage(lon, lat, zoom, state) {
    const key = getMaptilerKey(state);
    if (!key) {
        return Rx.Observable.of(mapImageResult(null));
    }
    const mapZoom = Math.min(Math.max(zoom || 12, 8), 16);
    const url = `https://api.maptiler.com/maps/streets-v2/static/${lon},${lat},${mapZoom}/600x400.png?key=${key}&markers=${lon},${lat},red`;

    return Rx.Observable
        .from(
            fetch(url)
                .then(r => r.blob())
                .then(blob => new Promise((resolve) => {
                    const reader = new FileReader();
                    reader.onloadend = () => resolve(reader.result);
                    reader.readAsDataURL(blob);
                }))
        )
        .map(dataUrl => mapImageResult(dataUrl))
        .catch(() => Rx.Observable.of(mapImageResult(null)));
}

/**
 * Build the report payload from current hgeval state.
 */
function buildReportPayload(hgeval, extraFields) {
    return {
        name: hgeval?.form?.name || 'Untitled Report',
        description: hgeval?.form?.description || '',
        sector: hgeval?.form?.sector || '',
        preferred_contact: hgeval?.form?.contact_email ? 'email' : (hgeval?.form?.contact_phone_number ? 'phone' : ''),
        contact_phone_number: hgeval?.form?.contact_phone_number || '',
        contact_email: hgeval?.form?.contact_email || '',
        longitude: hgeval?.coordinates?.lon,
        latitude: hgeval?.coordinates?.lat,
        report_data: hgeval?.reportData || {},
        raster_values: hgeval?.rasterValues || {},
        warnings: hgeval?.warnings || [],
        ...extraFields
    };
}

/**
 * Open server-generated PDF in new tab and reload page after auth+save.
 */
function downloadPdfAndReload(reportId) {
    if (reportId) {
        window.open(`/nicp/print/${reportId}/download/`, '_blank');
    }
    setTimeout(() => { window.location.reload(); }, 500);
}

/**
 * Compute warnings from collected report data and raster values.
 */
function computeWarnings(reportData, rasterVals) {
    const warnings = [];

    // eslint-disable-next-line no-eq-null, eqeqeq -- null-or-undefined idiom
    if (rasterVals?.precip_driest_quarter != null && rasterVals.precip_driest_quarter < 100) {
        warnings.push(`The driest quarter has only ${rasterVals.precip_driest_quarter}mm of rainfall. Seasonal water shortages may affect groundwater recharge.`);
    }
    // eslint-disable-next-line no-eq-null, eqeqeq -- null-or-undefined idiom
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

    // eslint-disable-next-line no-eq-null, eqeqeq -- null-or-undefined idiom
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
 * Epic: Capture map clicks to set coordinates when HGeval is in selecting mode.
 */
export const mapClickEpic = (action$, store) =>
    action$
        .ofType(CLICK_ON_MAP)
        .filter(() => store.getState()?.hgeval?.step === 'selecting')
        // eslint-disable-next-line no-eq-null, eqeqeq -- null-or-undefined idiom
        .filter(({ point }) => point?.latlng?.lng != null && point?.latlng?.lat != null)
        .map(({ point }) => setCoordinates(point.latlng.lng, point.latlng.lat));

/**
 * Epic: Manage identify tool (GetFeatureInfo) state when HGeval enters/exits selecting mode.
 * Disables identify while HGeval is capturing map clicks, re-enables it when done.
 */
export const hgevalMapClickManagerEpic = (action$, store) => {
    let weDisabledMapInfo = false;
    return action$
        .ofType(HGEVAL_SET_STEP, HGEVAL_START_REPORT, HGEVAL_RESET, HGEVAL_REPORT_ERROR)
        .switchMap(() => {
            const state = store.getState();
            const step = state?.hgeval?.step;
            if (step === 'selecting') {
                const actions = [
                    purgeMapInfoResults(),
                    hideMapinfoMarker(),
                    registerEventListener('click', 'hgeval')
                ];
                if (!weDisabledMapInfo && state?.mapInfo?.enabled !== false) {
                    actions.push(toggleMapInfoState());
                    weDisabledMapInfo = true;
                }
                return Rx.Observable.from(actions);
            }
            const actions = [unRegisterEventListener('click', 'hgeval')];
            if (weDisabledMapInfo) {
                actions.push(toggleMapInfoState());
                weDisabledMapInfo = false;
            }
            return Rx.Observable.from(actions);
        });
};

/**
 * Epic: When HGEVAL_START_REPORT is dispatched, run all WFS queries + raster API in parallel.
 * After all queries complete, fetches a MapTiler static map image for the report.
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
                    setStep('selecting')
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

            // Run all queries in parallel, then validate, compute warnings, and fetch map image
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
                                setStep('selecting')
                            );
                        }

                        const warnings = computeWarnings(allReportData, allRasterValues);
                        // Use current map zoom, default to 12 if too zoomed out
                        const mapZoom = currentState?.map?.present?.zoom || currentState?.map?.zoom || 12;
                        const zoom = mapZoom < 8 ? 12 : mapZoom;

                        // Fetch map image in parallel with completing the report
                        return Rx.Observable.merge(
                            Rx.Observable.of(reportComplete(warnings)),
                            fetchMapImage(lon, lat, zoom, currentState)
                        );
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
            const payload = buildReportPayload(hgeval);

            return Rx.Observable
                .from(axios.post(reportApiUrl, payload, { headers: getBearerHeaders() }))
                .map(response => saveSuccess(response.data))
                .catch(err => Rx.Observable.of(
                    saveError(err?.response?.data?.detail || err?.data?.detail || 'Failed to save report')
                ));
        });

/**
 * Epic: Signup + save report for anonymous users.
 * After success, triggers download and reloads the page to pick up the new session.
 */
export const signupAndSaveEpic = (action$, store) =>
    action$
        .ofType(HGEVAL_SIGNUP_AND_SAVE)
        .switchMap(({ signupData }) => {
            const state = store.getState();
            const hgeval = state?.hgeval;
            const payload = buildReportPayload(hgeval, {
                email: signupData.email,
                password: signupData.password,
                first_name: signupData.first_name || '',
                last_name: signupData.last_name || '',
                contact_email: signupData.email || hgeval?.form?.contact_email || ''
            });

            return Rx.Observable
                .from(axios.post('/nicp/api/signup-report/', payload))
                .mergeMap(response => {
                    const { report } = response.data;
                    downloadPdfAndReload(report?.id);
                    return Rx.Observable.of(signupSuccess(report));
                })
                .catch(err => Rx.Observable.of(
                    signupError(err?.response?.data || { detail: 'Signup failed. Please try again.' })
                ));
        });

/**
 * Epic: Login existing user + save report.
 * After success, triggers download and reloads the page to pick up the session.
 */
export const loginAndSaveEpic = (action$, store) =>
    action$
        .ofType(HGEVAL_LOGIN_AND_SAVE)
        .switchMap(({ credentials }) => {
            const state = store.getState();
            const hgeval = state?.hgeval;
            const payload = buildReportPayload(hgeval, {
                email: credentials.email,
                password: credentials.password,
                contact_email: credentials.email || hgeval?.form?.contact_email || ''
            });

            return Rx.Observable
                .from(axios.post('/nicp/api/login-report/', payload))
                .mergeMap(response => {
                    const { report } = response.data;
                    downloadPdfAndReload(report?.id);
                    return Rx.Observable.of(loginSuccess(report));
                })
                .catch(err => Rx.Observable.of(
                    loginError(err?.response?.data || { detail: 'Login failed. Please try again.' })
                ));
        });
