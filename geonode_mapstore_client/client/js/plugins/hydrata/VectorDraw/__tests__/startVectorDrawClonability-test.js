/*
 * Regression test (2026-06-23) — startVectorDraw must be structured-clone-safe.
 *
 * THE BUG IT GUARDS
 * -----------------
 * The ANUGA edit pencil (boundary / inflow / rainfall) was silently inert on
 * PRODUCTION only. Root cause: simpleViewMenuRow.onEdit dispatches
 *   startVectorDraw({ ...formConfig: ANUGA_FEATURE_CONFIG[prefix].formConfig })
 * and the discriminator-picker `data` field used to carry React render
 * COMPONENTS (ConstantInput / TimeSeriesSelect) and a `fetch` loader inline on
 * `field.choices[].render` / `.fetch`. Those are FUNCTIONS. On prod, OpenReplay's
 * tracker-redux middleware does `Worker.postMessage(action)` for every dispatched
 * action; postMessage structured-clones the payload, which CANNOT serialize a
 * function, throwing an uncaught synchronous DataCloneError that aborted the
 * describe->draw transition. (Localhost has no OpenReplay key, so it never fired
 * there — hence prod-only.)
 *
 * THE FIX it pins: choice descriptors now carry only a serializable `kind`
 * string; DiscriminatorPicker resolves the render component / fetch loader from
 * the kind-keyed discriminatorRegistry at render time. So the startVectorDraw
 * action payload is structured-clone-safe.
 *
 * FAIL-BEFORE / PASS-AFTER: on the pre-fix code (`render: ConstantInput` etc. in
 * ANUGA_FEATURE_CONFIG) the assertions below FAIL — structuredClone throws and
 * the deep function-walk finds 3 function values. After the fix they PASS.
 */
import expect from 'expect';
import { ANUGA_FEATURE_CONFIG, getAnugaPrefix } from '../../SimpleView/components/simpleViewMenuRow';
import { startVectorDraw } from '../actionsVectorDraw';

// Mirror simpleViewMenuRow.onEdit: build the EXACT action object dispatched
// for a given ANUGA layer prefix.
const buildStartVectorDrawAction = (prefix) => {
    const cfg = ANUGA_FEATURE_CONFIG[prefix];
    return startVectorDraw({
        layerName: `geonode:${prefix}123_example`,
        geomType: cfg.geomType,
        featureId: null,
        allowPick: true,
        owner: 'anuga',
        formConfig: cfg.formConfig,
        onComplete: 'ANUGA:VECTOR_DRAW_COMPLETE',
        onCancel: 'ANUGA:VECTOR_DRAW_CANCELLED',
        meta: { prefix, layerId: 7 }
    });
};

// Deep walk collecting "path = name()" for every function value found.
const collectFunctionPaths = (obj, path = 'action', acc = []) => {
    if (!obj || typeof obj !== 'object') { return acc; }
    Object.keys(obj).forEach((k) => {
        const v = obj[k];
        if (typeof v === 'function') {
            acc.push(`${path}.${k} = ${v.name || 'anonymous'}()`);
        } else if (v && typeof v === 'object') {
            collectFunctionPaths(v, `${path}.${k}`, acc);
        }
    });
    return acc;
};

describe('startVectorDraw structured-clone safety (DataCloneError regression)', () => {

    // Every ANUGA prefix that has a non-null formConfig is editable via the
    // pencil -> startVectorDraw. We assert clonability for ALL of them, not just
    // boundary, so a future formConfig that re-introduces a render-fn is caught.
    const editablePrefixes = Object.keys(ANUGA_FEATURE_CONFIG)
        .filter((p) => ANUGA_FEATURE_CONFIG[p].formConfig);

    it('covers every editable ANUGA prefix (sanity: list is non-empty + includes the discriminator ones)', () => {
        expect(editablePrefixes.length).toBeGreaterThan(0);
        // The three discriminator-picker bearers must be in scope.
        ['bdy_', 'inf_', 'rai_'].forEach((p) => {
            expect(editablePrefixes.indexOf(p)).toNotBe(-1);
        });
    });

    editablePrefixes.forEach((prefix) => {
        describe(`prefix "${prefix}" (${ANUGA_FEATURE_CONFIG[prefix].formConfig.title})`, () => {

            it('startVectorDraw action carries NO function values', () => {
                const action = buildStartVectorDrawAction(prefix);
                const fnPaths = collectFunctionPaths(action);
                expect(fnPaths).toEqual([]);
            });

            it('structuredClone(action) does not throw DataCloneError', () => {
                const action = buildStartVectorDrawAction(prefix);
                // structuredClone is available in the Karma/Chrome runtime.
                expect(() => structuredClone(action)).toNotThrow();
            });

            it('Worker-equivalent serialization (the exact prod mechanism) does not throw', () => {
                const action = buildStartVectorDrawAction(prefix);
                // postMessage uses the same structured-clone algorithm OpenReplay's
                // tracker-redux Worker uses. MessageChannel exercises it without a
                // real Worker URL/blob (works under Karma+headless Chrome).
                const exercise = () => {
                    const ch = new MessageChannel();
                    ch.port1.postMessage(action);
                    ch.port1.close();
                    ch.port2.close();
                };
                expect(exercise).toNotThrow();
            });
        });
    });

    it('getAnugaPrefix still resolves a boundary layer (guards the import surface)', () => {
        expect(getAnugaPrefix('geonode:bdy_123_example')).toBe('bdy_');
    });
});
