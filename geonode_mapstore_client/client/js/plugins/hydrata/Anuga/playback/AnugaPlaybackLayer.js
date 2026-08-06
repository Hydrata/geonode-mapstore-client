/**
 * Copyright 2026, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * AnugaPlaybackLayer — registers the `'anuga-playback'` OL layer type
 * (TASK-2626, W2.2, epic 2618): a self-managed WebGL2 canvas driven by
 * `ol/layer/Layer`'s `render(frameState)` hook (AnugaPlaybackRenderer),
 * mesh-vertex UTM->EPSG:3857 reprojection off the main thread
 * (playbackReproject.worker), two-buffer timestep mixing, an LUT colormap,
 * and a wireframe toggle for the as-run mesh.
 *
 * REGISTRATION (the TASK-2580-class trap this guards against): the Anuga
 * plugin (plugins/hydrata/Anuga/Anuga.js) is LAZY-loaded
 * (plugins/index.js's AnugaPlugin: toModulePlugin(..., () => import(...))) —
 * a dynamic import that only resolves once the plugin actually mounts.
 * `Layers.createLayer('anuga-playback', ...)` is called by MapStore's map
 * bootstrap machinery from persisted map state, which can — and on a fresh
 * page load, DOES — run before the Anuga plugin chunk has loaded. If this
 * module's `Layers.registerType` call lived inside the lazy Anuga plugin
 * chunk, `createLayer` would silently return null on cold load (Layers.js:
 * unregistered types just fall through to null — no error, no warning).
 *
 * Fix: this module is imported for its SIDE EFFECT (the registerType call
 * below) from `js/plugins/index.js` — gmc's OWN plugin-registry module,
 * which `js/apps/gn-map.js` (the map app entry point) imports eagerly at
 * the top of the file, unconditionally, before the store/map is created.
 * That import runs synchronously as part of the main bundle, well before
 * any lazy plugin chunk resolves — see the mandatory mount-order test in
 * __tests__/AnugaPlaybackLayer-test.js ("cold load -> createLayer !== null,
 * proven against a KNOWN-REGISTERED control type").
 *
 * The MapStore2 fork (client/MapStore2/web/client/components/map/openlayers/
 * plugins/index.js, the OL-layer-type "create()" component registry) is
 * DELIBERATELY NOT edited — Layers.registerType is a plain call into a
 * module-level Map (see Layers.js), not a registry that file owns; any
 * eagerly-loaded module can call it. Editing the fork would drag a
 * submodule-pin + dist-recompile dance for something this call site doesn't
 * need (see the W2 wave report's simplify_findings for the recorded
 * tradeoff).
 */
import Layer from 'ol/layer/Layer';
import Layers from '@mapstore/framework/utils/openlayers/Layers';

import { AnugaPlaybackRenderer } from './AnugaPlaybackRenderer';
import { reprojectMeshVertices, isUtmWgs84Epsg } from './playbackReproject';
import { packQuantityVec3 } from './playbackMeshGeometry';

export const LAYER_TYPE = 'anuga-playback';

function packFrame(frame) {
    if (!frame) {
        return null;
    }
    return packQuantityVec3(frame.depth, frame.xVelocity, frame.yVelocity);
}

/**
 * Off-main-thread mesh reprojection with a same-thread fallback (a Worker
 * script can fail to load — e.g. this exact karma test environment, which
 * doesn't serve emitted webpack worker chunks — DecompressionStream-style
 * "assume it might not be there" defensiveness, not a happy-path-only
 * implementation). Resolves with the SAME shape either way.
 * @param {{nodeX: Float32Array, nodeY: Float32Array, epsg: (number|string), xllcorner?: number, yllcorner?: number}} mesh
 * @returns {Promise<{x3857: Float64Array, y3857: Float64Array}>}
 */
function reprojectMeshAsync(mesh) {
    const runInline = () => Promise.resolve().then(() => {
        const { x, y } = reprojectMeshVertices(mesh.nodeX, mesh.nodeY, mesh);
        return { x3857: x, y3857: y };
    });
    if (typeof Worker === 'undefined') {
        return runInline();
    }
    return new Promise((resolve) => {
        let settled = false;
        let worker;
        try {
            worker = new Worker(new URL('./playbackReproject.worker.js', import.meta.url));
        } catch (e) {
            resolve(runInline());
            return;
        }
        const cleanup = () => {
            try {
                worker.terminate();
            } catch (e) { /* already gone */ }
        };
        worker.onmessage = (event) => {
            if (settled) {
                return;
            }
            settled = true;
            cleanup();
            const { x, y, error } = event.data || {};
            if (error || !x || !y) {
                resolve(runInline());
                return;
            }
            resolve({ x3857: x, y3857: y });
        };
        worker.onerror = () => {
            if (settled) {
                return;
            }
            settled = true;
            cleanup();
            resolve(runInline());
        };
        // localX/localY are transferred (not copied) — the caller must not
        // reuse mesh.nodeX/nodeY after this call.
        worker.postMessage(
            { requestId: 1, localX: mesh.nodeX, localY: mesh.nodeY, epsg: mesh.epsg, xllcorner: mesh.xllcorner, yllcorner: mesh.yllcorner },
            [mesh.nodeX.buffer, mesh.nodeY.buffer]
        );
    });
}

function loadMesh(renderer, olLayer, mesh) {
    if (!mesh) {
        return;
    }
    reprojectMeshAsync(mesh).then(({ x3857, y3857 }) => {
        // friction/inradius (TASK-2629, W4.1) are STATIC per-vertex arrays
        // like elevation — never transferred to the reprojection worker (only
        // nodeX/nodeY are, see reprojectMeshAsync's header), so they are safe
        // to read straight off `mesh` here with no clone/detach concern.
        renderer.setMesh({
            x3857,
            y3857,
            elevation: mesh.elevation,
            faceNodeConnectivity: mesh.faceNodeConnectivity,
            friction: mesh.friction,
            inradius: mesh.vertexInradius
        });
        olLayer.changed(); // request a repaint now that the mesh is ready
    }).catch(() => {
        // Never let a reprojection failure crash the map — the layer just
        // stays in its pre-mesh (blank) state, same as before load started.
    });
}

/**
 * TASK-2633 (W5.2) — particles must keep animating on a FROZEN (paused)
 * field just as much as an evolving one (AC), but `ol/layer/Layer`'s
 * `render(frameState)` hook is otherwise purely REACTIVE — OL only calls it
 * when the map itself has a reason to repaint (interaction, an explicit
 * `layer.changed()`, an ACTIVE playback tick's own `changeLayerProperties`).
 * With playback paused and the camera still, nothing would ever call
 * render() again, and the particle overlay would visibly freeze despite
 * `particlesEnabled`. This self-driving rAF loop is the fix: while
 * `particlesEnabled` is true, it repeatedly calls `olLayer.changed()` (a
 * cheap OL dirty-flag) to keep requesting repaints, and stops itself the
 * frame `particlesEnabled` goes false or the layer is removed (own
 * eviction discipline, AC) — never runs when nothing needs it.
 * @param {import('ol/layer/Layer').default} olLayer
 * @returns {{start: function(): void, stop: function(): void}}
 */
function makeParticleAnimLoop(olLayer) {
    let frameHandle = null;
    const tick = () => {
        if (!olLayer.get('particlesEnabled')) {
            frameHandle = null;
            return;
        }
        olLayer.changed();
        frameHandle = requestAnimationFrame(tick);
    };
    return {
        start() {
            if (frameHandle === null) {
                frameHandle = requestAnimationFrame(tick);
            }
        },
        stop() {
            if (frameHandle !== null) {
                cancelAnimationFrame(frameHandle);
                frameHandle = null;
            }
        }
    };
}

function create(options = {}, map) {
    const renderer = new AnugaPlaybackRenderer();

    const olLayer = new Layer({
        msId: options.id,
        opacity: options.opacity !== undefined ? options.opacity : 1,
        visible: options.visibility !== false,
        zIndex: options.zIndex,
        render(frameState) {
            return renderer.render({
                viewState: frameState.viewState,
                size: frameState.size,
                pixelRatio: frameState.pixelRatio,
                opacity: olLayer.getOpacity(),
                wireframe: !!olLayer.get('wireframe'),
                mixT: olLayer.get('mixT') || 0,
                colorMode: olLayer.get('colorMode') || 'depth',
                colorMax: olLayer.get('colorMax') || 1,
                colorMin: olLayer.get('colorMin') || 0,
                // TASK-2629 (W4.1) — the store's OWN minimum_storable_height/
                // g/rho_w, never a hardcoded guess; the 1e-5/9.8/1000 fallbacks
                // below only cover a caller that never set these (e.g. a karma
                // GL smoke test) — production always sets them from schema_metadata
                // (playbackEpics.playbackSyncLayerEpic's baseProps).
                wetThreshold: olLayer.get('wetThreshold') || 1e-5,
                g: olLayer.get('g') || 9.8,
                rhoW: olLayer.get('rhoW') || 1000,
                dt: olLayer.get('dt') || 0,
                // TASK-2632 (W5.1) — velocity-arrow overlay toggle/controls,
                // a plain layer-level rendering setting (same class as
                // `wireframe` above — NOT plumbed through the anugaPlayback
                // controller reducer, which owns buffer-then-play/timeline
                // state, not visual overlay knobs).
                flowVizEnabled: !!olLayer.get('flowVizEnabled'),
                arrowDensity: olLayer.get('arrowDensity'),
                arrowScale: olLayer.get('arrowScale'),
                // TASK-2633 (W5.2) — particle-trail overlay toggle/controls,
                // same plain layer-level-setting class as the arrow overlay
                // above.
                particlesEnabled: !!olLayer.get('particlesEnabled'),
                particleDensity: olLayer.get('particleDensity'),
                particleSpeedExaggeration: olLayer.get('particleSpeedExaggeration')
            });
        }
    });
    olLayer.set('wireframe', !!options.wireframe);
    olLayer.set('mixT', options.mixT || 0);
    olLayer.set('colorMode', options.colorMode || 'depth');
    olLayer.set('colorMax', options.colorMax || 1);
    olLayer.set('colorMin', options.colorMin || 0);
    olLayer.set('wetThreshold', options.wetThreshold || 1e-5);
    olLayer.set('g', options.g || 9.8);
    olLayer.set('rhoW', options.rhoW || 1000);
    olLayer.set('dt', options.dt || 0);
    olLayer.set('flowVizEnabled', !!options.flowVizEnabled);
    olLayer.set('arrowDensity', options.arrowDensity);
    olLayer.set('arrowScale', options.arrowScale);
    olLayer.set('particlesEnabled', !!options.particlesEnabled);
    olLayer.set('particleDensity', options.particleDensity);
    olLayer.set('particleSpeedExaggeration', options.particleSpeedExaggeration);
    // Internal handle update() needs — not an OL/observable property.
    olLayer.__anugaPlaybackRenderer = renderer;

    // TASK-2633 (W5.2) — start the self-driving repaint loop immediately if
    // particles are enabled from creation; update() also starts/stops it on
    // a later toggle (see below). Internal handle, not an OL property.
    olLayer.__anugaParticleAnimLoop = makeParticleAnimLoop(olLayer);
    if (options.particlesEnabled) {
        olLayer.__anugaParticleAnimLoop.start();
    }

    // This layer has NO ol Source (it self-manages a WebGL2 canvas via the
    // `render` hook above) — MapStore's generic <Layer> wrapper
    // (MapStore2/.../openlayers/Layer.jsx addLayer()) unconditionally calls
    // `this.layer.getSource().on('tileloadstart', ...)` right after adding
    // ANY non-detached layer to the map, which crashes the whole React tree
    // for a source-less layer (`Cannot read properties of null (reading
    // 'on')` — caught live, W2 wave report). `detached: true` is the
    // escape hatch Layer.jsx itself defines (see OverlayLayer.js's
    // Layers.registerType('overlay', ...) for the only other in-stack use):
    // it skips addLayer()/getSource() entirely and instead requires THIS
    // create() to attach to the map itself, and a `.remove()` method for
    // Layer.jsx's componentWillUnmount to call instead of map.removeLayer().
    olLayer.detached = true;
    olLayer.remove = () => {
        if (map) {
            map.removeLayer(olLayer);
        }
        // TASK-2633 (W5.2) — stop the self-driving repaint loop FIRST (own
        // eviction discipline, AC): otherwise it would keep calling
        // `olLayer.changed()` on a layer no longer attached to any map.
        olLayer.__anugaParticleAnimLoop.stop();
        // Free GL buffers/VAOs/programs/textures — nothing else releases
        // them once the layer drops out of the map (simplify-pass finding,
        // W2 wave report: dispose() existed but nothing ever called it).
        renderer.dispose();
    };
    if (map) {
        map.addLayer(olLayer);
    }

    if (options.frame0 && options.frame1) {
        renderer.setFrames(packFrame(options.frame0), packFrame(options.frame1));
    }
    if (options.mesh) {
        loadMesh(renderer, olLayer, options.mesh);
    }

    return olLayer;
}

function update(layer, newOptions, oldOptions, map) {
    const renderer = layer.__anugaPlaybackRenderer;
    if (!renderer) {
        return create(newOptions, map);
    }
    if (newOptions.mesh !== oldOptions.mesh) {
        loadMesh(renderer, layer, newOptions.mesh);
    }
    if (newOptions.frame0 !== oldOptions.frame0 || newOptions.frame1 !== oldOptions.frame1) {
        if (newOptions.frame0 && newOptions.frame1) {
            renderer.setFrames(packFrame(newOptions.frame0), packFrame(newOptions.frame1));
        }
    }
    if (newOptions.mixT !== oldOptions.mixT) {
        layer.set('mixT', newOptions.mixT || 0);
    }
    if (newOptions.wireframe !== oldOptions.wireframe) {
        layer.set('wireframe', !!newOptions.wireframe);
    }
    if (newOptions.colorMode !== oldOptions.colorMode) {
        layer.set('colorMode', newOptions.colorMode || 'depth');
    }
    if (newOptions.colorMax !== oldOptions.colorMax) {
        layer.set('colorMax', newOptions.colorMax || 1);
    }
    if (newOptions.colorMin !== oldOptions.colorMin) {
        layer.set('colorMin', newOptions.colorMin || 0);
    }
    if (newOptions.wetThreshold !== oldOptions.wetThreshold) {
        layer.set('wetThreshold', newOptions.wetThreshold || 1e-5);
    }
    if (newOptions.g !== oldOptions.g) {
        layer.set('g', newOptions.g || 9.8);
    }
    if (newOptions.rhoW !== oldOptions.rhoW) {
        layer.set('rhoW', newOptions.rhoW || 1000);
    }
    if (newOptions.dt !== oldOptions.dt) {
        layer.set('dt', newOptions.dt || 0);
    }
    if (newOptions.flowVizEnabled !== oldOptions.flowVizEnabled) {
        layer.set('flowVizEnabled', !!newOptions.flowVizEnabled);
    }
    if (newOptions.arrowDensity !== oldOptions.arrowDensity) {
        layer.set('arrowDensity', newOptions.arrowDensity);
    }
    if (newOptions.arrowScale !== oldOptions.arrowScale) {
        layer.set('arrowScale', newOptions.arrowScale);
    }
    if (newOptions.particlesEnabled !== oldOptions.particlesEnabled) {
        layer.set('particlesEnabled', !!newOptions.particlesEnabled);
        // TASK-2633 (W5.2) — start/stop the self-driving repaint loop in
        // lockstep with the toggle (see makeParticleAnimLoop's header).
        if (newOptions.particlesEnabled) {
            layer.__anugaParticleAnimLoop.start();
        } else {
            layer.__anugaParticleAnimLoop.stop();
        }
    }
    if (newOptions.particleDensity !== oldOptions.particleDensity) {
        layer.set('particleDensity', newOptions.particleDensity);
    }
    if (newOptions.particleSpeedExaggeration !== oldOptions.particleSpeedExaggeration) {
        layer.set('particleSpeedExaggeration', newOptions.particleSpeedExaggeration);
    }
    if (newOptions.opacity !== oldOptions.opacity) {
        layer.setOpacity(newOptions.opacity !== undefined ? newOptions.opacity : 1);
    }
    if (newOptions.visibility !== oldOptions.visibility) {
        layer.setVisible(newOptions.visibility !== false);
    }
    if (newOptions.zIndex !== oldOptions.zIndex) {
        layer.setZIndex(newOptions.zIndex);
    }
    layer.changed();
    return null; // handled in place — Layers.updateLayer's "no replacement needed" convention (see COGLayer.js)
}

export function isCompatible(options) {
    const epsg = options && options.mesh && options.mesh.epsg;
    // Permit creation before mesh data has arrived (epsg unknown yet); once
    // known, it must be a UTM WGS84 zone — the only family
    // playbackReproject.js currently knows how to place (schema §5: "zone"
    // itself is unreliable, TASK-2634 — epsg is the field this checks).
    return epsg === undefined || epsg === null || isUtmWgs84Epsg(epsg);
}

Layers.registerType(LAYER_TYPE, { create, update, isCompatible });

export default { create, update, isCompatible };
