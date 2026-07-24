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
            // TASK-958: explicit POST /build/ endpoint
            'buildScenario',
            'startRun', 'cancelRun', 'retryRun', 'getRunStatus', 'getRun',
            // Membership + visibility
            'getMemberships', 'addMembership', 'updateMembership', 'deleteMembership',
            'searchUsers', 'updateProjectVisibility',
            // V2P-21 — batch perm fetch
            'getMyPerms',
            // V2P-714 — cascade-delete dataset rows
            'deleteTerrainV2', 'deleteBoundaryV2', 'deleteFrictionV2', 'deleteInflowV2',
            // Orphan-terrain self-heal — direct PK Dataset existence probe
            'datasetExistsByPk',
            // TASK-955 (W2.2 FE) — Rainfall cascade-delete (polygon sibling to Inflow)
            'deleteRainfallV2',
            // TASK-723 — cascade-delete fan-out (structure/mesh_region/catchment/nodes/links)
            'deleteStructureV2', 'deleteMeshRegionV2', 'deleteCatchmentV2',
            'deleteNodesV2', 'deleteLinksV2',
            // TASK-829 (W4.2b) — FrictionRaster cascade-delete (raster sibling to Terrain)
            'deleteFrictionRasterV2',
            // TASK-964 — site-level config (default compute backend for FE bootstrap)
            'getAnugaConfig',
            // TASK-930 (W2-FE) — Global Copernicus GLO-30 DEM ingest
            'createTerrainFromBbox',
            // TASK-860 — email-invite API
            'listInvitations', 'sendInvitation', 'revokeInvitation', 'resendInvitation',
            // TASK-1720 (W3) — DEM styling-mode toggle
            'patchTerrainStylingMode',
            // TASK-1729 (W1.7) — direct-to-S3 presigned-PUT terrain upload client
            'presignTerrainUpload', 'putFileToS3', 'finalizeTerrainUpload',
            'uploadTerrainDirect',
            // TASK-1881 (epic 1884 W3) — finalize retry wrapper
            'finalizeTerrainUploadWithRetry',
            // TASK-1856 (W3.2) — single-point DEM elevation query
            'getTerrainElevationPoint',
            // TASK-1861 (W4.4) — multi-raster line-profile sampler
            'getTerrainProfile',
            // TASK-1943 (W2.6) — warm-tiles-on-map-open
            'warmTiles',
            // TASK-1964 (epic 1952 W5.1) — staff run-actuals ledger fetch
            'listAdminRunLedger',
            // TASK-2099 / TASK-2100 (epic 2092 W4) — paywall + compute-meter checkout
            'createCheckoutSession', 'getComputeBalance',
            // TASK-2165 — post-WFS-T-save dataset bbox recalc
            'recalcDatasetBbox'
        ];

        expectedFunctions.forEach(name => {
            it(`should export ${name} as a function`, () => {
                expect(typeof anugaApi[name]).toBe('function');
            });
        });

        it('should export exactly 72 API functions', () => {
            // Branch baseline (epic/1587) ships 55 exported functions (the
            // historical "53→54" comment chain undercounted by one; the live
            // module is 55). TASK-1729 adds 4: presignTerrainUpload +
            // putFileToS3 + finalizeTerrainUpload + uploadTerrainDirect = 59.
            // TASK-1856 (W3.2) adds 1: getTerrainElevationPoint = 60.
            // TASK-1861 (W4.4) adds 1: getTerrainProfile = 61.
            // Orphan-terrain self-heal adds 1: datasetExistsByPk = 62.
            // TASK-1881 (epic 1884 W3) adds 1: finalizeTerrainUploadWithRetry = 63.
            // TASK-1943 (W2.6) adds 1: warmTiles = 64.
            // TASK-1964 (epic 1952 W5.1) adds 1: listAdminRunLedger = 65.
            // TASK-2099/2100 (epic 2092 W4) adds 2: createCheckoutSession +
            // getComputeBalance = 67.
            // TASK-2165 adds 1: recalcDatasetBbox = 68.
            // TASK-2323 adds 2: convertTerrainDatum + ackTerrainDatum = 70.
            // TASK-2419/2420 (epic 2359 W4.5) adds 2: getAccountSummary +
            // createBillingPortalSession = 72.
            const exportedFunctions = Object.keys(anugaApi).filter(
                k => typeof anugaApi[k] === 'function' && k !== '__esModule'
            );
            expect(exportedFunctions.length).toBe(72);
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
        it('TASK-958: buildScenario takes 2 arguments (projectId, scenarioId)', () => {
            expect(anugaApi.buildScenario.length).toBe(2);
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
        // TASK-955 (W2.2 FE) — Rainfall cascade-delete (polygon sibling to Inflow).
        it('deleteRainfallV2 takes 2 arguments (projectId, rainfallId)', () => {
            expect(anugaApi.deleteRainfallV2.length).toBe(2);
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
        // TASK-930 (W2-FE) — Global Copernicus GLO-30 DEM ingest
        it('createTerrainFromBbox takes 2 arguments (projectId, payload)', () => {
            expect(anugaApi.createTerrainFromBbox.length).toBe(2);
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

        // TASK-955 (W2.2 FE) — Rainfall cascade-delete URL contract pin.
        // BE RainfallViewSetV2 mounts at /api/v2/anuga/projects/{pid}/rainfalls/
        // (per /opt/hydrata/apps/gn_anuga/urls.py); a future BE rename would
        // need to update this test together.
        it('deleteRainfallV2 hits V2 /rainfalls/{id}/', (done) => {
            anugaApi.deleteRainfallV2(7, 99).then(() => {
                expect(lastUrl('delete')).toBe('/api/v2/anuga/projects/7/rainfalls/99/');
                done();
            }).catch(done);
        });

        // TASK-955 — createResource('rainfall') is a V1 holdout (same as
        // inflow/boundary/friction) because BE V2 RainfallViewSetV2 ships
        // list/retrieve/PATCH/DELETE only — no POST create. When BE adds V2
        // POST this test must flip alongside removing 'rainfall' from
        // V1_CREATE_ONLY_TYPES in api/anugaApi.js.
        it('createResource for "rainfall" stays on V1 (V2 has no POST)', (done) => {
            anugaApi.createResource(7, 'rainfall', {project: 7, title: 'x'}).then(() => {
                expect(lastUrl('post')).toBe('/anuga/api/7/rainfall/');
                done();
            }).catch(done);
        });

        // TASK-955 — getResourceList('rainfall') routes V2 /rainfalls/ via the
        // V2_PLURAL map. Mirrors the existing boundary/mesh-region/publication
        // checks above.
        it('getResourceList for "rainfall" hits V2 /rainfalls/', (done) => {
            anugaApi.getResourceList(7, 'rainfall').then(() => {
                expect(lastUrl('get')).toBe('/api/v2/anuga/projects/7/rainfalls/');
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

        // TASK-964 — site-level config endpoint that exposes the default
        // compute backend so the FE can flip hydrata.com to 'batch' without
        // a bundle rebuild. anugaRunMenu consumes this on mount.
        it('getAnugaConfig GETs /api/v2/anuga/config/', (done) => {
            // catch-all onAny() handler from beforeEach returns 200/{} — that's
            // enough to verify the URL is correct (the response-shape contract
            // is exercised by the BE TestAnugaConfigEndpoint pytest suite).
            anugaApi.getAnugaConfig().then(() => {
                expect(lastUrl('get')).toBe('/api/v2/anuga/config/');
                done();
            }).catch(done);
        });

        it('getAnugaConfig falls back to a legacy-local + EMPTY-allowlist shape on network error (TASK-2194)', (done) => {
            // Reset the catch-all handler so the failing handler wins.
            // The empty available_compute_targets hides the staff selector, so
            // an unreachable endpoint degrades to "dispatch omits compute_target".
            mockAxios.reset();
            mockAxios.onGet('/api/v2/anuga/config/').networkError();
            anugaApi.getAnugaConfig().then((data) => {
                expect(data).toEqual({
                    default_compute_backend: 'local',
                    available_compute_targets: [],
                    default_compute_target: null
                });
                done();
            }).catch(done);
        });

        // TASK-2194 (epic 2190 W2) — dispatch POSTs {compute_target} when a
        // target was chosen and an EMPTY body when not; the legacy
        // compute_backend field is never sent on either path.
        it('startRun POSTs {compute_target} verbatim when a target is passed (TASK-2194)', (done) => {
            anugaApi.startRun(99, 'batch-gpu-a10g').then(() => {
                expect(lastUrl('post')).toBe('/api/v2/anuga/scenarios/99/run/');
                const body = JSON.parse(mockAxios.history.post.slice(-1)[0].data);
                expect(body).toEqual({ compute_target: 'batch-gpu-a10g' });
                done();
            }).catch(done);
        });

        it('startRun OMITS compute_target (and never sends compute_backend) when no target chosen (TASK-2194)', (done) => {
            anugaApi.startRun(99).then(() => {
                expect(lastUrl('post')).toBe('/api/v2/anuga/scenarios/99/run/');
                const body = JSON.parse(mockAxios.history.post.slice(-1)[0].data);
                expect(body).toEqual({});
                done();
            }).catch(done);
        });

        // TASK-930 (W2-FE) — Global Copernicus GLO-30 DEM ingest. BE endpoint
        // shipped in TASK-929 (dc78cf3); body shape pinned by this test.
        it('createTerrainFromBbox POSTs to V2 /terrain/create-from-bbox/ with correct body', (done) => {
            const payload = {
                title: 'GLO-30 sample',
                source: 'copernicus_glo30',
                bbox: [115.7, -32.1, 116.2, -31.6]
            };
            anugaApi.createTerrainFromBbox(7, payload).then(() => {
                expect(lastUrl('post')).toBe('/api/v2/anuga/projects/7/terrain/create-from-bbox/');
                const body = JSON.parse(mockAxios.history.post.slice(-1)[0].data);
                expect(body.title).toBe('GLO-30 sample');
                expect(body.source).toBe('copernicus_glo30');
                expect(body.bbox).toEqual([115.7, -32.1, 116.2, -31.6]);
                done();
            }).catch(done);
        });

        // ── TASK-1729 (W1.7) — direct-to-S3 presigned-PUT upload client ────
        // Contract: /tmp/task-1727-fe-contract.md (3-step presign → PUT → finalize).

        it('presignTerrainUpload POSTs to /terrain/upload/presign/ with filename+content_type+size', (done) => {
            anugaApi.presignTerrainUpload(7, {
                filename: 'dem.tif', contentType: 'image/tiff', size: 506445721
            }).then(() => {
                expect(lastUrl('post')).toBe('/api/v2/anuga/projects/7/terrain/upload/presign/');
                const body = JSON.parse(mockAxios.history.post.slice(-1)[0].data);
                expect(body.filename).toBe('dem.tif');
                expect(body.content_type).toBe('image/tiff');
                expect(body.size).toBe(506445721);
                done();
            }).catch(done);
        });

        it('presignTerrainUpload defaults content_type to octet-stream and omits size when unknown', (done) => {
            anugaApi.presignTerrainUpload(7, { filename: 'dem.tif' }).then(() => {
                const body = JSON.parse(mockAxios.history.post.slice(-1)[0].data);
                expect(body.content_type).toBe('application/octet-stream');
                expect('size' in body).toBe(false);
                done();
            }).catch(done);
        });

        it('finalizeTerrainUpload POSTs to /terrain/upload/finalize/ with process_id+staging_key+title', (done) => {
            anugaApi.finalizeTerrainUpload(7, {
                processId: 'proc-uuid', stagingKey: 'terrain_uploads/staging/x/dem.tif', title: 'My DEM'
            }).then(() => {
                expect(lastUrl('post')).toBe('/api/v2/anuga/projects/7/terrain/upload/finalize/');
                const body = JSON.parse(mockAxios.history.post.slice(-1)[0].data);
                expect(body.process_id).toBe('proc-uuid');
                expect(body.staging_key).toBe('terrain_uploads/staging/x/dem.tif');
                expect(body.title).toBe('My DEM');
                done();
            }).catch(done);
        });

        it('finalizeTerrainUpload omits process_id and title when not supplied', (done) => {
            anugaApi.finalizeTerrainUpload(7, { stagingKey: 'terrain_uploads/staging/x/dem.tif' }).then(() => {
                const body = JSON.parse(mockAxios.history.post.slice(-1)[0].data);
                expect('process_id' in body).toBe(false);
                expect('title' in body).toBe(false);
                expect(body.staging_key).toBe('terrain_uploads/staging/x/dem.tif');
                done();
            }).catch(done);
        });

        // TASK-1880 (epic 1884 W2): the CRS picker forwards the user-assigned source
        // CRS as `crs_override` (TASK-1885 BE contract; osr.SetFromUserInput is the
        // authority). Present when supplied, OMITTED when not.
        it('finalizeTerrainUpload includes crs_override as crs_override when supplied', (done) => {
            anugaApi.finalizeTerrainUpload(7, {
                stagingKey: 'terrain_uploads/staging/x/dem.tif', crsOverride: 'EPSG:32756'
            }).then(() => {
                const body = JSON.parse(mockAxios.history.post.slice(-1)[0].data);
                expect(body.crs_override).toBe('EPSG:32756');
                done();
            }).catch(done);
        });

        it('finalizeTerrainUpload OMITS crs_override when not supplied (DEM already has a CRS)', (done) => {
            anugaApi.finalizeTerrainUpload(7, {
                stagingKey: 'terrain_uploads/staging/x/dem.tif', title: 'My DEM'
            }).then(() => {
                const body = JSON.parse(mockAxios.history.post.slice(-1)[0].data);
                expect('crs_override' in body).toBe(false);
                done();
            }).catch(done);
        });

        // ── TASK-1881 (epic 1884 W3) — finalizeTerrainUploadWithRetry ────────
        describe('TASK-1881 finalizeTerrainUploadWithRetry', () => {
            it('exports FINALIZE_MAX_RETRIES (number) and FINALIZE_RETRY_DELAY_MS (number)', () => {
                expect(typeof anugaApi.FINALIZE_MAX_RETRIES).toBe('number');
                expect(typeof anugaApi.FINALIZE_RETRY_DELAY_MS).toBe('number');
                expect(anugaApi.FINALIZE_MAX_RETRIES).toBeGreaterThan(0);
                expect(anugaApi.FINALIZE_RETRY_DELAY_MS).toBeGreaterThan(0);
            });

            it('resolves on first attempt when finalize returns 202 (no retry needed)', (done) => {
                mockAxios.reset();
                mockAxios.onPost(/finalize/).reply(202, { id: 1, status: 'creating' });
                anugaApi.finalizeTerrainUploadWithRetry(7, { stagingKey: 'k' }).then((resp) => {
                    expect(resp.data.id).toBe(1);
                    // Only one POST should have been made.
                    expect(mockAxios.history.post.length).toBe(1);
                    done();
                }).catch(done);
            });

            it('retries on a 5xx and resolves on the second attempt', function(done) {
                // eslint-disable-next-line no-invalid-this -- Mocha `this` for timeout extension
                this.timeout(5000); // 1 retry × 1s delay + headroom
                mockAxios.reset();
                let calls = 0;
                mockAxios.onPost(/finalize/).reply(() => {
                    calls++;
                    return calls === 1 ? [503, { detail: 'Service Unavailable' }] : [202, { id: 2 }];
                });
                anugaApi.finalizeTerrainUploadWithRetry(7, { stagingKey: 'k' }).then((resp) => {
                    expect(resp.data.id).toBe(2);
                    expect(calls).toBe(2);
                    done();
                }).catch(done);
            });

            it('does NOT retry a 4xx (terminal error re-thrown immediately)', (done) => {
                mockAxios.reset();
                let calls = 0;
                mockAxios.onPost(/finalize/).reply(() => {
                    calls++;
                    return [400, { detail: 'Unknown CRS code', code: 'VALIDATION_ERROR' }];
                });
                anugaApi.finalizeTerrainUploadWithRetry(7, { stagingKey: 'k', crsOverride: 'EPSG:99999' })
                    .then(() => done(new Error('should have rejected')))
                    .catch(() => {
                        // Only one call — no retries on 4xx.
                        expect(calls).toBe(1);
                        done();
                    });
            });

            it('retries at most FINALIZE_MAX_RETRIES times and re-throws after exhaustion', function(done) {
                // eslint-disable-next-line no-invalid-this -- Mocha `this` for timeout extension
                this.timeout(10000); // 3 attempts × 1s delay + headroom
                mockAxios.reset();
                let calls = 0;
                mockAxios.onPost(/finalize/).reply(() => { calls++; return [500, {}]; });
                anugaApi.finalizeTerrainUploadWithRetry(7, { stagingKey: 'k' })
                    .then(() => done(new Error('should have rejected')))
                    .catch(() => {
                        // 1 original + FINALIZE_MAX_RETRIES retries.
                        expect(calls).toBe(1 + anugaApi.FINALIZE_MAX_RETRIES);
                        done();
                    });
            });
        });

        // putFileToS3 uses raw XMLHttpRequest (not axios), so stub the global.
        describe('putFileToS3 (raw XHR)', () => {
            let realXHR;
            let lastXhr;

            function makeFakeXHR() {
                const xhr = {
                    upload: {},
                    _headers: {},
                    _responseHeaders: { ETag: '"abc123"' },
                    open(method, url) { this.method = method; this.url = url; },
                    setRequestHeader(k, v) { this._headers[k] = v; },
                    getResponseHeader(k) { return this._responseHeaders[k]; },
                    send(body) {
                        this.body = body;
                        lastXhr = this;
                        // Caller drives onload/onerror via lastXhr in the test.
                    }
                };
                return xhr;
            }

            beforeEach(() => {
                realXHR = global.XMLHttpRequest;
                global.XMLHttpRequest = function() {
                    const x = makeFakeXHR();
                    lastXhr = x;
                    return x;
                };
            });
            afterEach(() => {
                global.XMLHttpRequest = realXHR;
            });

            it('PUTs the file with the signed Content-Type and resolves with the ETag on 2xx', (done) => {
                const file = { name: 'dem.tif', type: 'image/tiff', size: 10 };
                const p = anugaApi.putFileToS3('https://s3/upload?sig=1', file, 'image/tiff');
                expect(lastXhr.method).toBe('PUT');
                expect(lastXhr.url).toBe('https://s3/upload?sig=1');
                expect(lastXhr._headers['Content-Type']).toBe('image/tiff');
                expect(lastXhr.body).toBe(file);
                // Simulate S3 success.
                lastXhr.status = 200;
                lastXhr.onload();
                p.then((res) => {
                    expect(res.status).toBe(200);
                    expect(res.etag).toBe('"abc123"');
                    done();
                }).catch(done);
            });

            it('drives onProgress from xhr.upload.onprogress and forces 100 on completion', (done) => {
                const file = { name: 'dem.tif', type: 'image/tiff', size: 100 };
                const seen = [];
                const p = anugaApi.putFileToS3('https://s3/u', file, 'image/tiff', (pct) => seen.push(pct));
                // Mid-transfer progress event.
                lastXhr.upload.onprogress({ lengthComputable: true, loaded: 42, total: 100 });
                lastXhr.status = 204;
                lastXhr.onload();
                p.then(() => {
                    expect(seen).toContain(42);
                    expect(seen[seen.length - 1]).toBe(100);
                    done();
                }).catch(done);
            });

            it('rejects with a status-carrying Error on a non-2xx (e.g. 403 SignatureDoesNotMatch)', (done) => {
                const file = { name: 'dem.tif', type: 'image/tiff', size: 10 };
                const p = anugaApi.putFileToS3('https://s3/u', file, 'image/tiff');
                lastXhr.status = 403;
                lastXhr.onload();
                p.then(() => done(new Error('should have rejected'))).catch((err) => {
                    expect(err.status).toBe(403);
                    done();
                });
            });

            it('rejects on a network error', (done) => {
                const file = { name: 'dem.tif', type: 'image/tiff', size: 10 };
                const p = anugaApi.putFileToS3('https://s3/u', file, 'image/tiff');
                lastXhr.onerror();
                p.then(() => done(new Error('should have rejected'))).catch(() => done());
            });
        });

        // Orchestrator: presign (axios) → PUT (XHR) → finalize (axios).
        describe('uploadTerrainDirect orchestrator', () => {
            let realXHR;
            let lastXhr;
            beforeEach(() => {
                realXHR = global.XMLHttpRequest;
                global.XMLHttpRequest = function() {
                    lastXhr = {
                        upload: {},
                        open() {},
                        setRequestHeader() {},
                        getResponseHeader() { return '"etag"'; },
                        send() {}
                    };
                    return lastXhr;
                };
            });
            afterEach(() => {
                global.XMLHttpRequest = realXHR;
            });

            it('chains presign → PUT (with the SIGNED content_type) → finalize and returns the Terrain', (done) => {
                mockAxios.reset();
                mockAxios.onPost(/terrain\/upload\/presign\/$/).reply(201, {
                    process_id: 'proc-9',
                    staging_key: 'terrain_uploads/staging/u/dem.tif',
                    upload_url: 'https://s3/u?sig=1',
                    content_type: 'image/tiff'
                });
                mockAxios.onPost(/terrain\/upload\/finalize\/$/).reply(202, { id: 84601, status: 'creating' });

                const file = { name: 'dem.tif', type: 'image/tiff', size: 10 };
                const p = anugaApi.uploadTerrainDirect(7, file, { title: 'My DEM' });

                // The presign POST is async; once it resolves the XHR is created.
                // Poll for the XHR then drive its onload to complete the PUT.
                const tick = () => {
                    if (lastXhr && lastXhr.onload) {
                        lastXhr.status = 200;
                        lastXhr.onload();
                    } else {
                        setTimeout(tick, 5);
                    }
                };
                setTimeout(tick, 5);

                p.then((finalResp) => {
                    expect(finalResp.data.id).toBe(84601);
                    const presignBody = JSON.parse(
                        mockAxios.history.post.find(r => /presign/.test(r.url)).data
                    );
                    expect(presignBody.filename).toBe('dem.tif');
                    expect(presignBody.content_type).toBe('image/tiff');
                    const finalizeBody = JSON.parse(
                        mockAxios.history.post.find(r => /finalize/.test(r.url)).data
                    );
                    expect(finalizeBody.process_id).toBe('proc-9');
                    expect(finalizeBody.staging_key).toBe('terrain_uploads/staging/u/dem.tif');
                    expect(finalizeBody.title).toBe('My DEM');
                    done();
                }).catch(done);
            });

            // TASK-1728: onPresign fires once with the presign body the instant it
            // returns, so the caller can key the Tasks-Panel row on the REAL
            // process_id BEFORE the byte transfer starts.
            it('fires onPresign with the presign body (process_id) before the PUT', (done) => {
                mockAxios.reset();
                mockAxios.onPost(/terrain\/upload\/presign\/$/).reply(201, {
                    process_id: 'proc-77',
                    staging_key: 'terrain_uploads/staging/u/dem.tif',
                    upload_url: 'https://s3/u?sig=1',
                    content_type: 'image/tiff'
                });
                mockAxios.onPost(/terrain\/upload\/finalize\/$/).reply(202, { id: 5, status: 'creating' });

                let presignData = null;
                const file = { name: 'dem.tif', type: 'image/tiff', size: 10 };
                const p = anugaApi.uploadTerrainDirect(7, file, {
                    title: 'My DEM',
                    onPresign: (data) => { presignData = data; }
                });

                const tick = () => {
                    if (lastXhr && lastXhr.onload) {
                        lastXhr.status = 200;
                        lastXhr.onload();
                    } else {
                        setTimeout(tick, 5);
                    }
                };
                setTimeout(tick, 5);

                p.then(() => {
                    expect(presignData).toExist();
                    expect(presignData.process_id).toBe('proc-77');
                    expect(presignData.staging_key).toBe('terrain_uploads/staging/u/dem.tif');
                    done();
                }).catch(done);
            });

            it('does NOT finalize when the S3 PUT fails (BE reconcile cleans the orphan)', (done) => {
                mockAxios.reset();
                mockAxios.onPost(/terrain\/upload\/presign\/$/).reply(201, {
                    process_id: 'proc-9',
                    staging_key: 'terrain_uploads/staging/u/dem.tif',
                    upload_url: 'https://s3/u?sig=1',
                    content_type: 'image/tiff'
                });
                mockAxios.onPost(/terrain\/upload\/finalize\/$/).reply(202, {});

                const file = { name: 'dem.tif', type: 'image/tiff', size: 10 };
                const p = anugaApi.uploadTerrainDirect(7, file, { title: 'My DEM' });

                const tick = () => {
                    if (lastXhr && lastXhr.onerror) {
                        lastXhr.onerror();
                    } else {
                        setTimeout(tick, 5);
                    }
                };
                setTimeout(tick, 5);

                p.then(() => done(new Error('should have rejected'))).catch(() => {
                    const finalizeCalls = mockAxios.history.post.filter(r => /finalize/.test(r.url));
                    expect(finalizeCalls.length).toBe(0);
                    done();
                });
            });

            // TASK-1880 (epic 1884 W2): crsOverride threads from uploadTerrainDirect
            // straight into the finalize body as crs_override — and does NOT appear on
            // the presign POST (the signed S3 PUT must carry no extra fields).
            it('threads crsOverride into the finalize body as crs_override (not presign)', (done) => {
                mockAxios.reset();
                mockAxios.onPost(/terrain\/upload\/presign\/$/).reply(201, {
                    process_id: 'proc-9',
                    staging_key: 'terrain_uploads/staging/u/dem.tif',
                    upload_url: 'https://s3/u?sig=1',
                    content_type: 'image/tiff'
                });
                mockAxios.onPost(/terrain\/upload\/finalize\/$/).reply(202, { id: 5, status: 'creating' });

                const file = { name: 'dem.tif', type: 'image/tiff', size: 10 };
                const p = anugaApi.uploadTerrainDirect(7, file, { title: 'My DEM', crsOverride: 'EPSG:32756' });

                const tick = () => {
                    if (lastXhr && lastXhr.onload) {
                        lastXhr.status = 200;
                        lastXhr.onload();
                    } else {
                        setTimeout(tick, 5);
                    }
                };
                setTimeout(tick, 5);

                p.then(() => {
                    const presignBody = JSON.parse(
                        mockAxios.history.post.find(r => /presign/.test(r.url)).data
                    );
                    expect('crs_override' in presignBody).toBe(false);
                    const finalizeBody = JSON.parse(
                        mockAxios.history.post.find(r => /finalize/.test(r.url)).data
                    );
                    expect(finalizeBody.crs_override).toBe('EPSG:32756');
                    done();
                }).catch(done);
            });

            it('OMITS crs_override from finalize when uploadTerrainDirect gets no crsOverride', (done) => {
                mockAxios.reset();
                mockAxios.onPost(/terrain\/upload\/presign\/$/).reply(201, {
                    process_id: 'proc-9',
                    staging_key: 'terrain_uploads/staging/u/dem.tif',
                    upload_url: 'https://s3/u?sig=1',
                    content_type: 'image/tiff'
                });
                mockAxios.onPost(/terrain\/upload\/finalize\/$/).reply(202, { id: 5, status: 'creating' });

                const file = { name: 'dem.tif', type: 'image/tiff', size: 10 };
                const p = anugaApi.uploadTerrainDirect(7, file, { title: 'My DEM' });

                const tick = () => {
                    if (lastXhr && lastXhr.onload) {
                        lastXhr.status = 200;
                        lastXhr.onload();
                    } else {
                        setTimeout(tick, 5);
                    }
                };
                setTimeout(tick, 5);

                p.then(() => {
                    const finalizeBody = JSON.parse(
                        mockAxios.history.post.find(r => /finalize/.test(r.url)).data
                    );
                    expect('crs_override' in finalizeBody).toBe(false);
                    done();
                }).catch(done);
            });
        });
    });
});
