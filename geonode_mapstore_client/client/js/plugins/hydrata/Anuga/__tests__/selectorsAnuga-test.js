import expect from 'expect';
import {
    canViewAnugaMap,
    canEditAnugaMap,
    canManageAnugaMap,
    isOwnerAnugaMap,
    selectedScenarios,
    getAnugaModels
} from '../selectorsAnuga';

describe('Anuga Selectors', () => {
    describe('Permission Selectors', () => {
        const createStateWithPermission = (permission) => ({
            security: { user: { pk: 1 } },
            gnresource: {
                compactPermissions: {
                    users: [{ id: 1, permissions: permission }]
                }
            }
        });

        describe('canViewAnugaMap', () => {
            it('should return true for view permission', () => {
                expect(canViewAnugaMap(createStateWithPermission('view'))).toBe(true);
            });

            it('should return true for edit permission', () => {
                expect(canViewAnugaMap(createStateWithPermission('edit'))).toBe(true);
            });

            it('should return true for manage permission', () => {
                expect(canViewAnugaMap(createStateWithPermission('manage'))).toBe(true);
            });

            it('should return true for owner permission', () => {
                expect(canViewAnugaMap(createStateWithPermission('owner'))).toBe(true);
            });

            it('should return false for no permission', () => {
                expect(canViewAnugaMap(createStateWithPermission('none'))).toBe(false);
            });
        });

        describe('canEditAnugaMap', () => {
            it('should return false for view permission', () => {
                expect(canEditAnugaMap(createStateWithPermission('view'))).toBe(false);
            });

            it('should return true for edit permission', () => {
                expect(canEditAnugaMap(createStateWithPermission('edit'))).toBe(true);
            });

            it('should return true for manage permission', () => {
                expect(canEditAnugaMap(createStateWithPermission('manage'))).toBe(true);
            });

            it('should return true for owner permission', () => {
                expect(canEditAnugaMap(createStateWithPermission('owner'))).toBe(true);
            });
        });

        describe('canManageAnugaMap', () => {
            it('should return false for view permission', () => {
                expect(canManageAnugaMap(createStateWithPermission('view'))).toBe(false);
            });

            it('should return false for edit permission', () => {
                expect(canManageAnugaMap(createStateWithPermission('edit'))).toBe(false);
            });

            it('should return true for manage permission', () => {
                expect(canManageAnugaMap(createStateWithPermission('manage'))).toBe(true);
            });

            it('should return true for owner permission', () => {
                expect(canManageAnugaMap(createStateWithPermission('owner'))).toBe(true);
            });
        });

        describe('isOwnerAnugaMap', () => {
            it('should return false for view permission', () => {
                expect(isOwnerAnugaMap(createStateWithPermission('view'))).toBe(false);
            });

            it('should return false for edit permission', () => {
                expect(isOwnerAnugaMap(createStateWithPermission('edit'))).toBe(false);
            });

            it('should return false for manage permission', () => {
                expect(isOwnerAnugaMap(createStateWithPermission('manage'))).toBe(false);
            });

            it('should return true for owner permission', () => {
                expect(isOwnerAnugaMap(createStateWithPermission('owner'))).toBe(true);
            });
        });
    });

    describe('selectedScenarios', () => {
        it('should return empty array when no scenarios are selected', () => {
            const state = {
                anuga: {
                    scenarios: [
                        { id: 1, selected: false },
                        { id: 2, selected: false }
                    ]
                }
            };
            expect(selectedScenarios(state)).toEqual([]);
        });

        it('should return only selected scenarios', () => {
            const state = {
                anuga: {
                    scenarios: [
                        { id: 1, selected: true },
                        { id: 2, selected: false },
                        { id: 3, selected: true }
                    ]
                }
            };
            const result = selectedScenarios(state);
            expect(result.length).toBe(2);
            expect(result[0].id).toBe(1);
            expect(result[1].id).toBe(3);
        });

        it('should handle undefined anuga state', () => {
            const state = {};
            expect(selectedScenarios(state)).toBe(undefined);
        });
    });

    describe('getAnugaModels', () => {
        it('should aggregate all model types into single array', () => {
            const state = {
                anuga: {
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
            };
            const result = getAnugaModels(state);
            expect(result).toEqual([]);
        });
    });
});
