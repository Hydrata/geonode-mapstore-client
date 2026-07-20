/**
 * ANUGA API Client
 *
 * Pure functions returning Promises. No Redux, no dispatch.
 * Centralizes all HTTP calls for the ANUGA plugin.
 *
 * V2P-79 — V1 → V2 cutover. All public functions now route through
 * /api/v2/anuga/. The legacy V1 path /anuga/api/ stays alive on the BE
 * (V2P-80 retires it 30d post-79) but is no longer called from FE here,
 * with three deliberate exceptions for create-only paths where V2 didn't
 * ship POST endpoints (boundary/friction/inflow). See `createResource`.
 */
import axios from '../../../../../MapStore2/web/client/libs/ajax';
import {parseDevHostname} from "@js/utils/APIUtils";

// V1 short type name → V2 nested-resource plural segment. Keys are the
// type identifiers callers already pass (the V1 router segment); values
// are the V2 URL segments per /opt/hydrata/apps/gn_anuga/urls.py.
//
// Three keys are intentionally absent: 'boundary', 'friction', 'inflow'.
// V2 boundaries/frictions/inflows endpoints expose only GET list/retrieve
// + PATCH partial_update — no POST create. createResource() falls back to
// V1 for those three; every other helper (list / patch / delete) routes V2.
const V2_PLURAL = {
    terrain: 'terrain',
    boundary: 'boundaries',
    friction: 'frictions',
    inflow: 'inflows',
    // TASK-955 (W2.2 FE) — Rainfall (polygon sibling to Inflow). V2 ViewSet
    // ships list/retrieve/PATCH/DELETE (TASK-954); POST create remains a V1
    // holdout while the BE upload-flow story is finalized (parallels Inflow).
    rainfall: 'rainfalls',
    structure: 'structures',
    'mesh-region': 'mesh-regions',
    'full-mesh': 'full-meshes',
    network: 'networks',
    catchment: 'catchments',
    nodes: 'nodes',
    links: 'links',
    comparison: 'comparisons',
    publication: 'publications',
    'compute-instance': 'compute-instances'
};

// Types whose V2 ViewSet does NOT expose POST create (V2P-12a/12b kept these
// read+patch-only; V2 spatial-layer stamping is intended to land via a
// different upload flow in V2P-80+). createResource keeps V1 for these.
// TASK-955: 'rainfall' added — same V1 holdout situation as inflow.
const V1_CREATE_ONLY_TYPES = new Set(['boundary', 'friction', 'inflow', 'rainfall']);

const v2Plural = (type) => V2_PLURAL[type] || type;

// -- Project ---------------------------------------------------------------

// V2P-79: V1 POST /anuga/api/project/get_project_from_map_id/
//      → V2 POST /api/v2/anuga/projects/from-map/  (V2P-74)
// Body shape preserved verbatim ({mapId}); response shape preserved
// ({projectId}). Anonymous-allowed on the V2 side.
export const getProjectFromMapId = (mapId) =>
    axios.post('/api/v2/anuga/projects/from-map/', { mapId });

// TASK-1930 W2.6 — map-OPEN GWC prefetch. POST the visible cacheable COG layer
// alternates so GeoServer pre-warms their tiles before the cold tile-storm.
// Fire-and-forget (the epic ignores the response); AllowAny on the BE side so
// anonymous viewers of public maps can warm. payload = {alternates: [...]}.
export const warmTiles = (projectId, payload) =>
    axios.post(`/api/v2/anuga/projects/${projectId}/warm-tiles/`, payload);

// V2P-79: alias to V2 list endpoint. Pagination semantics preserved by
// query params (page_size, page) — V2 ProjectViewSetV2 inherits DRF defaults.
export const getProjects = (pageSize = 100, page = 1) =>
    axios.get(parseDevHostname('/api/v2/anuga/projects/'), {
        params: { page_size: pageSize, page }
    });

// -- Generic resource CRUD -------------------------------------------------

// V2P-79: most types route to /api/v2/anuga/projects/{pid}/{plural}/.
// Boundary/Friction/Inflow stay on V1 because V2 did not ship POST create
// for them — see V1_CREATE_ONLY_TYPES rationale at top of file.
export const createResource = (projectId, type, data) => {
    if (V1_CREATE_ONLY_TYPES.has(type)) {
        // V1 holdout — V2 boundaries/frictions/inflows expose no POST.
        // Backend remains alive (V2P-80 will retire when V2 gains create).
        return axios.post(`/anuga/api/${projectId}/${type}/`, data);
    }
    return axios.post(`/api/v2/anuga/projects/${projectId}/${v2Plural(type)}/`, data);
};

// V2P-79: getResourceList — list all instances of `type` within a project.
// V1 returned a plain array; V2 likewise (no DEFAULT_PAGINATION_CLASS in
// REST_FRAMEWORK settings, viewsets do not declare pagination_class). Field
// shapes match through V2P-78 (base_map_full / s3_*_url / nested gn_layer).
export const getResourceList = (projectId, type) =>
    axios.get(`/api/v2/anuga/projects/${projectId}/${v2Plural(type)}/`);

// V2P-79: PATCH a resource title (re-uses the generic V2 PATCH route).
// V2 sub-resource serializers expose `title` (read+write).
export const updateResourceTitle = (projectId, type, resourceId, title) =>
    axios.patch(`/api/v2/anuga/projects/${projectId}/${v2Plural(type)}/${resourceId}/`, { title });

// V2P-79: generic PATCH for any sub-resource. V2P-78 ensured field-compat
// for `gn_layer`, `base_map_full`, `s3_*_url`, etc.
export const updateResource = (projectId, type, resourceId, data) =>
    axios.patch(`/api/v2/anuga/projects/${projectId}/${v2Plural(type)}/${resourceId}/`, data);

// -- Scenarios -------------------------------------------------------------

// V2P-79: V1 createScenario was a POST /anuga/api/{pid}/scenario/. The V2
// path /api/v2/anuga/projects/{pid}/scenarios/ is reached via createScenarioV2
// below; we keep this name as a thin alias so any existing callers continue
// to work with no change to argument shape.
export const createScenario = (projectId, scenario) =>
    axios.post(`/api/v2/anuga/projects/${projectId}/scenarios/`, scenario);

// V2P-79 / V2P-72: V1 PUT → V2 PATCH for partial-update semantics. V2 also
// supports PUT, but switching to PATCH avoids accidental field nulling when
// callers don't include all required-on-write fields. ScenarioUpdateSerializerV2
// limits the writable fields to {name, terrain, boundary, friction, inflow,
// structure, mesh_region, network, resolution, duration}.
export const updateScenario = (projectId, scenarioId, scenario) =>
    axios.patch(`/api/v2/anuga/projects/${projectId}/scenarios/${scenarioId}/`, scenario);

// V2P-79: V1 DELETE → V2 DELETE on the project-nested route.
export const deleteScenario = (projectId, scenarioId) =>
    axios.delete(`/api/v2/anuga/projects/${projectId}/scenarios/${scenarioId}/`);

// V2P-714: V2 DELETE wrappers for the 4 cascade-delete dataset types.
// Backend signals cascade-clean GeoNode Dataset, GeoServer layer, GeoFence
// rules, S3 TIFs. Returns 204 on success; 409 with {error_code:
// 'ACTIVE_REFERENCES', blocking: [...]} if active scenarios reference the
// dataset; 403 for viewers; 401 for anonymous.
export const deleteTerrainV2 = (projectId, terrainId) =>
    axios.delete(`/api/v2/anuga/projects/${projectId}/terrain/${terrainId}/`);

// Orphan-terrain self-heal (pruneOrphanTerrainLayersEpic): probe whether a
// GeoNode Dataset still exists, by PRIMARY KEY. Resolves true (200 — the
// dataset exists) or false (404 — it was deleted); REJECTS on any other
// outcome (403/5xx/network) so the caller can treat ambiguity as "keep, do
// not delete". A PK GET is a direct DB row lookup — unlike the CSW/search
// `?filter{alternate}=` endpoint, it does NOT lag a freshly published dataset,
// so a brand-new terrain layer is never mistaken for a ghost. A null/undefined
// pk resolves true (unknown → keep).
export const datasetExistsByPk = (pk) => {
    // eslint-disable-next-line no-eq-null, eqeqeq -- null-or-undefined idiom
    if (pk == null) return Promise.resolve(true);
    return axios.get(`/api/v2/datasets/${pk}/`)
        .then(() => true)
        .catch((err) => {
            const status = err?.status ?? err?.response?.status;
            if (status === 404) return false;
            throw err;
        });
};

// TASK-930 (W2-FE) — POST to the BE GLO-30 ingest endpoint shipped in
// TASK-929 (dc78cf3). Body shape: {title, source: 'copernicus_glo30',
// bbox: [minLon, minLat, maxLon, maxLat]}. Returns 202 + serialized
// Terrain; fetch + reprojection + GeoNode layer creation runs async on
// the anuga Celery pool. The new Terrain appears in the FE layer list
// via the existing TaskMonitor + taskCompleteLayerEpic polling loop.
export const createTerrainFromBbox = (projectId, payload) =>
    axios.post(`/api/v2/anuga/projects/${projectId}/terrain/create-from-bbox/`, payload);

// TASK-2327 (epic 2323): convert an ellipsoid terrain to an EGM2008 derived
// terrain. Non-destructive — the source terrain is byte-unchanged; the BE mints
// a new 'datum_shift' Terrain (202) that arrives via the Tasks panel poll.
export const convertTerrainDatum = (projectId, terrainId) =>
    axios.post(`/api/v2/anuga/projects/${projectId}/terrain/${terrainId}/convert-datum/`);

// TASK-96 — GET windowed DEM stats for a bbox. Returns {elev_min, elev_max,
// bbox, env_params: {elevMin, elevOne..elevNine, elevMax}} where env_params
// is the full GeoServer env() mapping ready to forward verbatim as the WMS
// env= request parameter (not VIEWPARAMS — see demRescaleEpic.js header).
// bbox is [minLon, minLat, maxLon, maxLat] in WGS84.
export const getTerrainBboxStats = (projectId, terrainId, bbox) =>
    axios.get(
        `/api/v2/anuga/projects/${projectId}/terrain/${terrainId}/bbox-stats/`,
        { params: { bbox: bbox.join(',') } }
    );

// TASK-1855 (W3.1) / TASK-1856 (W3.2): GET floating-point DEM elevation at a
// single WGS84 cursor point.  Returns {elevation: float|null, lon, lat, crs}.
// null means nodata pixel or point outside the raster — both are valid values
// (not errors).  The caller (cursorElevationEpic) dispatches null as a "hide
// readout" signal.
export const getTerrainElevationPoint = (projectId, terrainId, lon, lat) =>
    axios.get(
        `/api/v2/anuga/projects/${projectId}/terrain/${terrainId}/elevation/`,
        { params: { lon, lat } }
    );

// TASK-1860 (W4.3) / TASK-1861 (W4.4): GET a multi-raster line profile.
// TASK-2255 (epic 2249 W2, cross-section rework): `layers` now carries a bare
// name PER CHECKED TERRAIN (its own gn_layer_name — the literal 'dem' token is
// DROPPED) and, per checked scenario, its published stage_max name PLUS its
// depth_max name (sampled only for the FE's dry-mask epsilon — never derived
// into a terrain+depth stage; W1 authorizes every token against the path
// terrain's own project, capped at 12). Samples the requested coverages along
// a WGS84 LineString and returns ordered samples vs distance.  Returns
// {samples: [{distance_m, <layer>: float|null, ...}, ...], crs}.  null
// per-sample value means nodata or a point outside the raster — both valid,
// not errors.
//   line    — WGS84 LineString as WKT ("LINESTRING(lon lat, ...)").
//   layers  — comma-separated bare coveragestore names (terrain + result
//             layers resolve identically); the BE strips any geonode: prefix.
//   samples — sample-point count (BE clamps to 2..200).
export const getTerrainProfile = (projectId, terrainId, { line, layers, samples } = {}) =>
    axios.get(
        `/api/v2/anuga/projects/${projectId}/terrain/${terrainId}/profile/`,
        { params: { line, layers, samples } }
    );

// TASK-1651 (W1.5): GET presigned S3 download URL for a terrain GeoTIFF.
// Returns {url, filename}. The url expires in 1 hour.
export const getTerrainDownloadUrl = (projectId, terrainId) =>
    axios.get(`/api/v2/anuga/projects/${projectId}/terrain/${terrainId}/download/`);

// ── TASK-1729 (W1.7) — Direct-to-S3 presigned-PUT terrain upload ──────────
//
// Replaces the synchronous multipart POST (which streamed a multi-hundred-MB
// GeoTIFF through uwsgi and died at harakiri=120). The BE contract (TASK-1727)
// is a 3-step flow: presign → browser PUT straight to S3 → finalize. The exact
// request/response shapes are documented inline at each step below.

// Step 1 — PRESIGN. POST returns a presigned SigV4 S3 PUT URL + staging_key +
// process_id (201). The presign-time Process appears in the W1.5 Tasks Panel
// immediately (keyed on metadata.project_id), so the upload is visible during
// the byte transfer with NO Terrain row yet. body: {filename (required),
// content_type (optional; signs the PUT Content-Type), size (optional; >5 GiB
// → 400)}. Response: {process_id, staging_key, upload_url, content_type, ...}.
export const presignTerrainUpload = (projectId, { filename, contentType, size } = {}) =>
    axios.post(`/api/v2/anuga/projects/${projectId}/terrain/upload/presign/`, {
        filename,
        // Default to octet-stream so the BE signs *some* Content-Type; the PUT
        // (putFileToS3) must echo whatever the presign response says it signed.
        content_type: contentType || 'application/octet-stream',
        ...(typeof size === 'number' ? { size } : {})
    });

// Step 2 — BROWSER PUT TO S3 (no Django/uwsgi involved). Uses raw
// XMLHttpRequest (NOT axios) so we get xhr.upload.onprogress for a real
// byte-level progress bar, AND so axios's default XSRF header / baseURL /
// interceptors never touch the request — any extra header beyond the signed
// `Content-Type` would yield a 403 SignatureDoesNotMatch from S3.
//
//   uploadUrl   — the presigned URL from presignTerrainUpload (upload_url).
//   file        — the File/Blob to upload (raw bytes).
//   contentType — MUST equal the content_type the presign response signed.
//   onProgress  — optional (pct:0..100) callback driven by xhr.upload.onprogress.
//
// Resolves with {status, etag} on 2xx; rejects with an Error (carrying
// .status when the server replied) on non-2xx / network error / abort. On
// rejection the caller simply does NOT finalize — the BE reconcile sweep
// errors the orphan Process and the S3 lifecycle rule expires the staging blob.
export const putFileToS3 = (uploadUrl, file, contentType, onProgress) =>
    new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('PUT', uploadUrl, true);
        // The ONLY header we may set — it is the one the presign signed.
        xhr.setRequestHeader('Content-Type', contentType || 'application/octet-stream');
        if (xhr.upload && typeof onProgress === 'function') {
            xhr.upload.onprogress = (evt) => {
                if (evt.lengthComputable && evt.total > 0) {
                    onProgress(Math.round((evt.loaded * 100) / evt.total));
                }
            };
        }
        xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
                if (typeof onProgress === 'function') onProgress(100);
                resolve({ status: xhr.status, etag: xhr.getResponseHeader('ETag') });
            } else {
                const err = new Error(`S3 PUT failed (HTTP ${xhr.status})`);
                err.status = xhr.status;
                reject(err);
            }
        };
        xhr.onerror = () => reject(new Error('S3 PUT failed (network error)'));
        xhr.onabort = () => reject(new Error('S3 PUT aborted'));
        xhr.send(file);
    });

// Step 3 — FINALIZE. Called AFTER the S3 PUT returns 2xx. POST creates the
// Terrain row, server-side-copies the staged object to a permanent key,
// re-uses the SAME presign Process (so the Tasks Panel transitions from
// "Uploading" straight into the 3 import subtasks — no duplicate row), and
// kicks the async import chain. Returns 202 + serialized Terrain. body:
// {process_id (recommended), staging_key (required), title (optional;
// defaults to filename minus .tif)}.
// TASK-1880 (epic 1884 W2): `crsOverride` (when supplied) is forwarded as the
// `crs_override` field the BE finalize accepts (TASK-1885; osr.SetFromUserInput
// is the authority, returns 400 VALIDATION_ERROR with NO Terrain row on a bad
// code). OMITTED when undefined so a DEM that already carries a CRS is finalized
// unchanged (the BE only applies the override to a CRS-less raster).
// epic 2323 / TASK-2327: `verticalDatumDeclared` ('ellipsoid' | 'orthometric_egm2008'),
// the user's datum declaration from the upload Confirm dialog, forwarded as
// `vertical_datum_declared` and stored on the Terrain row (the async DoD inference
// then cross-checks it). OMITTED when undefined / "not sure" (inference decides).
export const finalizeTerrainUpload = (projectId, { processId, stagingKey, title, crsOverride, verticalDatumDeclared } = {}) =>
    axios.post(`/api/v2/anuga/projects/${projectId}/terrain/upload/finalize/`, {
        ...(processId ? { process_id: processId } : {}),
        staging_key: stagingKey,
        ...(title ? { title } : {}),
        ...(crsOverride ? { crs_override: crsOverride } : {}),
        ...(verticalDatumDeclared ? { vertical_datum_declared: verticalDatumDeclared } : {})
    });

// TASK-1881: classify whether a finalize error is worth retrying.
// - Transient: network error (no err.status / err.data.code) or 5xx server error.
// - Terminal: 4xx (including VALIDATION_ERROR 400, auth 401/403) — retrying
//   the same payload will produce the same failure.
// MapStore axios interceptor shape: err.status (not err.response.status),
// err.data (not err.response.data), err.originalError (the raw axios error).
const _isFinalizeTransient = (err) => {
    if (!err) return false;
    const status = err.status || (err.originalError && err.originalError.response && err.originalError.response.status);
    if (!status) return true; // no status → pure network/timeout error → transient
    return status >= 500;     // 5xx = server-side transient; 4xx = terminal (bad input)
};

// TASK-1881: retry wrapper for finalizeTerrainUpload. Retries up to MAX_RETRIES
// times on transient failures, with a RETRY_DELAY_MS pause between attempts. A
// terminal 4xx error is re-thrown immediately (no retry).
export const FINALIZE_MAX_RETRIES = 2;
export const FINALIZE_RETRY_DELAY_MS = 1000;

export const finalizeTerrainUploadWithRetry = (projectId, opts, _attempt) => {
    const attempt = typeof _attempt === 'number' ? _attempt : 0;
    return finalizeTerrainUpload(projectId, opts).catch((err) => {
        if (!_isFinalizeTransient(err) || attempt >= FINALIZE_MAX_RETRIES) throw err;
        return new Promise((resolve) => setTimeout(resolve, FINALIZE_RETRY_DELAY_MS))
            .then(() => finalizeTerrainUploadWithRetry(projectId, opts, attempt + 1));
    });
};

// Orchestrator — the full presign → PUT → finalize chain for one File. Keeps
// the 3-step dance in the API layer so callers (anugaInputMenu) only deal with
// {file, title, onProgress, onPresign}. Resolves with the finalize response (the
// serialized Terrain row); rejects on any step's failure (presign 4xx, S3 PUT
// failure, or finalize 4xx) WITHOUT having created a Terrain row when the PUT
// fails (finalize is never called).
//
//   onProgress(pct)  — 0..100 byte-transfer progress (PUT phase only).
//   onPresign(data)  — TASK-1728: fires once with the presign response body the
//                      instant it returns (carries process_id + staging_key), so
//                      the caller can key the Tasks-Panel row on the REAL BE
//                      process_id BEFORE the byte transfer starts — the row then
//                      merges seamlessly with the polled BE Process (no duplicate)
//                      and the upload is non-blocking from the first byte.
//
// Returns the axios finalize response (caller reads response.data for Terrain).
//
// TASK-1880 (epic 1884 W2): the optional `crsOverride` (e.g. 'EPSG:32756') is the
// SOURCE CRS the user picked for a CRS-less DEM. It threads straight through to
// finalize as `crs_override`; it does NOT touch presign or the S3 PUT (any extra
// header on the signed PUT would 403 SignatureDoesNotMatch — putFileToS3 is left
// untouched), and is OMITTED from finalize when undefined.
export const uploadTerrainDirect = (projectId, file, { title, crsOverride, verticalDatumDeclared, onProgress, onPresign } = {}) => {
    const filename = file && file.name;
    const contentType = (file && file.type) || 'application/octet-stream';
    const size = file && typeof file.size === 'number' ? file.size : undefined;
    return presignTerrainUpload(projectId, { filename, contentType, size })
        .then((presignResp) => {
            const data = presignResp && presignResp.data || {};
            if (typeof onPresign === 'function') onPresign(data);
            // The PUT Content-Type MUST match what the presign signed. The BE
            // echoes it back as content_type; fall back to what we sent.
            const signedContentType = data.content_type || contentType;
            return putFileToS3(data.upload_url, file, signedContentType, onProgress)
                // TASK-1881: use the retry wrapper for finalize so transient 5xx /
                // network blips don't surface as permanent upload failures (up to 2
                // retries, 1s delay; 4xx terminal errors are re-thrown immediately).
                .then(() => finalizeTerrainUploadWithRetry(projectId, {
                    processId: data.process_id,
                    stagingKey: data.staging_key,
                    title,
                    crsOverride,
                    verticalDatumDeclared
                }));
        });
};

export const deleteBoundaryV2 = (projectId, boundaryId) =>
    axios.delete(`/api/v2/anuga/projects/${projectId}/boundaries/${boundaryId}/`);

export const deleteFrictionV2 = (projectId, frictionId) =>
    axios.delete(`/api/v2/anuga/projects/${projectId}/frictions/${frictionId}/`);

export const deleteInflowV2 = (projectId, inflowId) =>
    axios.delete(`/api/v2/anuga/projects/${projectId}/inflows/${inflowId}/`);

// TASK-955 (W2.2 FE): V2 DELETE wrapper for Rainfall. Mirrors the V2P-714
// cascade-delete pattern: BE returns 204 on success, 409 ACTIVE_REFERENCES
// when a scenario still references the rainfall, 403 for viewers, 401 anon.
export const deleteRainfallV2 = (projectId, rainfallId) =>
    axios.delete(`/api/v2/anuga/projects/${projectId}/rainfalls/${rainfallId}/`);

// TASK-723: V2 DELETE wrappers extending the V2P-714 cascade-delete pattern
// to 5 more dataset types (NETWORK intentionally excluded). Each route mirrors
// the V2P-714 shape: ProjectViewSetV2 nested route, BE signals cascade-clean
// of GeoNode Dataset + GeoServer layer + GeoFence rules + S3 artefacts.
// Returns 204 on success; 409 ACTIVE_REFERENCES if scenarios still reference.
export const deleteStructureV2 = (projectId, structureId) =>
    axios.delete(`/api/v2/anuga/projects/${projectId}/structures/${structureId}/`);

export const deleteMeshRegionV2 = (projectId, meshRegionId) =>
    axios.delete(`/api/v2/anuga/projects/${projectId}/mesh-regions/${meshRegionId}/`);

export const deleteCatchmentV2 = (projectId, catchmentId) =>
    axios.delete(`/api/v2/anuga/projects/${projectId}/catchments/${catchmentId}/`);

export const deleteNodesV2 = (projectId, nodesId) =>
    axios.delete(`/api/v2/anuga/projects/${projectId}/nodes/${nodesId}/`);

export const deleteLinksV2 = (projectId, linksId) =>
    axios.delete(`/api/v2/anuga/projects/${projectId}/links/${linksId}/`);

// TASK-829 (W4.2b) — FrictionRaster V2 DELETE wrapper. Raster lineage
// (sibling to Terrain): BE cascade-cleans 1 gn_layer + 1 S3 TIF. 204 on
// success; 409 ACTIVE_REFERENCES if a scenario still uses it.
export const deleteFrictionRasterV2 = (projectId, frictionRasterId) =>
    axios.delete(`/api/v2/anuga/projects/${projectId}/friction-rasters/${frictionRasterId}/`);

// V2P-79 / V2P-72: V1 POST /anuga/api/{pid}/scenario/compare/
//      → V2 POST /api/v2/anuga/projects/{pid}/scenarios/compare/ (CompareView).
// Body shape now {scenario_one_id, scenario_two_id} per V2 contract.
// V1 callers passed an array of scenarios; we adapt for back-compat — the
// epic dispatching this still passes the same payload it always did.
export const compareScenarios = (projectId, scenarios) => {
    // V1 payload was [{id: <int>}, {id: <int>}] (per V1 ComparisonViewSet
    // contract). V2 wants an explicit {scenario_one_id, scenario_two_id}.
    // Translate at the API boundary so callers don't have to.
    if (Array.isArray(scenarios) && scenarios.length === 2) {
        return axios.post(
            `/api/v2/anuga/projects/${projectId}/scenarios/compare/`,
            {
                scenario_one_id: scenarios[0]?.id,
                scenario_two_id: scenarios[1]?.id
            }
        );
    }
    // Pass-through for any caller already using the V2 body shape.
    return axios.post(`/api/v2/anuga/projects/${projectId}/scenarios/compare/`, scenarios);
};

// -- Network ---------------------------------------------------------------

// V2P-79: V1 POST /anuga/api/{pid}/network/{nid}/run/
//      → V2 POST /api/v2/anuga/projects/{pid}/networks/{nid}/run/  (V2P-75)
export const runNetwork = (projectId, networkId, data) =>
    axios.post(`/api/v2/anuga/projects/${projectId}/networks/${networkId}/run/`, data);

// -- Comparison / Compute --------------------------------------------------

// V2P-79: V1 GET /anuga/api/{pid}/compute-instance/  (project-scoped)
//      → V2 GET /api/v2/anuga/compute-instances/  (V2P-76, global, NOT
//        project-scoped — compute templates are global resources).
// Caller passes projectId for backwards-compat; we drop it. Response is
// the same list-of-templates shape; no FE consumer reads project_id off
// returned rows.
export const getComputeInstances = (_projectId) =>
    axios.get('/api/v2/anuga/compute-instances/');

// -- Publication / Figures -------------------------------------------------

// V2P-79: V1 → V2 routes the create-figure action (V2P-76 PublicationViewSetV2).
export const createFigure = (projectId, publicationId, title) =>
    axios.post(`/api/v2/anuga/projects/${projectId}/publications/${publicationId}/create-figure/`, { title });

// -- Dataset search --------------------------------------------------------

// Already V2 (GeoNode core endpoint, not /anuga/api/).
export const searchDataset = (datasetName) =>
    axios.get(`/api/v2/datasets?search=${datasetName}&search_fields=name`);

// TASK-2165 — recalculate a dataset's bbox from PostGIS truth after a
// VectorDraw WFS-T save (which bypasses Django, leaving the createlayer
// world-extent placeholder on the GeoServer featuretype + GeoNode Dataset).
// Fire-and-forget from vectorDrawRecalcBboxEpic; BE requires
// change_dataset_data on the dataset. layerName may carry the "geonode:"
// workspace prefix (the BE strips it).
export const recalcDatasetBbox = (layerName) =>
    axios.post('/api/v2/anuga/datasets/recalc-bbox/', { layer_name: layerName });

// -- v2 Project -----------------------------------------------------------

export const getProjectV2 = (projectId) =>
    axios.get(`/api/v2/anuga/projects/${projectId}/`);

export const getProjectsV2 = (pageSize = 100, page = 1) =>
    axios.get('/api/v2/anuga/projects/', { params: { page_size: pageSize, page } });

// V2P-21 — batch perm fetch for the whole project. Backend caches with
// Cache-Control: private, max-age=60. See V2P-20 endpoint at
// /opt/hydrata/apps/gn_anuga/api_v2.py::ProjectViewSetV2.my_perms.
export const getMyPerms = (projectId) =>
    axios.get(`/api/v2/anuga/projects/${projectId}/my-perms/`);

// -- v2 Scenarios ---------------------------------------------------------

export const createScenarioV2 = (projectId, scenario) =>
    axios.post(`/api/v2/anuga/projects/${projectId}/scenarios/`, scenario);

export const deleteScenarioV2 = (projectId, scenarioId) =>
    axios.delete(`/api/v2/anuga/projects/${projectId}/scenarios/${scenarioId}/`);

// Returns the freshly-created Scenario row (ScenarioSerializerV2 shape) at 201.
// FK relations are shallow-shared with the source — see _duplicate_scenario
// contract in /opt/hydrata/apps/gn_anuga/api_v2.py for the full behaviour.
export const duplicateScenario = (projectId, scenarioId) =>
    axios.post(`/api/v2/anuga/projects/${projectId}/scenarios/${scenarioId}/duplicate/`);

// 412 Precondition Failed when the scenario has an active or queued compute
// job — caller must cancel the run before archiving.
export const archiveScenario = (projectId, scenarioId) =>
    axios.post(`/api/v2/anuga/projects/${projectId}/scenarios/${scenarioId}/archive/`);

// Idempotent on already-active rows. The @action skips the default
// `archived_at IS NULL` queryset filter so the FE does NOT need to attach
// `?archived=` query params.
export const unarchiveScenario = (projectId, scenarioId) =>
    axios.post(`/api/v2/anuga/projects/${projectId}/scenarios/${scenarioId}/unarchive/`);

// TASK-958: explicit build endpoint, decoupled from PATCH. POST /build/ always
// triggers make_package_async.delay regardless of which fields changed (PATCH
// only triggers when a BUILD_AFFECTING_FIELDS field is in the payload).
// Returns 202 + {status: 'building', scenario_id}.
export const buildScenario = (projectId, scenarioId) =>
    axios.post(`/api/v2/anuga/projects/${projectId}/scenarios/${scenarioId}/build/`);

// List scenarios with explicit archive filter. mode='none' (default) returns
// active only; 'only' returns archived only; 'all' returns both.
export const getScenariosByArchive = (projectId, mode = 'none') =>
    axios.get(`/api/v2/anuga/projects/${projectId}/scenarios/?archived=${encodeURIComponent(mode)}`);

// -- v2 Run lifecycle -----------------------------------------------------

// TASK-2194 (epic 2190 W2) — dispatch POSTs the flat `compute_target`
// ('local' | 'batch-x4' | 'batch-x32' | 'batch-gpu-a10g'); the legacy
// `compute_backend` field is IGNORED server-side since W1 and is no longer
// sent on ANY dispatch path. With no chosen target (non-staff, or staff who
// left the site default) the field is OMITTED entirely so the server
// resolves the site default — the FE gate is advisory only,
// StartRunView.post is the real gate (out-of-allowlist -> 409).
export const startRun = (scenarioId, computeTarget = null) =>
    axios.post(
        `/api/v2/anuga/scenarios/${scenarioId}/run/`,
        computeTarget ? { compute_target: computeTarget } : {}
    );

export const cancelRun = (runId) =>
    axios.post(`/api/v2/anuga/runs/${runId}/cancel/`);

export const retryRun = (runId) =>
    axios.post(`/api/v2/anuga/runs/${runId}/retry/`);

export const getRunStatus = (runId) =>
    axios.get(`/api/v2/anuga/runs/${runId}/status/`);

export const getRun = (runId) =>
    axios.get(`/api/v2/anuga/runs/${runId}/`);

// -- Memberships ----------------------------------------------------------

// V2P-79 / V2P-722: V1 /member/  → V2 /members/  (path now plural).
// Body/response shape preserved verbatim. ProjectMembership.role still
// integer, user still PrimaryKeyRelatedField.
export const getMemberships = (projectId) =>
    axios.get(`/api/v2/anuga/projects/${projectId}/members/`);

export const addMembership = (projectId, userId, role) =>
    axios.post(`/api/v2/anuga/projects/${projectId}/members/`, { user: userId, role });

export const searchUsers = (query) =>
    axios.get('/api/v2/users/', { params: { search: query, page_size: 10 } });

export const updateMembership = (projectId, membershipId, role) =>
    axios.patch(`/api/v2/anuga/projects/${projectId}/members/${membershipId}/`, { role });

export const deleteMembership = (projectId, membershipId) =>
    axios.delete(`/api/v2/anuga/projects/${projectId}/members/${membershipId}/`);

// -- Project visibility ---------------------------------------------------

export const updateProjectVisibility = (projectId, visibility) =>
    axios.patch(`/api/v2/anuga/projects/${projectId}/`, { visibility });

// -- Checkout (TASK-2099 / TASK-2100, epic 2092 W2.2/W4) -------------------
//
// POST-only DRF endpoint — an <a href> click 405s (the checkout_url trap
// documented on paywallContract.js / PaywallPanel's UpgradeModal). The
// checkout epic POSTs here then redirects the browser to the returned
// session.url. Shared by the subscription flow (2099) and the compute-meter
// credit-pack flow (2100, purchaseType='credit_pack' + priceId).
export const createCheckoutSession = (projectId, purchaseType = 'subscription', priceId) => {
    const body = { purchase_type: purchaseType };
    if (purchaseType === 'credit_pack') {
        body.price_id = priceId;
    } else {
        body.project_id = projectId;
    }
    return axios.post('/commerce/checkout/create-session/', body);
};

// -- Compute meter (TASK-2100, epic 2092 W4.2) -----------------------------

export const getComputeBalance = () =>
    axios.get('/commerce/balance/');

// -- Invitations (TASK-860 / TASK-855/856) ---------------------------------
//
// All endpoints are project-scoped and require MANAGER or OWNER role.
// send/resend are guarded on the BE by HYDRATA_PERMISSIONS_INVITE_MODEL;
// the FE reads `invitations_enabled` from the GET list response to gate
// the invite form (RFC decision d).

/**
 * GET /api/v2/anuga/projects/{pid}/invitations/
 * Returns { invitations_enabled: bool, results: [...] } for the FE to read
 * the flag + list pending/accepted invitations in one request.
 */
export const listInvitations = (projectId) =>
    axios.get(`/api/v2/anuga/projects/${projectId}/invitations/`);

/**
 * POST /api/v2/anuga/projects/{pid}/invitations/
 * Body: { email: string, role: int }. Returns 202 regardless of whether
 * the email is registered (email-enumeration guardrail).
 */
export const sendInvitation = (projectId, email, role) =>
    axios.post(`/api/v2/anuga/projects/${projectId}/invitations/`, { email, role });

/**
 * DELETE /api/v2/anuga/projects/{pid}/invitations/{pk}/
 * Revokes a pending or accepted invitation. Returns 204.
 */
export const revokeInvitation = (projectId, invitationId) =>
    axios.delete(`/api/v2/anuga/projects/${projectId}/invitations/${invitationId}/`);

/**
 * POST /api/v2/anuga/projects/{pid}/invitations/{pk}/resend/
 * Resends the invite email. Returns 202. 5-minute cooldown enforced BE-side.
 * Guarded by HYDRATA_PERMISSIONS_INVITE_MODEL on the BE.
 */
export const resendInvitation = (projectId, invitationId) =>
    axios.post(`/api/v2/anuga/projects/${projectId}/invitations/${invitationId}/resend/`);

// TASK-1720 (W3) — Patch a terrain's styling_mode ('dynamic'|'traditional').
// PATCH /api/v2/anuga/projects/{pid}/terrain/{pk}/ with body {styling_mode}.
// Returns the updated Terrain serializer (TerrainSerializerV2 shape).
// Only styling_mode is writable here (all other fields are read-only on PATCH).
export const patchTerrainStylingMode = (projectId, terrainId, stylingMode) =>
    axios.patch(
        `/api/v2/anuga/projects/${projectId}/terrain/${terrainId}/`,
        { styling_mode: stylingMode }
    );

// -- Site config (TASK-964; compute targets TASK-2194, epic 2190 W2) --------

// GET /api/v2/anuga/config/ — returns:
//   {
//     default_compute_backend: 'local'|'ec2'|'batch',   // legacy (TASK-964)
//     celery_anuga_enabled: bool,
//     available_compute_targets: ['local'|'batch-x4'|...],  // site allowlist
//     default_compute_target: '<target>' | null,
//     mesh_divergence_threshold: number  // TASK-2211 (W3.2, epic 2204, od-4)
//   }
// Per-site values are sourced from Ansible inventory. On network error we
// fall back to the legacy 'local' backend default with an EMPTY target
// allowlist — an empty allowlist hides the staff compute-target selector,
// so dispatch omits compute_target and the server default applies (the
// server is the real gate either way). mesh_divergence_threshold is
// deliberately OMITTED from the fallback (undefined, not a guessed number)
// — uiReducer.js's shape-tolerant SET_ANUGA_COMPUTE_CONFIG case leaves it
// null, and scenarioHelpers.getMeshDivergence falls back to
// DEFAULT_MESH_DIVERGENCE_THRESHOLD when the prop is null/undefined.
export function getAnugaConfig() {
    return axios.get('/api/v2/anuga/config/')
        .then(r => r.data)
        .catch(() => ({
            default_compute_backend: 'local',
            available_compute_targets: [],
            default_compute_target: null
        }));
}

// -- Staff run-actuals ledger (TASK-1964, epic 1952 W5.1) ------------------

// GET /api/v2/anuga/admin/runs/ — staff-only (IsAdminUser), fleet-wide Batch
// resource ledger (AdminRunResourceViewSetV2, TASK-1962/W4.1). Non-staff get
// a 401/403 from the BE; this call does not itself gate access, it just
// surfaces whatever the API returns. `params` carries the server-filterable
// query params (see runsDashboardUtils.buildServerParams) — page_size
// defaults to the API max (500) so the whole (small) corpus comes back in
// one request.
export const listAdminRunLedger = (params = {}) =>
    axios.get(parseDevHostname('/api/v2/anuga/admin/runs/'), { params: { page_size: 500, ...params } });
