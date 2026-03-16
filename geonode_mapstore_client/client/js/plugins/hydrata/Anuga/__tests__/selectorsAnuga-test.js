import expect from 'expect';
import {
    canViewAnugaMap,
    canEditAnugaMap,
    canManageAnugaMap,
    isOwnerAnugaMap,
    getProjectMyRole,
    getProjectVisibility,
    canCreateScenario,
    canRunScenario,
    canManageMembers,
    getMemberships,
    getMembershipsLoading,
    selectedScenarios,
    getAnugaModels,
    getScenariosArray,
    getScenarioById,
    getSelectedScenario,
    getProjectData,
    getProjectId,
    getActiveRuns
} from '../selectorsAnuga';

describe('Anuga Selectors', () => {
    describe('Permission Selectors (project-level RBAC via my_role)', () => {
        const createStateWithRole = (myRole) => ({
            anuga: {
                projects: {
                    data: { id: 1, my_role: myRole, visibility: 'private' }
                }
            }
        });

        describe('getProjectMyRole', () => {
            it('should return the role from project data', () => {
                expect(getProjectMyRole(createStateWithRole('editor'))).toBe('editor');
            });

            it('should return null when no project data', () => {
                expect(getProjectMyRole({})).toBe(null);
            });
        });

        describe('getProjectVisibility', () => {
            it('should return visibility from project data', () => {
                expect(getProjectVisibility(createStateWithRole('owner'))).toBe('private');
            });
        });

        describe('canViewAnugaMap', () => {
            it('should return true for any role', () => {
                expect(canViewAnugaMap(createStateWithRole('viewer'))).toBe(true);
                expect(canViewAnugaMap(createStateWithRole('contributor'))).toBe(true);
                expect(canViewAnugaMap(createStateWithRole('editor'))).toBe(true);
                expect(canViewAnugaMap(createStateWithRole('manager'))).toBe(true);
                expect(canViewAnugaMap(createStateWithRole('owner'))).toBe(true);
            });

            it('should return false when no role', () => {
                expect(canViewAnugaMap(createStateWithRole(null))).toBe(false);
                expect(canViewAnugaMap({})).toBe(false);
            });
        });

        describe('canEditAnugaMap', () => {
            it('should return false for viewer and contributor', () => {
                expect(canEditAnugaMap(createStateWithRole('viewer'))).toBe(false);
                expect(canEditAnugaMap(createStateWithRole('contributor'))).toBe(false);
            });

            it('should return true for editor, manager, owner', () => {
                expect(canEditAnugaMap(createStateWithRole('editor'))).toBe(true);
                expect(canEditAnugaMap(createStateWithRole('manager'))).toBe(true);
                expect(canEditAnugaMap(createStateWithRole('owner'))).toBe(true);
            });
        });

        describe('canManageAnugaMap', () => {
            it('should return false for viewer, contributor, editor', () => {
                expect(canManageAnugaMap(createStateWithRole('viewer'))).toBe(false);
                expect(canManageAnugaMap(createStateWithRole('contributor'))).toBe(false);
                expect(canManageAnugaMap(createStateWithRole('editor'))).toBe(false);
            });

            it('should return true for manager and owner', () => {
                expect(canManageAnugaMap(createStateWithRole('manager'))).toBe(true);
                expect(canManageAnugaMap(createStateWithRole('owner'))).toBe(true);
            });
        });

        describe('isOwnerAnugaMap', () => {
            it('should return false for non-owners', () => {
                expect(isOwnerAnugaMap(createStateWithRole('viewer'))).toBe(false);
                expect(isOwnerAnugaMap(createStateWithRole('contributor'))).toBe(false);
                expect(isOwnerAnugaMap(createStateWithRole('editor'))).toBe(false);
                expect(isOwnerAnugaMap(createStateWithRole('manager'))).toBe(false);
            });

            it('should return true for owner', () => {
                expect(isOwnerAnugaMap(createStateWithRole('owner'))).toBe(true);
            });
        });

        describe('canCreateScenario', () => {
            it('should return false for viewer', () => {
                expect(canCreateScenario(createStateWithRole('viewer'))).toBe(false);
            });

            it('should return true for contributor and above', () => {
                expect(canCreateScenario(createStateWithRole('contributor'))).toBe(true);
                expect(canCreateScenario(createStateWithRole('editor'))).toBe(true);
                expect(canCreateScenario(createStateWithRole('manager'))).toBe(true);
                expect(canCreateScenario(createStateWithRole('owner'))).toBe(true);
            });
        });

        describe('canRunScenario', () => {
            it('should return false for viewer', () => {
                expect(canRunScenario(createStateWithRole('viewer'))).toBe(false);
            });

            it('should return true for contributor and above', () => {
                expect(canRunScenario(createStateWithRole('contributor'))).toBe(true);
                expect(canRunScenario(createStateWithRole('owner'))).toBe(true);
            });
        });

        describe('canManageMembers', () => {
            it('should return false for viewer, contributor, editor', () => {
                expect(canManageMembers(createStateWithRole('viewer'))).toBe(false);
                expect(canManageMembers(createStateWithRole('contributor'))).toBe(false);
                expect(canManageMembers(createStateWithRole('editor'))).toBe(false);
            });

            it('should return true for manager and owner', () => {
                expect(canManageMembers(createStateWithRole('manager'))).toBe(true);
                expect(canManageMembers(createStateWithRole('owner'))).toBe(true);
            });
        });

        describe('getMemberships', () => {
            it('should return memberships array', () => {
                const state = {
                    anuga: { memberships: { data: [{id: 1, username: 'alice'}] } }
                };
                expect(getMemberships(state).length).toBe(1);
                expect(getMemberships(state)[0].username).toBe('alice');
            });

            it('should return empty array when no memberships', () => {
                expect(getMemberships({})).toEqual([]);
            });
        });

        describe('getMembershipsLoading', () => {
            it('should return loading state', () => {
                const state = {
                    anuga: { memberships: { loading: true } }
                };
                expect(getMembershipsLoading(state)).toBe(true);
            });

            it('should return false by default', () => {
                expect(getMembershipsLoading({})).toBe(false);
            });
        });
    });

    describe('selectedScenarios (normalized state)', () => {
        it('should return empty array when no scenarios are selected', () => {
            const state = {
                anuga: {
                    scenarios: {
                        byId: {
                            1: { id: 1, selected: false },
                            2: { id: 2, selected: false }
                        },
                        allIds: [1, 2]
                    }
                }
            };
            expect(selectedScenarios(state)).toEqual([]);
        });

        it('should return only selected scenarios', () => {
            const state = {
                anuga: {
                    scenarios: {
                        byId: {
                            1: { id: 1, selected: true },
                            2: { id: 2, selected: false },
                            3: { id: 3, selected: true }
                        },
                        allIds: [1, 2, 3]
                    }
                }
            };
            const result = selectedScenarios(state);
            expect(result.length).toBe(2);
            expect(result[0].id).toBe(1);
            expect(result[1].id).toBe(3);
        });

        it('should handle undefined anuga state', () => {
            const state = {};
            expect(selectedScenarios(state)).toEqual([]);
        });
    });

    describe('getScenariosArray', () => {
        it('should return sorted array from normalized state', () => {
            const state = {
                anuga: {
                    scenarios: {
                        byId: {
                            3: { id: 3, name: 'C' },
                            1: { id: 1, name: 'A' },
                            2: { id: 2, name: 'B' }
                        },
                        allIds: [3, 1, 2]
                    }
                }
            };
            const result = getScenariosArray(state);
            expect(result.length).toBe(3);
            expect(result[0].id).toBe(1);
            expect(result[1].id).toBe(2);
            expect(result[2].id).toBe(3);
        });

        it('should return empty array when no scenarios', () => {
            const state = { anuga: { scenarios: { byId: {}, allIds: [] } } };
            expect(getScenariosArray(state)).toEqual([]);
        });
    });

    describe('getScenarioById', () => {
        it('should return scenario by id', () => {
            const state = {
                anuga: {
                    scenarios: {
                        byId: { 1: { id: 1, name: 'Test' } },
                        allIds: [1]
                    }
                }
            };
            expect(getScenarioById(state, 1).name).toBe('Test');
        });

        it('should return null for missing id', () => {
            const state = { anuga: { scenarios: { byId: {}, allIds: [] } } };
            expect(getScenarioById(state, 999)).toBe(null);
        });
    });

    describe('getSelectedScenario', () => {
        it('should return selected scenario from byId', () => {
            const state = {
                anuga: {
                    scenarios: {
                        byId: { 1: { id: 1, name: 'Test' } },
                        allIds: [1],
                        selectedId: 1
                    }
                }
            };
            const result = getSelectedScenario(state);
            expect(result.id).toBe(1);
            expect(result.name).toBe('Test');
        });

        it('should return null when no selection', () => {
            const state = {
                anuga: {
                    scenarios: { byId: {}, allIds: [], selectedId: null }
                }
            };
            expect(getSelectedScenario(state)).toBe(null);
        });
    });

    describe('getProjectData / getProjectId', () => {
        it('should return project data from normalized state', () => {
            const state = {
                anuga: {
                    projects: { data: { id: 42, name: 'Test' } }
                }
            };
            expect(getProjectData(state)).toEqual({ id: 42, name: 'Test' });
            expect(getProjectId(state)).toBe(42);
        });

        it('should return null/undefined when no project data', () => {
            const state = { anuga: { projects: {} } };
            expect(getProjectData(state)).toNotExist();
            expect(getProjectId(state)).toNotExist();
        });
    });

    describe('getActiveRuns', () => {
        it('should return runs in non-terminal states', () => {
            const state = {
                anuga: {
                    runs: {
                        byId: {
                            1: { id: 1, status: 'computing' },
                            2: { id: 2, status: 'complete' },
                            3: { id: 3, status: 'queued' }
                        }
                    }
                }
            };
            const result = getActiveRuns(state);
            expect(result.length).toBe(2);
            expect(result[0].id).toBe(1);
            expect(result[1].id).toBe(3);
        });

        it('should return empty array when no runs', () => {
            const state = { anuga: { runs: { byId: {} } } };
            expect(getActiveRuns(state)).toEqual([]);
        });
    });

    describe('getAnugaModels (normalized state)', () => {
        it('should aggregate all model types into single array', () => {
            const state = {
                anuga: {
                    resources: {
                        elevations: [{ id: 1, name: 'Elevation 1' }],
                        boundaries: [{ id: 2, name: 'Boundary 1' }],
                        frictions: [],
                        inflows: [{ id: 3, name: 'Inflow 1' }],
                        meshRegions: [],
                        structures: [],
                        catchments: [],
                        nodes: [],
                        links: []
                    }
                }
            };
            const result = getAnugaModels(state);
            expect(result.length).toBe(3);
            expect(result[0].apiKey).toBe('elevation');
            expect(result[1].apiKey).toBe('boundary');
            expect(result[2].apiKey).toBe('inflow');
        });

        it('should add correct apiKey to each model', () => {
            const state = {
                anuga: {
                    resources: {
                        elevations: [{ id: 1 }],
                        boundaries: [{ id: 2 }],
                        frictions: [{ id: 3 }],
                        inflows: [{ id: 4 }],
                        meshRegions: [{ id: 5 }],
                        structures: [{ id: 6 }],
                        catchments: [{ id: 7 }],
                        nodes: [{ id: 8 }],
                        links: [{ id: 9 }]
                    }
                }
            };
            const result = getAnugaModels(state);
            const apiKeys = result.map(m => m.apiKey);
            expect(apiKeys).toContain('elevation');
            expect(apiKeys).toContain('boundary');
            expect(apiKeys).toContain('friction');
            expect(apiKeys).toContain('inflow');
            expect(apiKeys).toContain('mesh-region');
            expect(apiKeys).toContain('structure');
            expect(apiKeys).toContain('catchment');
            expect(apiKeys).toContain('nodes');
            expect(apiKeys).toContain('links');
        });

        it('should return empty array when no models exist', () => {
            const state = {
                anuga: {
                    resources: {
                        elevations: [],
                        boundaries: [],
                        frictions: [],
                        inflows: [],
                        meshRegions: [],
                        structures: [],
                        catchments: [],
                        nodes: [],
                        links: []
                    }
                }
            };
            const result = getAnugaModels(state);
            expect(result).toEqual([]);
        });
    });
});
