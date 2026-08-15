import expect from 'expect';
import reducer from '../reducersSimpleView';
// TASK-1441: import the canonical ResourcesCatalog selector so we can assert
// that it reads from state.resources.showDetails (not state.controls.*).
import { getShowDetails } from '@mapstore/framework/plugins/ResourcesCatalog/selectors/resources';
import {
    SET_OPEN_MENU_GROUP_ID,
    SET_VISIBLE_LEGEND_PANEL,
    SET_VISIBLE_INTRODUCTION,
    SET_VISIBLE_UPLOADER_PANEL,
    SET_VISIBLE_SV_ATTRIBUTE_FORM,
    SET_VISIBLE_SV_ATTRIBUTE_RESULT,
    SET_SV_ATTRIBUTE_RESULT,
    UPDATE_UPLOAD_STATUS,
    SV_SELECT_LAYER,
    SET_SV_CONFIG,
    CREATE_SV_ATTRIBUTE_FORM,
    SUBMIT_SV_ATTRIBUTE_FORM_SUCCESS,
    SET_PROCESSING_SV_ATTRIBUTE_FORM,
    SAVE_INTRODUCTION,
    INTRODUCTION_SAVED,
    INTRODUCTION_SAVE_FAILED,
    INTRODUCTION_LOADED,
    setOpenMenuGroupId,
    setVisibleLegendPanel,
    setVisibleIntroduction,
    setVisibleUploaderPanel,
    setVisibleSimpleViewAttributeForm,
    setVisibleSimpleViewAttributeResult,
    setSimpleViewAttributeResult,
    updateUploadStatus,
    svSelectLayer,
    setSvConfig,
    createSimpleViewAttributeForm,
    setProcessingSimpleViewAttributeForm
} from '../actionsSimpleView';
// TASK-2790 — the "the map changed" signal the introduction reset hangs off.
import { SET_RESOURCE_ID } from '@js/actions/gnresource';

describe('SimpleView Plugin', () => {
    describe('Action Creators', () => {
        it('setOpenMenuGroupId creates correct action', () => {
            const action = setOpenMenuGroupId('group1');
            expect(action.type).toBe(SET_OPEN_MENU_GROUP_ID);
            expect(action.openMenuGroupId).toBe('group1');
        });

        it('setVisibleLegendPanel creates correct action', () => {
            const action = setVisibleLegendPanel(true);
            expect(action.type).toBe(SET_VISIBLE_LEGEND_PANEL);
            expect(action.visible).toBe(true);
        });

        it('setVisibleIntroduction creates correct action', () => {
            const action = setVisibleIntroduction(true);
            expect(action.type).toBe(SET_VISIBLE_INTRODUCTION);
            expect(action.visible).toBe(true);
        });

        it('setVisibleUploaderPanel creates correct action', () => {
            const action = setVisibleUploaderPanel(true, 'configKey', 123);
            expect(action.type).toBe(SET_VISIBLE_UPLOADER_PANEL);
            expect(action.visible).toBe(true);
            expect(action.importerConfigKey).toBe('configKey');
            expect(action.importerTargetObjectId).toBe(123);
        });

        it('setVisibleSimpleViewAttributeForm creates correct action', () => {
            const action = setVisibleSimpleViewAttributeForm(true);
            expect(action.type).toBe(SET_VISIBLE_SV_ATTRIBUTE_FORM);
            expect(action.visible).toBe(true);
        });

        it('setVisibleSimpleViewAttributeResult creates correct action', () => {
            const action = setVisibleSimpleViewAttributeResult(true);
            expect(action.type).toBe(SET_VISIBLE_SV_ATTRIBUTE_RESULT);
            expect(action.visible).toBe(true);
        });

        it('setSimpleViewAttributeResult creates correct action', () => {
            const data = { result: 'success' };
            const action = setSimpleViewAttributeResult(data);
            expect(action.type).toBe(SET_SV_ATTRIBUTE_RESULT);
            expect(action.data).toEqual(data);
        });

        it('updateUploadStatus creates correct action', () => {
            const action = updateUploadStatus('uploading');
            expect(action.type).toBe(UPDATE_UPLOAD_STATUS);
            expect(action.status).toBe('uploading');
        });

        it('svSelectLayer creates correct action', () => {
            const layer = { id: 1, name: 'Test Layer' };
            const action = svSelectLayer(layer);
            expect(action.type).toBe(SV_SELECT_LAYER);
            expect(action.layer).toEqual(layer);
        });

        it('setSvConfig creates correct action', () => {
            const config = { theme: 'dark' };
            const action = setSvConfig(config);
            expect(action.type).toBe(SET_SV_CONFIG);
            expect(action.config).toEqual(config);
        });

        it('createSimpleViewAttributeForm creates correct action', () => {
            const data = {
                form: { field1: { value: '' } },
                importer_session_id: 'session123',
                submitUrl: '/api/submit'
            };
            const action = createSimpleViewAttributeForm(data);
            expect(action.type).toBe(CREATE_SV_ATTRIBUTE_FORM);
            expect(action.form).toEqual(data.form);
            expect(action.simpleViewImporterSessionId).toBe('session123');
            expect(action.submitUrl).toBe('/api/submit');
        });

        it('setProcessingSimpleViewAttributeForm creates correct action', () => {
            const action = setProcessingSimpleViewAttributeForm(true);
            expect(action.type).toBe(SET_PROCESSING_SV_ATTRIBUTE_FORM);
            expect(action.processing).toBe(true);
        });
    });

    describe('Reducer', () => {
        const initialState = {selectedCategory: null};

        it('should return initial state', () => {
            const state = reducer(undefined, { type: 'UNKNOWN' });
            expect(state).toEqual(initialState);
        });

        // TASK-1005 W1 — R05 / R12 guard. The Miller-columns rail+pane keeps the
        // selected subheading in local component state, but the reducer carries a
        // dead `selectedCategory: null` slot so hydration is deterministic and so
        // future selectors never read `undefined`. Critically, `openMenuGroupId`
        // must still default to `undefined` here so epicsSwamm:245 doesn't read
        // a stale id and fire ensureBmpGeometriesGroupEpic spuriously.
        it('initial state has selectedCategory=null and openMenuGroupId=undefined (R05 guard)', () => {
            const state = reducer(undefined, { type: 'UNKNOWN' });
            expect(state.selectedCategory).toBe(null);
            expect(state.openMenuGroupId).toBe(undefined);
        });

        it('should handle SET_PROCESSING_SV_ATTRIBUTE_FORM', () => {
            const state = reducer(initialState, {
                type: SET_PROCESSING_SV_ATTRIBUTE_FORM,
                processing: true
            });
            expect(state.processingSimpleViewAttributeForm).toBe(true);
        });

        it('should handle SET_SV_CONFIG', () => {
            const config = { theme: 'dark', mode: 'simple' };
            const state = reducer(initialState, {
                type: SET_SV_CONFIG,
                config: config
            });
            expect(state.config).toEqual(config);
        });

        it('should handle SET_OPEN_MENU_GROUP_ID - set new group', () => {
            const state = reducer(initialState, {
                type: SET_OPEN_MENU_GROUP_ID,
                openMenuGroupId: 'group1'
            });
            expect(state.openMenuGroupId).toBe('group1');
        });

        it('should handle SET_OPEN_MENU_GROUP_ID - toggle off same group', () => {
            const stateWithGroup = { ...initialState, openMenuGroupId: 'group1' };
            const state = reducer(stateWithGroup, {
                type: SET_OPEN_MENU_GROUP_ID,
                openMenuGroupId: 'group1'
            });
            expect(state.openMenuGroupId).toBe(null);
        });

        it('should handle SET_OPEN_MENU_GROUP_ID - switch groups', () => {
            const stateWithGroup = { ...initialState, openMenuGroupId: 'group1' };
            const state = reducer(stateWithGroup, {
                type: SET_OPEN_MENU_GROUP_ID,
                openMenuGroupId: 'group2'
            });
            expect(state.openMenuGroupId).toBe('group2');
        });

        // TASK-1008 W4 — R05 belt-and-braces. The Miller-columns rail+pane
        // refactor adds local `selectedSubHeading` state to MenuRowsClass but
        // MUST NOT alter the toggle semantics of `openMenuGroupId`, which
        // epicsSwamm.js:245 reads as `state.simpleView.openMenuGroupId !==
        // viewBmpGroup.id` to gate ensureBmpGeometriesGroupEpic. Round-trip
        // here pins the four-step set/toggle/set/toggle sequence so future
        // reducer rewrites can't silently swap toggle-off for no-op.
        it('SET_OPEN_MENU_GROUP_ID round-trip preserves toggle semantics (R05 Swamm gate)', () => {
            let s = reducer(initialState, { type: SET_OPEN_MENU_GROUP_ID, openMenuGroupId: 'g1' });
            expect(s.openMenuGroupId).toBe('g1');
            s = reducer(s, { type: SET_OPEN_MENU_GROUP_ID, openMenuGroupId: 'g1' });
            expect(s.openMenuGroupId).toBe(null);
            s = reducer(s, { type: SET_OPEN_MENU_GROUP_ID, openMenuGroupId: 'g2' });
            expect(s.openMenuGroupId).toBe('g2');
            s = reducer(s, { type: SET_OPEN_MENU_GROUP_ID, openMenuGroupId: 'g2' });
            expect(s.openMenuGroupId).toBe(null);
        });

        it('should handle SET_VISIBLE_LEGEND_PANEL', () => {
            const state = reducer(initialState, {
                type: SET_VISIBLE_LEGEND_PANEL,
                visible: true
            });
            expect(state.visibleLegendPanel).toBe(true);
        });

        it('should handle SET_VISIBLE_INTRODUCTION', () => {
            const state = reducer(initialState, {
                type: SET_VISIBLE_INTRODUCTION,
                visible: true
            });
            expect(state.visibleIntroduction).toBe(true);
        });

        // ── Epic 2765 W4 (TASK-2778) — the owner/manager save path ──
        //
        // The whole reason SAVE/SAVED/SAVE_FAILED exist instead of reusing
        // INTRODUCTION_LOADED is what these three assertions pin.
        describe('introduction save (TASK-2778)', () => {
            const loaded = reducer({}, {
                type: INTRODUCTION_LOADED,
                projectId: 13422,
                data: { content_version: 'old', description_html: '<p>Old.</p>' },
                acceptedVersion: 'old'
            });

            it('SAVE_INTRODUCTION marks the slice saving without touching data', () => {
                const state = reducer(loaded, { type: SAVE_INTRODUCTION, projectId: 13422 });
                expect(state.introduction.savingIntroduction).toBe(true);
                expect(state.introduction.introductionSaveFailed).toBe(false);
                expect(state.introduction.data.content_version).toBe('old');
            });

            it('INTRODUCTION_SAVED swaps the content and KEEPS acceptedVersion', () => {
                // ⚠ The INTRODUCTION_LOADED case rewrites `acceptedVersion`
                // from the action. Reusing it here would erase this browser's
                // anonymous acceptance stamp every time an owner fixed a typo.
                // The stamp is kept and simply stops matching once the content
                // really changed — and an unchanged save hashes the same, so it
                // re-prompts nobody.
                const state = reducer(loaded, {
                    type: INTRODUCTION_SAVED,
                    projectId: 13422,
                    data: { content_version: 'new', description_html: '<p>New.</p>' }
                });
                expect(state.introduction.data.content_version).toBe('new');
                expect(state.introduction.acceptedVersion).toBe('old');
                expect(state.introduction.savingIntroduction).toBe(false);
            });

            it('refuses a save that resolves for a DIFFERENT project', () => {
                // An SPA hop between maps must not paint one project's
                // introduction over another's.
                const state = reducer(loaded, {
                    type: INTRODUCTION_SAVED,
                    projectId: 99999,
                    data: { content_version: 'new' }
                });
                expect(state.introduction.data.content_version).toBe('old');
            });

            it('INTRODUCTION_SAVE_FAILED clears saving and leaves data alone', () => {
                const saving = reducer(loaded, { type: SAVE_INTRODUCTION, projectId: 13422 });
                const state = reducer(saving, {
                    type: INTRODUCTION_SAVE_FAILED, projectId: 13422
                });
                expect(state.introduction.savingIntroduction).toBe(false);
                expect(state.introduction.introductionSaveFailed).toBe(true);
                expect(state.introduction.data.content_version).toBe('old');
            });
        });

        // ── TASK-2790 (epic 2765 W5) — THE INTRODUCTION FOLLOWS THE MAP ──
        //
        // The slice is a liability disclaimer carrying a PROJECT NAME. Nothing
        // cleared it, so on a same-document hop from map A to map B it held A's
        // payload for the whole of B's from-map + introduction round-trip, and
        // TASK-2775's toolbar button opens the modal with no guard at all.
        //
        // Fixed in the REDUCER, following projectsReducer's SET_RESOURCE_ID
        // pattern, rather than with a freshness check on the button: a guard on
        // the consumer is the thing the NEXT consumer forgets, and this slice
        // already has three readers.
        describe('introduction map-switch reset (TASK-2790)', () => {
            // Built from `undefined`, so the reducer's own initial state
            // applies and the "everything else is untouched" assertion below
            // has real neighbouring keys to be about.
            const ON_MAP_118 = reducer(
                reducer(undefined, { type: SET_RESOURCE_ID, id: '118' }),
                {
                    type: INTRODUCTION_LOADED,
                    projectId: 13422,
                    data: { project_name: 'Project A', content_version: 'va' },
                    acceptedVersion: 'va',
                    mapId: '118'
                }
            );

            it('POSITIVE CONTROL — the sequence really does populate the slice', () => {
                // Every assertion below is an ABSENCE, and an absence is only
                // evidence once the same sequence has been shown to produce a
                // present, correct payload. Deliberately says nothing about the
                // map stamp: this must hold with or without the reset, or it
                // is not a control.
                expect(ON_MAP_118.introduction.data.project_name).toBe('Project A');
                expect(ON_MAP_118.introduction.projectId).toBe(13422);
                expect(ON_MAP_118.introduction.acceptedVersion).toBe('va');
            });

            it('stamps which map the slice is about', () => {
                expect(ON_MAP_118.introductionMapId).toBe('118');
            });

            it('AC1 — a map change leaves nothing describing the previous project', () => {
                const onMapB = reducer(ON_MAP_118, { type: SET_RESOURCE_ID, id: '200' });
                expect(onMapB.introduction).toBe(undefined);
                expect(onMapB.introductionMapId).toBe('200');
                // The WHOLE key goes, not just `data`: a surviving projectId
                // would let a late INTRODUCTION_ACCEPTED / INTRODUCTION_SAVED
                // for A write into the slice while B is on screen, which is
                // exactly what those guards exist to refuse.
                expect(JSON.stringify(onMapB)).toNotContain('Project A');
                expect(JSON.stringify(onMapB)).toNotContain('13422');
            });

            it('does NOT clear the render flag — only the content', () => {
                const visible = reducer(ON_MAP_118, {
                    type: SET_VISIBLE_INTRODUCTION, visible: true
                });
                const onMapB = reducer(visible, { type: SET_RESOURCE_ID, id: '200' });
                // The flag is not content. The modal is payload-gated
                // (TASK-2796), so a latched flag over a cleared slice renders
                // nothing and then opens correctly once B's payload lands.
                expect(onMapB.visibleIntroduction).toBe(true);
                expect(onMapB.introduction).toBe(undefined);
            });

            it('a REPEAT SET_RESOURCE_ID for the same map is a no-op', () => {
                // MAP_CONFIG_LOADED re-fires on reconfig. Returning a fresh
                // object here would clear a payload under the map it belongs to
                // and re-render every consumer for nothing.
                const again = reducer(ON_MAP_118, { type: SET_RESOURCE_ID, id: '118' });
                expect(again).toBe(ON_MAP_118);
            });

            it('treats a numeric pk and its string form as the SAME map', () => {
                // `gnresource.id` is a STRING on the SPA route path (measured
                // live: "1418"); other setResourceId callers pass a numeric pk.
                // A type-only difference must never read as "different map".
                const again = reducer(ON_MAP_118, { type: SET_RESOURCE_ID, id: 118 });
                expect(again).toBe(ON_MAP_118);
            });

            it('fails CLOSED on an unknown map id', () => {
                const cleared = reducer(ON_MAP_118, { type: SET_RESOURCE_ID, id: null });
                expect(cleared.introduction).toBe(undefined);
                expect(cleared.introductionMapId).toBe(null);
            });

            it('refuses a payload that lands AFTER the hop, stamped for the old map', () => {
                // The other half of the same bug. introductionFetchEpic is a
                // mergeMap by design, so an in-flight request for A is not
                // cancelled by the hop to B; a slow reply would otherwise write
                // A's disclaimer straight back in under B.
                const onMapB = reducer(ON_MAP_118, { type: SET_RESOURCE_ID, id: '200' });
                const late = reducer(onMapB, {
                    type: INTRODUCTION_LOADED,
                    projectId: 13422,
                    data: { project_name: 'Project A', content_version: 'va' },
                    mapId: '118'
                });
                expect(late.introduction).toBe(undefined);
            });

            it('accepts the payload for the map actually on screen', () => {
                const onMapB = reducer(ON_MAP_118, { type: SET_RESOURCE_ID, id: '200' });
                const loadedB = reducer(onMapB, {
                    type: INTRODUCTION_LOADED,
                    projectId: 555,
                    data: { project_name: 'Project B', content_version: 'vb' },
                    mapId: '200'
                });
                expect(loadedB.introduction.data.project_name).toBe('Project B');
                expect(loadedB.introduction.projectId).toBe(555);
            });

            it('lets an UNSTAMPED payload read through — fail-safe, not fail-closed', () => {
                // Same rule, and the same words, as SET_ANUGA_PROJECT_DATA in
                // Anuga/reducers/projectsReducer.js: only a stamp that
                // POSITIVELY disagrees is refused, so a caller (or a unit test)
                // that has not been taught to stamp still works.
                const onMapB = reducer(ON_MAP_118, { type: SET_RESOURCE_ID, id: '200' });
                const unstamped = reducer(onMapB, {
                    type: INTRODUCTION_LOADED,
                    projectId: 555,
                    data: { project_name: 'Project B' }
                });
                expect(unstamped.introduction.data.project_name).toBe('Project B');
            });

            it('leaves every other SimpleView key alone', () => {
                // The reset is scoped to the introduction. Clearing the open
                // menu or the legend on a map switch would be a different,
                // unasked-for behaviour change.
                const busy = reducer(
                    reducer(ON_MAP_118, { type: SET_VISIBLE_LEGEND_PANEL, visible: true }),
                    { type: SET_OPEN_MENU_GROUP_ID, openMenuGroupId: 'Results' }
                );
                const onMapB = reducer(busy, { type: SET_RESOURCE_ID, id: '200' });
                expect(onMapB.visibleLegendPanel).toBe(true);
                expect(onMapB.openMenuGroupId).toBe('Results');
                expect(onMapB.selectedCategory).toBe(null);
            });
        });

        it('should handle SET_VISIBLE_SV_ATTRIBUTE_FORM', () => {
            const state = reducer(initialState, {
                type: SET_VISIBLE_SV_ATTRIBUTE_FORM,
                visible: true
            });
            expect(state.visibleSimpleViewAttributeForm).toBe(true);
        });

        it('should handle SET_VISIBLE_SV_ATTRIBUTE_RESULT', () => {
            const state = reducer(initialState, {
                type: SET_VISIBLE_SV_ATTRIBUTE_RESULT,
                visible: true
            });
            expect(state.visibleSimpleViewAttributeResult).toBe(true);
        });

        it('should handle SET_SV_ATTRIBUTE_RESULT', () => {
            const data = { result: 'success', value: 42 };
            const state = reducer(initialState, {
                type: SET_SV_ATTRIBUTE_RESULT,
                data: data
            });
            expect(state.simpleViewAttributeResult).toEqual(data);
        });

        it('should handle CREATE_SV_ATTRIBUTE_FORM', () => {
            const form = { field1: { value: 'test' } };
            const state = reducer(initialState, {
                type: CREATE_SV_ATTRIBUTE_FORM,
                form: form,
                simpleViewImporterSessionId: 'session123',
                submitUrl: '/api/submit'
            });
            expect(state.simpleViewAttributeForm).toEqual(form);
            expect(state.simpleViewImporterSessionId).toBe('session123');
            expect(state.submitUrl).toBe('/api/submit');
            expect(state.visibleSimpleViewAttributeForm).toBe(true);
        });

        it('should handle SUBMIT_SV_ATTRIBUTE_FORM_SUCCESS', () => {
            const state = reducer(initialState, {
                type: SUBMIT_SV_ATTRIBUTE_FORM_SUCCESS,
                data: { importer_session_id: 'newSession' }
            });
            expect(state.simpleViewImporterSessionId).toBe('newSession');
        });

        it('should handle SET_VISIBLE_UPLOADER_PANEL', () => {
            const state = reducer(initialState, {
                type: SET_VISIBLE_UPLOADER_PANEL,
                visible: true,
                importerConfigKey: 'configKey',
                importerTargetObjectId: 123
            });
            expect(state.visibleUploaderPanel).toBe(true);
            expect(state.importerConfigKey).toBe('configKey');
            expect(state.importerTargetObjectId).toBe(123);
        });

        it('should handle UPDATE_UPLOAD_STATUS', () => {
            const state = reducer(initialState, {
                type: UPDATE_UPLOAD_STATUS,
                status: 'complete'
            });
            expect(state.uploadStatus).toBe('complete');
        });

        it('should handle SV_SELECT_LAYER', () => {
            const layer = { id: 1, name: 'Test Layer' };
            const state = reducer(initialState, {
                type: SV_SELECT_LAYER,
                layer: layer
            });
            expect(state.selectedLayer).toEqual(layer);
        });
    });

    // TASK-1441 — verify ResourceDetails control key
    describe('ResourceDetails padlock control key (TASK-1441)', () => {
        it('getShowDetails reads state.resources.showDetails (not state.controls.*)', () => {
            // The SimpleView padlock button must use setShowDetails/getShowDetails from
            // ResourcesCatalog — NOT setControlProperty('resourceDetails',...).
            // ResourceDetails.jsx reads show: getShowDetails(state), which resolves to
            // state.resources.showDetails, entirely independent of state.controls.
            expect(getShowDetails({ resources: { showDetails: true } })).toBe(true);
            expect(getShowDetails({ resources: { showDetails: false } })).toBe(false);
            // Confirm controls.resourceDetails.enabled has no effect on panel visibility.
            expect(getShowDetails({ controls: { resourceDetails: { enabled: true } } })).toBe(false);
        });
    });
});
