import expect from 'expect';

const anugaApi = require('../api/anugaApi');

describe('anugaApi', () => {

    // -- Module exports ---------------------------------------------------

    describe('module exports', () => {
        const expectedFunctions = [
            'getProjectFromMapId', 'getProject', 'getProjects',
            'createResource', 'getAvailableLayers', 'getResourceList', 'updateResourceTitle',
            'getScenarios', 'createScenario', 'updateScenario', 'deleteScenario',
            'runScenario', 'cancelScenario', 'compareScenarios',
            'runNetwork',
            'getComputeInstances',
            'createFigure',
            'searchDataset'
        ];

        expectedFunctions.forEach(name => {
            it(`should export ${name} as a function`, () => {
                expect(typeof anugaApi[name]).toBe('function');
            });
        });

        it('should export exactly 18 API functions', () => {
            const exportedFunctions = Object.keys(anugaApi).filter(
                k => typeof anugaApi[k] === 'function' && k !== '__esModule'
            );
            expect(exportedFunctions.length).toBe(18);
        });
    });

    // -- Function signatures (argument count) -----------------------------

    describe('function signatures', () => {
        it('getProjectFromMapId takes 1 argument (mapId)', () => {
            expect(anugaApi.getProjectFromMapId.length).toBe(1);
        });

        it('getProject takes 1 argument (projectId)', () => {
            expect(anugaApi.getProject.length).toBe(1);
        });

        it('getProjects takes 0 required arguments (pageSize, page have defaults)', () => {
            expect(anugaApi.getProjects.length).toBe(0);
        });

        it('createResource takes 3 arguments (projectId, type, data)', () => {
            expect(anugaApi.createResource.length).toBe(3);
        });

        it('getAvailableLayers takes 2 arguments (projectId, type)', () => {
            expect(anugaApi.getAvailableLayers.length).toBe(2);
        });

        it('getResourceList takes 2 arguments (projectId, type)', () => {
            expect(anugaApi.getResourceList.length).toBe(2);
        });

        it('updateResourceTitle takes 4 arguments (projectId, type, resourceId, title)', () => {
            expect(anugaApi.updateResourceTitle.length).toBe(4);
        });

        it('getScenarios takes 1 argument (projectId)', () => {
            expect(anugaApi.getScenarios.length).toBe(1);
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

        it('runScenario takes 3 arguments (projectId, scenarioId, data)', () => {
            expect(anugaApi.runScenario.length).toBe(3);
        });

        it('cancelScenario takes 3 arguments (projectId, scenarioId, runId)', () => {
            expect(anugaApi.cancelScenario.length).toBe(3);
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
    });

    // -- Grouping sanity checks -------------------------------------------

    describe('API surface coverage', () => {
        it('has project-related functions', () => {
            expect(anugaApi.getProjectFromMapId).toExist();
            expect(anugaApi.getProject).toExist();
            expect(anugaApi.getProjects).toExist();
        });

        it('has generic resource functions', () => {
            expect(anugaApi.createResource).toExist();
            expect(anugaApi.getAvailableLayers).toExist();
            expect(anugaApi.getResourceList).toExist();
            expect(anugaApi.updateResourceTitle).toExist();
        });

        it('has scenario CRUD functions', () => {
            expect(anugaApi.getScenarios).toExist();
            expect(anugaApi.createScenario).toExist();
            expect(anugaApi.updateScenario).toExist();
            expect(anugaApi.deleteScenario).toExist();
            expect(anugaApi.runScenario).toExist();
            expect(anugaApi.cancelScenario).toExist();
            expect(anugaApi.compareScenarios).toExist();
        });

        it('has compute and publication functions', () => {
            expect(anugaApi.getComputeInstances).toExist();
            expect(anugaApi.createFigure).toExist();
        });
    });
});
