import expect from 'expect';
import reducer from '../reducerVectorDraw';
import {
    START_VECTOR_DRAW,
    CANCEL_VECTOR_DRAW,
    DRAWING_COMPLETE,
    SUBMIT_FORM,
    UPDATE_FORM_VALUES,
    SAVE_SUCCESS,
    SAVE_ERROR,
    RESET,
    DESCRIBE_COMPLETE,
    SEED_FORM_VALUES,
    LOAD_FEATURE_LIST,
    SELECT_EXISTING_FEATURE,
    RETURN_TO_PICKER,
    DELETE_FEATURE
} from '../actionsVectorDraw';

describe('VectorDraw Reducer', () => {
    const initialState = {
        phase: 'idle',
        config: null,
        geometry: null,
        formValues: {},
        featureList: [],
        cameFromPicker: false,
        error: null
    };

    it('should return initial state', () => {
        const state = reducer(undefined, { type: 'UNKNOWN' });
        expect(state.phase).toBe('idle');
        expect(state.config).toBe(null);
        expect(state.geometry).toBe(null);
        expect(state.featureList).toEqual([]);
    });

    it('should handle START_VECTOR_DRAW', () => {
        const config = { layerName: 'geonode:test', geomType: 'Polygon', formConfig: null };
        const state = reducer(initialState, { type: START_VECTOR_DRAW, config });
        expect(state.phase).toBe('describing');
        expect(state.config).toBe(config);
        expect(state.geometry).toBe(null);
    });

    it('should build default form values from formConfig on START', () => {
        const config = {
            layerName: 'geonode:test',
            formConfig: {
                title: 'Test',
                fields: [
                    { name: 'location', type: 'select', "default": 'External' },
                    { name: 'value', type: 'number', "default": 42 },
                    { name: 'notes', type: 'text' }
                ]
            }
        };
        const state = reducer(initialState, { type: START_VECTOR_DRAW, config });
        expect(state.formValues).toEqual({ location: 'External', value: 42 });
    });

    it('should handle DESCRIBE_COMPLETE', () => {
        const prev = { ...initialState, phase: 'describing', config: {} };
        const state = reducer(prev, { type: DESCRIBE_COMPLETE });
        expect(state.phase).toBe('drawing');
    });

    it('should handle DRAWING_COMPLETE without formConfig → saving', () => {
        const prev = { ...initialState, phase: 'drawing', config: { formConfig: null } };
        const geometry = { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]] };
        const state = reducer(prev, { type: DRAWING_COMPLETE, geometry });
        expect(state.phase).toBe('saving');
        expect(state.geometry).toBe(geometry);
    });

    it('should handle DRAWING_COMPLETE with formConfig → form', () => {
        const prev = {
            ...initialState,
            phase: 'drawing',
            config: { formConfig: { title: 'Test', fields: [] } }
        };
        const geometry = { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]] };
        const state = reducer(prev, { type: DRAWING_COMPLETE, geometry });
        expect(state.phase).toBe('form');
        expect(state.geometry).toBe(geometry);
    });

    it('should handle SUBMIT_FORM → saving', () => {
        const prev = { ...initialState, phase: 'form', geometry: {}, formValues: { a: 1 } };
        const state = reducer(prev, { type: SUBMIT_FORM });
        expect(state.phase).toBe('saving');
    });

    it('should handle UPDATE_FORM_VALUES', () => {
        const prev = { ...initialState, formValues: { a: 1 } };
        const state = reducer(prev, { type: UPDATE_FORM_VALUES, fieldName: 'b', value: 2 });
        expect(state.formValues).toEqual({ a: 1, b: 2 });
    });

    it('should handle SEED_FORM_VALUES (overlays defaults with feature properties)', () => {
        const prev = { ...initialState, formValues: { a: 1, b: 2 } };
        const state = reducer(prev, {
            type: SEED_FORM_VALUES,
            properties: { b: 99, c: 3 }
        });
        expect(state.formValues).toEqual({ a: 1, b: 99, c: 3 });
    });

    it('should handle SEED_FORM_VALUES with empty/missing properties', () => {
        const prev = { ...initialState, formValues: { a: 1 } };
        const state = reducer(prev, { type: SEED_FORM_VALUES, properties: undefined });
        expect(state.formValues).toEqual({ a: 1 });
    });

    it('should handle LOAD_FEATURE_LIST → picking phase', () => {
        const features = [
            { id: 'l.1', properties: { title: 'A' } },
            { id: 'l.2', properties: { title: 'B' } }
        ];
        const prev = { ...initialState, phase: 'describing', config: { layerName: 'l' } };
        const state = reducer(prev, { type: LOAD_FEATURE_LIST, features });
        expect(state.phase).toBe('picking');
        expect(state.featureList).toEqual(features);
    });

    it('should handle SELECT_EXISTING_FEATURE with featureId → describing + config.featureId set', () => {
        const prev = {
            ...initialState,
            phase: 'picking',
            config: { layerName: 'l', allowPick: true },
            featureList: [{ id: 'l.1' }, { id: 'l.2' }]
        };
        const state = reducer(prev, { type: SELECT_EXISTING_FEATURE, featureId: 'l.2' });
        expect(state.phase).toBe('describing');
        expect(state.featureList).toEqual([]);
        expect(state.config.featureId).toBe('l.2');
        // pre-existing config keys passed through
        expect(state.config.layerName).toBe('l');
    });

    it('should handle SELECT_EXISTING_FEATURE with null → describing + config.featureId stays null', () => {
        const prev = {
            ...initialState,
            phase: 'picking',
            config: { layerName: 'l', allowPick: true },
            featureList: [{ id: 'l.1' }]
        };
        const state = reducer(prev, { type: SELECT_EXISTING_FEATURE, featureId: null });
        expect(state.phase).toBe('describing');
        expect(state.featureList).toEqual([]);
        expect(state.config.featureId).toBe(null);
    });

    it('should clear featureList on RESET', () => {
        const prev = {
            ...initialState,
            phase: 'picking',
            featureList: [{ id: 'a' }, { id: 'b' }]
        };
        const state = reducer(prev, { type: RESET });
        expect(state.featureList).toEqual([]);
        expect(state.phase).toBe('idle');
    });

    it('should clear featureList on SAVE_SUCCESS', () => {
        const prev = {
            ...initialState,
            phase: 'saving',
            featureList: [{ id: 'a' }]
        };
        const state = reducer(prev, { type: SAVE_SUCCESS });
        expect(state.featureList).toEqual([]);
        expect(state.phase).toBe('idle');
    });

    it('should handle SAVE_SUCCESS → reset to initial', () => {
        const prev = { ...initialState, phase: 'saving', geometry: {}, config: {} };
        const state = reducer(prev, { type: SAVE_SUCCESS });
        expect(state.phase).toBe('idle');
        expect(state.config).toBe(null);
    });

    it('should handle SAVE_ERROR', () => {
        const prev = { ...initialState, phase: 'saving' };
        const state = reducer(prev, { type: SAVE_ERROR, error: 'Network error' });
        expect(state.phase).toBe('error');
        expect(state.error).toBe('Network error');
    });

    it('should handle CANCEL_VECTOR_DRAW → cancelling (preserves config for epic)', () => {
        const config = { layerName: 'test', onCancel: 'TEST:CANCEL' };
        const prev = { ...initialState, phase: 'drawing', config };
        const state = reducer(prev, { type: CANCEL_VECTOR_DRAW });
        expect(state.phase).toBe('cancelling');
        expect(state.config).toBe(config);
    });

    it('CANCEL_VECTOR_DRAW captures previousPhase for the epic to read', () => {
        // The cancel epic distinguishes "X clicked on picker" from "X clicked
        // while drawing/form" by previousPhase. Reducer must store the prior
        // phase before flipping to 'cancelling' — otherwise the epic only
        // ever sees 'cancelling' and can't tell them apart.
        const fromPicker = reducer(
            { ...initialState, phase: 'picking', cameFromPicker: true },
            { type: CANCEL_VECTOR_DRAW }
        );
        expect(fromPicker.phase).toBe('cancelling');
        expect(fromPicker.previousPhase).toBe('picking');

        const fromDrawing = reducer(
            { ...initialState, phase: 'drawing', cameFromPicker: true },
            { type: CANCEL_VECTOR_DRAW }
        );
        expect(fromDrawing.previousPhase).toBe('drawing');

        const fromForm = reducer(
            { ...initialState, phase: 'form' },
            { type: CANCEL_VECTOR_DRAW }
        );
        expect(fromForm.previousPhase).toBe('form');
    });

    it('should handle RESET → reset to initial', () => {
        const prev = { ...initialState, phase: 'error', error: 'some error' };
        const state = reducer(prev, { type: RESET });
        expect(state.phase).toBe('idle');
        expect(state.error).toBe(null);
    });

    // TASK-784 picker-return — cameFromPicker flag + RETURN_TO_PICKER reducer.
    describe('cameFromPicker tracking + RETURN_TO_PICKER', () => {
        it('LOAD_FEATURE_LIST should set cameFromPicker=true', () => {
            const features = [{ id: 'l.1' }];
            const prev = { ...initialState, phase: 'describing', config: { layerName: 'l' } };
            const state = reducer(prev, { type: LOAD_FEATURE_LIST, features });
            expect(state.cameFromPicker).toBe(true);
        });

        it('initialState has cameFromPicker=false', () => {
            const state = reducer(undefined, { type: 'UNKNOWN' });
            expect(state.cameFromPicker).toBe(false);
        });

        it('RESET clears cameFromPicker', () => {
            const prev = { ...initialState, cameFromPicker: true, phase: 'picking' };
            const state = reducer(prev, { type: RESET });
            expect(state.cameFromPicker).toBe(false);
        });

        it('SAVE_SUCCESS clears cameFromPicker (full reset)', () => {
            const prev = { ...initialState, cameFromPicker: true, phase: 'saving' };
            const state = reducer(prev, { type: SAVE_SUCCESS });
            expect(state.cameFromPicker).toBe(false);
        });

        it('START_VECTOR_DRAW without flag clears cameFromPicker (new external flow)', () => {
            const prev = { ...initialState, cameFromPicker: true };
            const state = reducer(prev, {
                type: START_VECTOR_DRAW,
                config: { layerName: 'l' }
            });
            expect(state.cameFromPicker).toBe(false);
        });

        it('START_VECTOR_DRAW with config.cameFromPicker=true preserves the flag', () => {
            // The internal re-dispatch from vectorDrawSelectExistingEpic
            // threads cameFromPicker through action.config so the picker
            // breadcrumb survives the reset to initialState.
            const state = reducer(initialState, {
                type: START_VECTOR_DRAW,
                config: { layerName: 'l', cameFromPicker: true }
            });
            expect(state.cameFromPicker).toBe(true);
        });

        it('RETURN_TO_PICKER sets phase=picking and replaces featureList', () => {
            const features = [{ id: 'a.1' }, { id: 'a.2' }];
            const prev = {
                ...initialState,
                phase: 'saving',
                config: { layerName: 'l', allowPick: false, featureId: 'a.1' },
                geometry: { type: 'Polygon', coordinates: [] },
                formValues: { name: 'X' },
                cameFromPicker: true
            };
            const state = reducer(prev, { type: RETURN_TO_PICKER, features });
            expect(state.phase).toBe('picking');
            expect(state.featureList).toEqual(features);
            // ephemeral edit state cleared
            expect(state.geometry).toBe(null);
            // config preserved but featureId stripped (back to "no choice yet")
            expect(state.config.layerName).toBe('l');
            expect(state.config.featureId).toBe(undefined);
            expect(state.config.allowPick).toBe(true);
            expect(state.cameFromPicker).toBe(true);
        });

        it('RETURN_TO_PICKER with empty features still goes to picking (not idle)', () => {
            const prev = {
                ...initialState,
                phase: 'saving',
                config: { layerName: 'l' },
                cameFromPicker: true
            };
            const state = reducer(prev, { type: RETURN_TO_PICKER, features: [] });
            expect(state.phase).toBe('picking');
            expect(state.featureList).toEqual([]);
        });

        it('START_VECTOR_DRAW captures initialFormValues from buildDefaults (TASK-795 review I8)', () => {
            const config = {
                layerName: 'l',
                formConfig: {
                    fields: [
                        { name: 'kind', "default": 'A' },
                        { name: 'value', "default": 0 }
                    ]
                }
            };
            const state = reducer(initialState, { type: START_VECTOR_DRAW, config });
            // initialFormValues snapshot equals freshly-built defaults so a
            // CREATE-mode Cancel-without-touching is NOT flagged dirty.
            expect(state.initialFormValues).toEqual({ kind: 'A', value: 0 });
            expect(state.formValues).toEqual(state.initialFormValues);
        });

        it('SEED_FORM_VALUES refreshes initialFormValues to the merged shape (TASK-795 review I8)', () => {
            // EDIT-mode load: defaults + BE row properties. Without this
            // refresh, EDIT-mode Cancel would always think the form is
            // dirty (live values include seeded BE props that the initial
            // buildDefaults snapshot didn't have).
            const prev = {
                ...initialState,
                phase: 'describing',
                formValues: { kind: 'A' },
                initialFormValues: { kind: 'A' }
            };
            const state = reducer(prev, {
                type: SEED_FORM_VALUES,
                properties: { kind: 'B', description: 'Tide' }
            });
            expect(state.formValues).toEqual({ kind: 'B', description: 'Tide' });
            expect(state.initialFormValues).toEqual({ kind: 'B', description: 'Tide' });
        });

        it('UPDATE_FORM_VALUES does NOT touch initialFormValues (TASK-795 review I8 dirty detection)', () => {
            // The whole point of the snapshot is that subsequent edits
            // diverge from it — that's how Cancel detects "user typed
            // something" worth warning about.
            const prev = {
                ...initialState,
                formValues: { kind: 'A' },
                initialFormValues: { kind: 'A' }
            };
            const state = reducer(prev, {
                type: UPDATE_FORM_VALUES,
                fieldName: 'kind',
                value: 'B'
            });
            expect(state.formValues).toEqual({ kind: 'B' });
            expect(state.initialFormValues).toEqual({ kind: 'A' });
        });

        it('DELETE_FEATURE sets deletingFeatureId (TASK-795 review I3)', () => {
            const prev = {
                ...initialState,
                phase: 'picking',
                cameFromPicker: true,
                config: { layerName: 'l' },
                featureList: [{ id: 'l.1' }, { id: 'l.2' }]
            };
            const state = reducer(prev, { type: DELETE_FEATURE, featureId: 'l.2' });
            expect(state.deletingFeatureId).toBe('l.2');
            // featureList must NOT change here — the epic owns the
            // optimistic-vs-server-confirmed split. The picker keeps showing
            // the row (greyed out) until RETURN_TO_PICKER lands with the
            // refreshed list.
            expect(state.featureList).toEqual([{ id: 'l.1' }, { id: 'l.2' }]);
        });

        it('RETURN_TO_PICKER clears deletingFeatureId (TASK-795 review I3)', () => {
            const prev = {
                ...initialState,
                phase: 'picking',
                cameFromPicker: true,
                deletingFeatureId: 'l.2',
                config: { layerName: 'l' }
            };
            const state = reducer(prev, {
                type: RETURN_TO_PICKER,
                features: [{ id: 'l.1' }]
            });
            expect(state.deletingFeatureId).toBe(null);
        });

        it('RETURN_TO_PICKER on idle state is a no-op (TASK-795 review C2 guard)', () => {
            // The cancel epic resets state to phase='idle' before the in-flight
            // save/delete chain has fully unwound. takeUntil(CANCEL) on the
            // epics is the primary defence; this reducer guard is the
            // belt-and-braces backup so a stale RETURN_TO_PICKER tail doesn't
            // re-mount the picker on top of an idle reducer state with a null
            // config (which would render a header-less empty picker the user
            // can't recover from).
            const prev = { ...initialState, phase: 'idle', config: null };
            const state = reducer(prev, { type: RETURN_TO_PICKER, features: [{ id: 'l.1' }] });
            expect(state).toBe(prev);
            expect(state.phase).toBe('idle');
            expect(state.featureList).toEqual([]);
        });

        it('RETURN_TO_PICKER rebuilds form defaults from config.formConfig', () => {
            const prev = {
                ...initialState,
                phase: 'saving',
                config: {
                    layerName: 'l',
                    formConfig: {
                        fields: [
                            { name: 'kind', type: 'select', "default": 'A' }
                        ]
                    }
                },
                formValues: { kind: 'C' },
                cameFromPicker: true
            };
            const state = reducer(prev, { type: RETURN_TO_PICKER, features: [] });
            expect(state.formValues).toEqual({ kind: 'A' });
        });
    });
});
