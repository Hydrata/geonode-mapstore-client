/**
 * Pure estimate helpers for the Global Copernicus GLO-30 DEM bbox picker
 * confirmation popup. Kept dependency-free (no react / redux) so the math is
 * trivially unit-testable and shared between the epic (gate) and the panel
 * (display). All inputs are plain numbers; all outputs are display-ready
 * primitives or { value, unit } shapes the panel feeds to <Message msgParams>.
 *
 * Calibration anchors (measured / interpolated GLO-30 end-to-end "ready" time,
 * i.e. download + reproject + COG + hillshade + GeoServer publish):
 *   1,752 km2 -> ~106 s (measured)   2,500 km2 -> ~2.5 min
 *  10,000 km2 -> ~9 min             40,000 km2 -> ~33 min
 * The linear model seconds ~= 20 + 0.05 * areaKm2 fits these anchors closely
 * (e.g. 1752 -> 107.6 s, 2500 -> 145 s, 10000 -> 520 s, 40000 -> 2020 s) once
 * rounded UP to a friendly minute bucket.
 */

// Hard ceiling shared with the BE backstop (TASK-929 create-from-bbox view).
// Keep this number identical on both sides — ~200 x 200 km.
export const MAX_AREA_KM2 = 40000;

// GLO-30 is a 30 m DEM: 1 km2 holds roughly (1000/30)^2 ~= 1111 cells.
export const CELLS_PER_KM2 = 1111;

/**
 * Estimate the ANUGA cell count at 30 m resolution for a given area.
 * Returns a rounded integer (not formatted).
 */
export function estimateCells(areaKm2) {
    if (!isFinite(areaKm2) || areaKm2 <= 0) return 0;
    return Math.round(areaKm2 * CELLS_PER_KM2);
}

/**
 * Friendly cell-count string, e.g. "12,000", "2.8 million", "41 million".
 * Numbers under 1,000,000 are shown with thousands separators; larger numbers
 * collapse to "<n.n> million" so the popup stays readable.
 */
export function formatCells(cells) {
    if (!isFinite(cells) || cells <= 0) return '0';
    if (cells >= 1000000) {
        const millions = cells / 1000000;
        // 1 decimal place under 10M, whole numbers above (keeps it tidy).
        const rounded = millions < 10 ? Math.round(millions * 10) / 10 : Math.round(millions);
        return `${rounded} million`;
    }
    return Math.round(cells).toLocaleString('en-US');
}

/**
 * Estimate time-to-ready in seconds: linear model calibrated above.
 */
export function estimateSeconds(areaKm2) {
    if (!isFinite(areaKm2) || areaKm2 <= 0) return 0;
    return 20 + 0.05 * areaKm2;
}

/**
 * Friendly time bucket, rounding UP so we never under-promise:
 *   <= 60 s          -> "under a minute"
 *   otherwise        -> "about N minutes" (N = ceil(seconds / 60))
 */
export function formatTimeToReady(areaKm2) {
    const seconds = estimateSeconds(areaKm2);
    if (seconds <= 60) return 'under a minute';
    const minutes = Math.ceil(seconds / 60);
    return `about ${minutes} minutes`;
}

/**
 * Friendly area string in km2 with thousands separators, e.g. "1,752".
 * Sub-10 km2 keeps one decimal so tiny boxes don't read as "0".
 */
export function formatAreaKm2(areaKm2) {
    if (!isFinite(areaKm2) || areaKm2 <= 0) return '0';
    if (areaKm2 < 10) return (Math.round(areaKm2 * 10) / 10).toString();
    return Math.round(areaKm2).toLocaleString('en-US');
}

/**
 * Approximate width x height of the bbox in km, from a WGS84 lon/lat extent.
 * Uses a local equirectangular approximation (good enough for a "≈ W x H km"
 * label): 1 deg lat ~= 111.32 km; 1 deg lon scales by cos(mean latitude).
 * Returns { widthKm, heightKm } as numbers (rounded to integers, min 1).
 */
export function bboxDimsKm(bbox) {
    if (!Array.isArray(bbox) || bbox.length !== 4) return { widthKm: 0, heightKm: 0 };
    const [minLon, minLat, maxLon, maxLat] = bbox;
    const meanLatRad = ((minLat + maxLat) / 2) * Math.PI / 180;
    const heightKm = Math.abs(maxLat - minLat) * 111.32;
    const widthKm = Math.abs(maxLon - minLon) * 111.32 * Math.cos(meanLatRad);
    return {
        widthKm: Math.max(1, Math.round(widthKm)),
        heightKm: Math.max(1, Math.round(heightKm))
    };
}
