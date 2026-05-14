import expect from 'expect';

const anugaApi = require('../api/anugaApi');

describe('anugaApi', () => {

    // -- Module exports ---------------------------------------------------

    describe('module exports', () => {
        // V2P-79 cutover: getAvailableLayers dropped per spec
        // ("Remove /available/ polling, replaced by MapLayer system").
        // Surface count: 31 (was 32).
        const expectedFunctions = [
            // CRUD helpers (now route through V2 internally)
            'getProjectFromMapId', 'getProjects',
            'createResource', 'getResourceList', 'updateResourceTitle',
            'createScenario', 'updateScenario', 'deleteScenario',
            'compareScenarios',
            'runNetwork',
            'getComputeInstances',
            'createFigure',
            'searchDataset',
            // generic PATCH
            'updateResource',
            // v2-named helpers (kept for explicit V2 callers)
            'getProjectV2', 'getProjectsV2',
            'createScenarioV2', 'deleteScenarioV2',
            // POST /api/v2/anuga/.../scenarios/{id}/duplicate/
            'duplicateScenario',
            // POST archive/unarchive + GET archive-filtered list
            'archiveScenario', 'unarchiveScenario', 'getScenariosByArchive',
            'startRun', 'cancelRun', 'retryRun', 'getRunStatus', 'getRun',
            // Membership + visibility
            'getMemberships', 'addMembership', 'updateMembership', 'deleteMembership',
            'searchUsers', 'updateProjectVisibility',
            // V2P-21 — batch perm fetch
            'getMyPerms',
            // V2P-714 — cascade-delete dataset rows
            'deleteTerrainV2', 'deleteBoundaryV2', 'deleteFrictionV2', 'deleteInflowV2',
            // TASK-723 — cascade-delete fan-out (structure/mesh_region/catchment/nodes/links)
            'deleteStructureV2', 'deleteMeshRegionV2', 'deleteCatchmentV2',
            'deleteNodesV2', 'deleteLinksV2',
            // TASK-829 (W4.2b) — FrictionRaster cascade-delete (raster sibling to Terrain)
            'deleteFrictionRasterV2'
        ];

        expectedFunctions.forEach(name => {
            it(`should export ${name} as a function`, () => {
                expect(typeof anugaApi[name]).toBe('function');
            });
        });

        it('should export exactly 44 API functions', () => {
            const exportedFunctions = Object.keys(anugaApi).filter(
                k => typeof anugaApi[k] === 'function' && k !== '__esModule'
            );
            expect(exportedFunctions.length).toBe(44);
        });

        it('V2P-79: getAvailableLayers is no longer exported', () => {
            expect(typeof anugaApi.getAvailableLayers).toBe('undefined');
        });
    });

    // -- Function signatures (argument count) -----------------------------

    describe('function signatures', () => {
        it('getProjectFromMapId takes 1 argument (mapId)', () => {
            expect(anugaApi.getProjectFromMapId.length).toBe(1);
        });

        it('getProjects takes 0 required arguments (pageSize, page have defaults)', () => {
            expect(anugaApi.getProjects.length).toBe(0);
        });

        it('createResource takes 3 arguments (projectId, type, data)', () => {
            expect(anugaApi.createResource.length).toBe(3);
        });

        it('getResourceList takes 2 arguments (projectId, type)', () => {
            expect(anugaApi.getResourceList.length).toBe(2);
        });

        it('updateResourceTitle takes 4 arguments (projectId, type, resourceId, title)', () => {
            expect(anugaApi.updateResourceTitle.length).toBe(4);
        });

        it('createScenario takes 2 arguments (projectId, scenario)', () => {
            expect(anugaApi.createScenario.length).toBe(2);
        });

        it('updateScenario takes 3 arguments (projectId, scenarioId, scenario)', () => {
            expect(anugaApi.updateScenario.length).toBe(3);
        });

        it('deleteScenario takes 2 arguments (projectId, scenarioId)', () => {
            expect(anugaApi.deleteScenario.length).toBe(2);
        });

        it('compareScenarios takes 2 arguments (projectId, scenarios)', () => {
            expect(anugaApi.compareScenarios.length).toBe(2);
        });

        it('runNetwork takes 3 arguments (projectId, networkId, data)', () => {
            expect(anugaApi.runNetwork.length).toBe(3);
        });

        it('getComputeInstances takes 1 argument (projectId)', () => {
            expect(anugaApi.getComputeInstances.length).toBe(1);
        });

        it('createFigure takes 3 arguments (projectId, publicationId, title)', () => {
            expect(anugaApi.createFigure.length).toBe(3);
        });

        it('searchDataset takes 1 argument (datasetName)', () => {
            expect(anugaApi.searchDataset.length).toBe(1);
        });

        // v1 generic PATCH
        it('updateResource takes 4 arguments (projectId, type, resourceId, data)', () => {
            expect(anugaApi.updateResource.length).toBe(4);
        });

        // v2 function signatures
        it('getProjectV2 takes 1 argument (projectId)', () => {
            expect(anugaApi.getProjectV2.length).toBe(1);
        });

        it('getProjectsV2 takes 0 required arguments (defaults)', () => {
            expect(anugaApi.getProjectsV2.length).toBe(0);
        });

        it('createScenarioV2 takes 2 arguments (projectId, scenario)', () => {
            expect(anugaApi.createScenarioV2.length).toBe(2);
        });

        it('deleteScenarioV2 takes 2 arguments (projectId, scenarioId)', () => {
            expect(anugaApi.deleteScenarioV2.length).toBe(2);
        });

        it('duplicateScenario takes 2 arguments (projectId, scenarioId)', () => {
            expect(anugaApi.duplicateScenario.length).toBe(2);
        });

        it('archiveScenario takes 2 arguments (projectId, scenarioId)', () => {
            expect(anugaApi.archiveScenario.length).toBe(2);
        });
        it('unarchiveScenario takes 2 arguments (projectId, scenarioId)', () => {
            expect(anugaApi.unarchiveScenario.length).toBe(2);
        });
        it('getScenariosByArchive takes 1 required argument (projectId, mode has default)', () => {
            expect(anugaApi.getScenariosByArchive.length).toBe(1);
        });

        it('startRun takes 1 required argument (scenarioId)', () => {
            expect(anugaApi.startRun.length).toBe(1);
        });

        it('cancelRun takes 1 argument (runId)', () => {
            expect(anugaApi.cancelRun.length).toBe(1);
        });

        it('retryRun takes 1 argument (runId)', () => {
            expect(anugaApi.retryRun.length).toBe(1);
        });

        it('getRunStatus takes 1 argument (runId)', () => {
            expect(anugaApi.getRunStatus.length).toBe(1);
        });

        it('getRun takes 1 argument (runId)', () => {
            expect(anugaApi.getRun.length).toBe(1);
        });

        // Membership function signatures
        it('getMemberships takes 1 argument (projectId)', () => {
            expect(anugaApi.getMemberships.length).toBe(1);
        });

        it('addMembership takes 3 arguments (projectId, userId, role)', () => {
            expect(anugaApi.addMembership.length).toBe(3);
        });

        it('updateMembership takes 3 arguments (projectId, membershipId, role)', () => {
            expect(anugaApi.updateMembership.length).toBe(3);
        });

        it('deleteMembership takes 2 arguments (projectId, membershipId)', () => {
            expect(anugaApi.deleteMembership.length).toBe(2);
        });

        it('searchUsers takes 1 argument (query)', () => {
            expect(anugaApi.searchUsers.length).toBe(1);
        });

        it('getMyPerms takes 1 argument (projectId)', () => {
            expect(anugaApi.getMyPerms.length).toBe(1);
        });

        it('updateProjectVisibility takes 2 arguments (projectId, visibility)', () => {
            expect(anugaApi.updateProjectVisibility.length).toBe(2);
        });

        // V2P-714 — cascade-delete signatures
        it('deleteTerrainV2 takes 2 arguments (projectId, terrainId)', () => {
            expect(anugaApi.deleteTerrainV2.length).toBe(2);
        });
        it('deleteBoundaryV2 takes 2 arguments (projectId, boundaryId)', () => {
            expect(anugaApi.deleteBoundaryV2.length).toBe(2);
        });
        it('deleteFrictionV2 takes 2 arguments (projectId, frictionId)', () => {
            expect(anugaApi.deleteFrictionV2.length).toBe(2);
        });
        it('deleteInflowV2 takes 2 arguments (projectId, inflowId)', () => {
            expect(anugaApi.deleteInflowV2.length).toBe(2);
        });
        // TASK-723 — cascade-delete fan-out signatures
        it('deleteStructureV2 takes 2 arguments (projectId, structureId)', () => {
            expect(anugaApi.deleteStructureV2.length).toBe(2);
        });
        it('deleteMeshRegionV2 takes 2 arguments (projectId, meshRegionId)', () => {
            expect(anugaApi.deleteMeshRegionV2.length).toBe(2);
        });
        it('deleteCatchmentV2 takes 2 arguments (projectId, catchmentId)', () => {
            expect(anugaApi.deleteCatchmentV2.length).toBe(2);
        });
        it('deleteNodesV2 takes 2 arguments (projectId, nodesId)', () => {
            expect(anugaApi.deleteNodesV2.length).toBe(2);
        });
        it('deleteLinksV2 takes 2 arguments (projectId, linksId)', () => {
            expect(anugaApi.deleteLinksV2.length).toBe(2);
        });
        // TASK-829 (W4.2b) — FrictionRaster cascade-delete (raster sibling to Terrain)
        it('deleteFrictionRasterV2 takes 2 arguments (projectId, frictionRasterId)', () => {
            expect(anugaApi.deleteFrictionRasterV2.length).toBe(2);
        });
    });

    // -- Grouping sanity checks -------------------------------------------

    describe('API surface coverage', () => {
        it('has project-related functions (v1 + v2)', () => {
            expect(anugaApi.getProjectFromMapId).toExist();
            expect(anugaApi.getProjects).toExist();
            expect(anugaApi.getProjectV2).toExist();
            expect(anugaApi.getProjectsV2).toExist();
        });

        it('has generic resource functions', () => {
            // V2P-79: getAvailableLayers dropped per spec.
            expect(anugaApi.createResource).toExist();
            expect(anugaApi.getResourceList).toExist();
            expect(anugaApi.updateResourceTitle).toExist();
            expect(anugaApi.updateResource).toExist();
        });

        it('has scenario CRUD functions (v1 + v2)', () => {
            expect(anugaApi.createScenario).toExist();
            expect(anugaApi.updateScenario).toExist();
            expect(anugaApi.deleteScenario).toExist();
            expect(anugaApi.compareScenarios).toExist();
            expect(anugaApi.createScenarioV2).toExist();
            expect(anugaApi.deleteScenarioV2).toExist();
        });

        it('has v2 run lifecycle functions', () => {
            expect(anugaApi.startRun).toExist();
            expect(anugaApi.cancelRun).toExist();
            expect(anugaApi.retryRun).toExist();
            expect(anugaApi.getRunStatus).toExist();
            expect(anugaApi.getRun).toExist();
        });

        it('has compute and publication functions', () => {
            expect(anugaApi.getComputeInstances).toExist();
            expect(anugaApi.createFigure).toExist();
        });

        it('has membership CRUD functions', () => {
            expect(anugaApi.getMemberships).toExist();
            expect(anugaApi.addMembership).toExist();
            expect(anugaApi.updateMembership).toExist();
            expect(anugaApi.deleteMembership).toExist();
            expect(anugaApi.searchUsers).toExist();
            expect(anugaApi.updateProjectVisibility).toExist();
        });

        it('has V2P-21 batch perm fetch function', () => {
            expect(anugaApi.getMyPerms).toExist();
        });
    });

    // -- V2P-79 V1 → V2 cutover regression guards -----------------------
    //
    // These tests assert the cutover invariant: anugaApi.js MUST NOT issue
    // axios calls against /anuga/api/ (the V1 path), with one documented
    // exception for `createResource` of boundary/friction/inflow — V2 did
    // not ship POST endpoints for those three sub-resources (see
    // V1_CREATE_ONLY_TYPES rationale in api/anugaApi.js).
    //
    // Approach: mock axios via axios-mock-adapter (already a test dep, used
    // by V2P-21 fetchMyPermsEpic tests) and call each helper. We verify
    // each helper hits the expected URL — this catches any regression that
    // would re-introduce a V1 path.
    describe('V2P-79 V1->V2 cutover regression guards', () => {
        const MockAdapter = require('axios-mock-adapter');
        const axios = require('../../../../../MapStore2/web/client/libs/ajax').default;
        let mockAxios;

        beforeEach(() => {
            mockAxios = new MockAdapter(axios);
            // Reply 200 with empty body to every URL — we only care about
            // recording the request URL.
            mockAxios.onAny().reply(200, {});
        });

        afterEach(() => {
            mockAxios.restore();
        });

        // Helper: pull the recorded URL for the most recent matching method.
        const lastUrl = (verb) => {
            const log = mockAxios.history[verb];
            return log.length ? log[log.length - 1].url : null;
        };

        it('getProjectFromMapId hits V2 /api/v2/anuga/projects/from-map/', (done) => {
            anugaApi.getProjectFromMapId(42).then(() => {
                expect(lastUrl('post')).toBe('/api/v2/anuga/projects/from-map/');
                done();
            }).catch(done);
        });

        it('getProjects hits V2 /api/v2/anuga/projects/', (done) => {
            anugaApi.getProjects().then(() => {
                // parseDevHostname may pass the path through verbatim in tests.
                const url = lastUrl('get');
                expect(url.indexOf('/api/v2/anuga/projects/')).toBeGreaterThan(-1);
                expect(url.indexOf('/anuga/api/')).toBe(-1);
                done();
            }).catch(done);
        });

        it('getResourceList for "boundary" hits V2 /boundaries/ (plural-mapped)', (done) => {
            anugaApi.getResourceList(7, 'boundary').then(() => {
                expect(lastUrl('get')).toBe('/api/v2/anuga/projects/7/boundaries/');
                done();
            }).catch(done);
        });

        it('getResourceList for "mesh-region" hits V2 /mesh-regions/', (done) => {
            anugaApi.getResourceList(7, 'mesh-region').then(() => {
                expect(lastUrl('get')).toBe('/api/v2/anuga/projects/7/mesh-regions/');
                done();
            }).catch(done);
        });

        it('getResourceList for "publication" hits V2 /publications/', (done) => {
            anugaApi.getResourceList(7, 'publication').then(() => {
                expect(lastUrl('get')).toBe('/api/v2/anuga/projects/7/publications/');
                done();
            }).catch(done);
        });

        it('updateResourceTitle hits V2 plural path', (done) => {
            anugaApi.updateResourceTitle(7, 'structure', 99, 'newTitle').then(() => {
                expect(lastUrl('patch')).toBe('/api/v2/anuga/projects/7/structures/99/');
                done();
            }).catch(done);
        });

        it('updateResource hits V2 plural path', (done) => {
            anugaApi.updateResource(7, 'network', 5, {x: 1}).then(() => {
                expect(lastUrl('patch')).toBe('/api/v2/anuga/projects/7/networks/5/');
                done();
            }).catch(done);
        });

        it('createScenario hits V2 /scenarios/ (alias for V2)', (done) => {
            anugaApi.createScenario(7, {name: 'test'}).then(() => {
                expect(lastUrl('post')).toBe('/api/v2/anuga/projects/7/scenarios/');
                done();
            }).catch(done);
        });

        it('updateScenario PATCHes V2 /scenarios/{id}/', (done) => {
            anugaApi.updateScenario(7, 99, {name: 'x'}).then(() => {
                expect(lastUrl('patch')).toBe('/api/v2/anuga/projects/7/scenarios/99/');
                done();
            }).catch(done);
        });

        it('deleteScenario hits V2 /scenarios/{id}/', (done) => {
            anugaApi.deleteScenario(7, 99).then(() => {
                expect(lastUrl('delete')).toBe('/api/v2/anuga/projects/7/scenarios/99/');
                done();
            }).catch(done);
        });

        it('compareScenarios hits V2 CompareView and translates payload shape', (done) => {
            anugaApi.compareScenarios(7, [{id: 11}, {id: 22}]).then(() => {
                expect(lastUrl('post')).toBe('/api/v2/anuga/projects/7/scenarios/compare/');
                const body = JSON.parse(mockAxios.history.post.slice(-1)[0].data);
                expect(body.scenario_one_id).toBe(11);
                expect(body.scenario_two_id).toBe(22);
                done();
            }).catch(done);
        });

        it('runNetwork hits V2 /networks/{id}/run/', (done) => {
            anugaApi.runNetwork(7, 5, {}).then(() => {
                expect(lastUrl('post')).toBe('/api/v2/anuga/projects/7/networks/5/run/');
                done();
            }).catch(done);
        });

        it('getComputeInstances hits V2 global /compute-instances/', (done) => {
            anugaApi.getComputeInstances(7).then(() => {
                expect(lastUrl('get')).toBe('/api/v2/anuga/compute-instances/');
                done();
            }).catch(done);
        });

        it('createFigure hits V2 /publications/{id}/create-figure/', (done) => {
            anugaApi.createFigure(7, 99, 'fig').then(() => {
                expect(lastUrl('post')).toBe('/api/v2/anuga/projects/7/publications/99/create-figure/');
                done();
            }).catch(done);
        });

        it('memberships CRUD all hit V2 /members/ (plural per V2P-722)', (done) => {
            Promise.all([
                anugaApi.getMemberships(7),
                anugaApi.addMembership(7, 1, 2),
                anugaApi.updateMembership(7, 99, 3),
                anugaApi.deleteMembership(7, 99)
            ]).then(() => {
                expect(mockAxios.history.get.slice(-1)[0].url).toBe(
                    '/api/v2/anuga/projects/7/members/');
                expect(mockAxios.history.post.slice(-1)[0].url).toBe(
                    '/api/v2/anuga/projects/7/members/');
                expect(mockAxios.history.patch.slice(-1)[0].url).toBe(
                    '/api/v2/anuga/projects/7/members/99/');
                expect(mockAxios.history.delete.slice(-1)[0].url).toBe(
                    '/api/v2/anuga/projects/7/members/99/');
                done();
            }).catch(done);
        });

        // --- V1 holdout invariant: createResource for boundary/friction/inflow ---
        // V2 did not ship POST endpoints for these three. They remain on V1
        // until V2P-80 (or a successor task) provides V2 create. Any other
        // type MUST route through V2.

        it('createResource for "boundary" stays on V1 (V2 has no POST)', (done) => {
            anugaApi.createResource(7, 'boundary', {project: 7, title: 'x'}).then(() => {
                expect(lastUrl('post')).toBe('/anuga/api/7/boundary/');
                done();
            }).catch(done);
        });

        it('createResource for "friction" stays on V1 (V2 has no POST)', (done) => {
            anugaApi.createResource(7, 'friction', {project: 7, title: 'x'}).then(() => {
                expect(lastUrl('post')).toBe('/anuga/api/7/friction/');
                done();
            }).catch(done);
        });

        it('createResource for "inflow" stays on V1 (V2 has no POST)', (done) => {
            anugaApi.createResource(7, 'inflow', {project: 7, title: 'x'}).then(() => {
                expect(lastUrl('post')).toBe('/anuga/api/7/inflow/');
                done();
            }).catch(done);
        });

        it('createResource for "structure" routes to V2 /structures/', (done) => {
            anugaApi.createResource(7, 'structure', {project: 7, title: 'x'}).then(() => {
                expect(lastUrl('post')).toBe('/api/v2/anuga/projects/7/structures/');
                done();
            }).catch(done);
        });

        it('createResource for "mesh-region" routes to V2 /mesh-regions/', (done) => {
            anugaApi.createResource(7, 'mesh-region', {project: 7, title: 'x'}).then(() => {
                expect(lastUrl('post')).toBe('/api/v2/anuga/projects/7/mesh-regions/');
                done();
            }).catch(done);
        });

        it('createResource for "network" routes to V2 /networks/', (done) => {
            anugaApi.createResource(7, 'network', {project: 7, title: 'x'}).then(() => {
                expect(lastUrl('post')).toBe('/api/v2/anuga/projects/7/networks/');
                done();
            }).catch(done);
        });

        it('createResource for "catchment" routes to V2 /catchments/', (done) => {
            anugaApi.createResource(7, 'catchment', {project: 7, title: 'x'}).then(() => {
                expect(lastUrl('post')).toBe('/api/v2/anuga/projects/7/catchments/');
                done();
            }).catch(done);
        });

        it('createResource for "nodes" routes to V2 /nodes/', (done) => {
            anugaApi.createResource(7, 'nodes', {project: 7, title: 'x'}).then(() => {
                expect(lastUrl('post')).toBe('/api/v2/anuga/projects/7/nodes/');
                done();
            }).catch(done);
        });

        it('createResource for "links" routes to V2 /links/', (done) => {
            anugaApi.createResource(7, 'links', {project: 7, title: 'x'}).then(() => {
                expect(lastUrl('post')).toBe('/api/v2/anuga/projects/7/links/');
                done();
            }).catch(done);
        });

        // V2P-714 — cascade-delete dataset DELETE wrappers
        it('deleteTerrainV2 hits V2 /terrain/{id}/', (done) => {
            anugaApi.deleteTerrainV2(7, 99).then(() => {
                expect(lastUrl('delete')).toBe('/api/v2/anuga/projects/7/terrain/99/');
                done();
            }).catch(done);
        });

        it('deleteBoundaryV2 hits V2 /boundaries/{id}/', (done) => {
            anugaApi.deleteBoundaryV2(7, 99).then(() => {
                expect(lastUrl('delete')).toBe('/api/v2/anuga/projects/7/boundaries/99/');
                done();
            }).catch(done);
        });

        it('deleteFrictionV2 hits V2 /frictions/{id}/', (done) => {
            anugaApi.deleteFrictionV2(7, 99).then(() => {
                expect(lastUrl('delete')).toBe('/api/v2/anuga/projects/7/frictions/99/');
                done();
            }).catch(done);
        });

        it('deleteInflowV2 hits V2 /inflows/{id}/', (done) => {
            anugaApi.deleteInflowV2(7, 99).then(() => {
                expect(lastUrl('delete')).toBe('/api/v2/anuga/projects/7/inflows/99/');
                done();
            }).catch(done);
        });

        // TASK-829 (W4.2b) — FrictionRaster cascade-delete (raster sibling to Terrain).
        // BE follow-up will mount the /friction-rasters/{id}/ route on
        // ProjectViewSetV2; this test pins the FE-side URL contract.
        it('deleteFrictionRasterV2 hits V2 /friction-rasters/{id}/', (done) => {
            anugaApi.deleteFrictionRasterV2(7, 99).then(() => {
                expect(lastUrl('delete')).toBe('/api/v2/anuga/projects/7/friction-rasters/99/');
                done();
            }).catch(done);
        });
    });
});
