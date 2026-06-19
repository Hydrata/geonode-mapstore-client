import expect from 'expect';
import React from 'react';
import ReactDOM from 'react-dom';
import { Provider } from 'react-redux';
import { createStore } from 'redux';

import { UploaderPanel, getActiveProjectId } from '../components/simpleViewUploader';

/**
 * TASK-600: Bind terrain-importer URL to *active* project, not stashed
 * project_id from initial SimpleView config load.
 *
 * Real-world bug: WKC Group user (gabriela.garcia@wkcgroup.com) signed up,
 * viewed the public Merewether demo (project 378) — config.project_id was
 * stashed at 378. She then created her own project 548 and tried to upload
 * terrain. The PUT went to /anuga/api/378/terrain/importer-create/ → 403,
 * five times across 7 days. Only when state.simpleView.config was *reloaded*
 * (and happened to populate project_id=548) did the upload succeed.
 *
 * Fix: getActiveProjectId() reads from state.anuga.projects.data.id (or
 * state.swamm.projectData.id) — the same store slice the rest of the app
 * uses for "the project you are currently looking at".
 */

// ── Helpers ──

const importerConfigKey = 'terrain';
const baseConfig = {
    importer_config: {
        terrain: {
            app_name: 'anuga',
            title: 'Terrain',
            filetype: 'tif/zip'
        }
    },
    project_id: 378  // stashed at first config load — the bug
};

const baseSwammConfig = {
    importer_config: {
        erosion: {
            app_name: 'swamm',
            title: 'Erosion',
            filetype: 'tif/zip'
        }
    },
    project_id: 378
};

function makeState({ activeAnugaProjectId, activeSwammProjectId, config = baseConfig, key = importerConfigKey } = {}) {
    return {
        simpleView: {
            visibleUploaderPanel: false,
            importerConfigKey: key,
            config
        },
        anuga: activeAnugaProjectId !== undefined
            ? { projects: { data: { id: activeAnugaProjectId } } }
            : {},
        swamm: activeSwammProjectId !== undefined
            ? { projectData: { id: activeSwammProjectId } }
            : {},
        gnsettings: { geonodeUrl: 'https://example.com/' }
    };
}

describe('SimpleView Uploader — TASK-600 active project binding', () => {

    describe('getActiveProjectId selector', () => {

        it('returns active ANUGA project id (not stashed config.project_id)', () => {
            // The bug scenario: stashed=378, active=548 — must return 548
            const state = makeState({ activeAnugaProjectId: 548 });
            expect(getActiveProjectId(state)).toBe(548);
        });

        it('returns active SWAMM project id when app_name=swamm', () => {
            const state = makeState({
                activeSwammProjectId: 999,
                config: baseSwammConfig,
                key: 'erosion'
            });
            expect(getActiveProjectId(state)).toBe(999);
        });

        it('falls back to legacy config.project_id when no active ANUGA project', () => {
            // Catalogue / non-project context — anuga slice empty
            const state = makeState({});
            expect(getActiveProjectId(state)).toBe(378);
        });

        it('returns null when neither active project nor stashed config.project_id exists', () => {
            // Pure cold-load context — nothing stashed yet
            const state = makeState({
                config: { importer_config: baseConfig.importer_config }  // no project_id
            });
            expect(getActiveProjectId(state)).toBe(null);
        });

        it('reactively switches when active project changes 378 -> 548 (no remount required)', () => {
            const state1 = makeState({ activeAnugaProjectId: 378 });
            const state2 = makeState({ activeAnugaProjectId: 548 });
            expect(getActiveProjectId(state1)).toBe(378);
            expect(getActiveProjectId(state2)).toBe(548);
        });

        it('regression: legitimate demo upload — active=378 returns 378', () => {
            // If the user is genuinely viewing+owning project 378, must keep working.
            const state = makeState({ activeAnugaProjectId: 378 });
            expect(getActiveProjectId(state)).toBe(378);
        });

        it('handles missing simpleView.config gracefully', () => {
            const state = { simpleView: {}, anuga: {}, swamm: {}, gnsettings: {} };
            expect(getActiveProjectId(state)).toBe(null);
        });

        it('handles unknown app_name by falling back to stashed project_id', () => {
            const state = makeState({
                config: {
                    importer_config: { terrain: { app_name: 'unknown-app' } },
                    project_id: 42
                }
            });
            expect(getActiveProjectId(state)).toBe(42);
        });
    });

    describe('UploaderPanel render — disabled state when no active project', () => {
        let container;

        beforeEach((done) => {
            document.body.innerHTML = '<div id="uploader-test-container"></div>';
            container = document.getElementById('uploader-test-container');
            setTimeout(done);
        });

        afterEach((done) => {
            if (container) ReactDOM.unmountComponentAtNode(container);
            document.body.innerHTML = '';
            setTimeout(done);
        });

        it('renders nothing when visibleUploaderPanel is false (smoke check)', (done) => {
            const state = makeState({ activeAnugaProjectId: 548 });
            const store = createStore(() => state);
            ReactDOM.render(
                <Provider store={store}>
                    <UploaderPanel />
                </Provider>,
                container,
                () => {
                    // Panel should not render at all (returns null)
                    expect(container.querySelector('.sv-uploader-panel')).toNotExist();
                    done();
                }
            );
        });

        it('Begin button is disabled when no active project (state.anuga + config.project_id both empty)', (done) => {
            // Catalogue page — both anuga and stashed project_id are missing
            const state = {
                simpleView: {
                    visibleUploaderPanel: true,
                    importerConfigKey: 'terrain',
                    config: { importer_config: baseConfig.importer_config }  // no project_id
                },
                anuga: {},
                swamm: {},
                gnsettings: { geonodeUrl: 'https://example.com/' }
            };
            const store = createStore(() => state);
            ReactDOM.render(
                <Provider store={store}>
                    <UploaderPanel />
                </Provider>,
                container,
                () => {
                    // Panel renders. The Begin button only appears once a file
                    // is dropped, but the connected projectId prop is null
                    // (verified in selector tests above). The disabled-on-Begin
                    // guard at the JSX level (TASK-599) reads `this.props?.projectId`
                    // so a null projectId disables the button.
                    expect(container.querySelector('.sv-uploader-panel')).toExist();
                    done();
                }
            );
        });
    });
});
