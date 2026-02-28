import expect from 'expect';

const swammApi = require('../api/swammApi');

describe('swammApi', () => {

    // ── Module exports ───────────────────────────────────────────────

    describe('module exports', () => {
        const expectedFunctions = [
            'getProjectFromMapId', 'getProject', 'getProjectManagerConfig',
            'getBmpTypes', 'getBmpTypeGroups', 'getGroupProfiles',
            'getAllBmps', 'getAllBmpsPaginated', 'getBmp', 'createBmp', 'updateBmp', 'deleteBmp',
            'getBmpStatuses', 'getLatestFeatureId',
            'getTargets', 'createTarget', 'updateTarget', 'deleteTarget',
            'downloadTargetXlsx',
            'getErosionData'
        ];

        expectedFunctions.forEach(name => {
            it(`should export ${name} as a function`, () => {
                expect(typeof swammApi[name]).toBe('function');
            });
        });

        it('should export exactly 23 API functions', () => {
            const exportedFunctions = Object.keys(swammApi).filter(
                k => typeof swammApi[k] === 'function' && k !== '__esModule'
            );
            expect(exportedFunctions.length).toBe(23);
        });
    });

    // ── Function signatures (argument count) ─────────────────────────

    describe('function signatures', () => {
        it('getProjectFromMapId takes 1 argument (mapId)', () => {
            expect(swammApi.getProjectFromMapId.length).toBe(1);
        });

        it('getProject takes 1 argument (projectId)', () => {
            expect(swammApi.getProject.length).toBe(1);
        });

        it('getProjectManagerConfig takes 1 argument (mapId)', () => {
            expect(swammApi.getProjectManagerConfig.length).toBe(1);
        });

        it('getBmpTypes takes 1 argument (projectId)', () => {
            expect(swammApi.getBmpTypes.length).toBe(1);
        });

        it('getBmpTypeGroups takes 1 argument (projectId)', () => {
            expect(swammApi.getBmpTypeGroups.length).toBe(1);
        });

        it('getGroupProfiles takes 0 arguments', () => {
            expect(swammApi.getGroupProfiles.length).toBe(0);
        });

        it('getAllBmps takes 1 required argument (projectId, cursor optional)', () => {
            expect(swammApi.getAllBmps.length).toBe(1);
        });

        it('getAllBmpsPaginated takes 1 argument (projectId)', () => {
            expect(swammApi.getAllBmpsPaginated.length).toBe(1);
        });

        it('getBmp takes 2 arguments (projectId, bmpId)', () => {
            expect(swammApi.getBmp.length).toBe(2);
        });

        it('createBmp takes 2 arguments (projectId, data)', () => {
            expect(swammApi.createBmp.length).toBe(2);
        });

        it('updateBmp takes 3 arguments (projectId, bmpId, data)', () => {
            expect(swammApi.updateBmp.length).toBe(3);
        });

        it('deleteBmp takes 2 arguments (projectId, bmpId)', () => {
            expect(swammApi.deleteBmp.length).toBe(2);
        });

        it('getBmpStatuses takes 1 argument (projectId)', () => {
            expect(swammApi.getBmpStatuses.length).toBe(1);
        });

        it('getLatestFeatureId takes 2 arguments (projectId, geomType)', () => {
            expect(swammApi.getLatestFeatureId.length).toBe(2);
        });

        it('getTargets takes 1 argument (projectId)', () => {
            expect(swammApi.getTargets.length).toBe(1);
        });

        it('createTarget takes 2 arguments (projectId, data)', () => {
            expect(swammApi.createTarget.length).toBe(2);
        });

        it('updateTarget takes 3 arguments (projectId, targetId, data)', () => {
            expect(swammApi.updateTarget.length).toBe(3);
        });

        it('deleteTarget takes 2 arguments (projectId, targetId)', () => {
            expect(swammApi.deleteTarget.length).toBe(2);
        });

        it('downloadTargetXlsx takes 2 arguments (projectId, targetId)', () => {
            expect(swammApi.downloadTargetXlsx.length).toBe(2);
        });

        it('getErosionData takes 1 argument (projectId)', () => {
            expect(swammApi.getErosionData.length).toBe(1);
        });

    });

    // ── Grouping sanity checks ───────────────────────────────────────

    describe('API surface coverage', () => {
        it('has project-related functions', () => {
            expect(swammApi.getProjectFromMapId).toExist();
            expect(swammApi.getProject).toExist();
            expect(swammApi.getProjectManagerConfig).toExist();
        });

        it('has BMP CRUD functions', () => {
            expect(swammApi.getAllBmps).toExist();
            expect(swammApi.getAllBmpsPaginated).toExist();
            expect(swammApi.getBmp).toExist();
            expect(swammApi.createBmp).toExist();
            expect(swammApi.updateBmp).toExist();
            expect(swammApi.deleteBmp).toExist();
        });

        it('has target CRUD functions', () => {
            expect(swammApi.getTargets).toExist();
            expect(swammApi.createTarget).toExist();
            expect(swammApi.updateTarget).toExist();
            expect(swammApi.deleteTarget).toExist();
            expect(swammApi.downloadTargetXlsx).toExist();
        });

        it('has loading data functions', () => {
            expect(swammApi.getErosionData).toExist();
        });

        it('has reference data functions', () => {
            expect(swammApi.getBmpTypes).toExist();
            expect(swammApi.getBmpTypeGroups).toExist();
            expect(swammApi.getGroupProfiles).toExist();
            expect(swammApi.getBmpStatuses).toExist();
            expect(swammApi.getLatestFeatureId).toExist();
        });
    });
});
