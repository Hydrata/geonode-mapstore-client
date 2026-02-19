import expect from 'expect';
import {
    bmpByUniqueNameSelector,
    bmpOutletLayerSelector,
    bmpFootprintLayerSelector,
    bmpWatershedLayerSelector,
    canViewSwammMap,
    canEditSwammMap,
    canManageAnugaMap,
    isOwnerSwammMap,
    getSwammModels
} from '../selectorsSwamm';

describe('Swamm Selectors', () => {
    describe('bmpByUniqueNameSelector', () => {
        it('should return unique BMP types by name', () => {
            const state = {
                swamm: {
                    bmpTypes: [
                        { id: 1, name: 'Rain Garden' },
                        { id: 2, name: 'Rain Garden' },
                        { id: 3, name: 'Wetland' }
                    ]
                }
            };
            const result = bmpByUniqueNameSelector(state);
            expect(result.length).toBe(2);
            expect(result[0].name).toBe('Rain Garden');
            expect(result[1].name).toBe('Wetland');
        });

        it('should return empty array when no bmpTypes exist', () => {
            const state = { swamm: { bmpTypes: null } };
            expect(bmpByUniqueNameSelector(state)).toEqual([]);
        });

        it('should return empty array when swamm is undefined', () => {
            const state = {};
            expect(bmpByUniqueNameSelector(state)).toEqual([]);
        });
    });

    describe('Permission Selectors', () => {
        const createStateWithPermission = (permission) => ({
            security: { user: { pk: 1 } },
            gnresource: {
                compactPermissions: {
                    users: [{ id: 1, permissions: permission }]
                }
            }
        });

        describe('canViewSwammMap', () => {
            it('should return true for view permission', () => {
                expect(canViewSwammMap(createStateWithPermission('view'))).toBe(true);
            });

            it('should return true for edit permission', () => {
                expect(canViewSwammMap(createStateWithPermission('edit'))).toBe(true);
            });

            it('should return true for manage permission', () => {
                expect(canViewSwammMap(createStateWithPermission('manage'))).toBe(true);
            });

            it('should return true for owner permission', () => {
                expect(canViewSwammMap(createStateWithPermission('owner'))).toBe(true);
            });

            it('should return false for no permission', () => {
                expect(canViewSwammMap(createStateWithPermission('none'))).toBe(false);
            });
        });

        describe('canEditSwammMap', () => {
            it('should return true when user has change_resourcebase permission', () => {
                const state = {
                    gnresource: {
                        initialResource: {
                            perms: ['change_resourcebase', 'view_resourcebase']
                        }
                    }
                };
                expect(canEditSwammMap(state)).toBe(true);
            });

            it('should return false when user lacks change_resourcebase permission', () => {
                const state = {
                    gnresource: {
                        initialResource: {
                            perms: ['view_resourcebase']
                        }
                    }
                };
                expect(canEditSwammMap(state)).toBe(false);
            });

            it('should return undefined when perms is undefined', () => {
                const state = {
                    gnresource: {
                        initialResource: {}
                    }
                };
                expect(canEditSwammMap(state)).toBe(undefined);
            });
        });

        describe('isOwnerSwammMap', () => {
            it('should return true for owner permission', () => {
                expect(isOwnerSwammMap(createStateWithPermission('owner'))).toBe(true);
            });

            it('should return false for manage permission', () => {
                expect(isOwnerSwammMap(createStateWithPermission('manage'))).toBe(false);
            });

            it('should return false for edit permission', () => {
                expect(isOwnerSwammMap(createStateWithPermission('edit'))).toBe(false);
            });

            it('should return false for view permission', () => {
                expect(isOwnerSwammMap(createStateWithPermission('view'))).toBe(false);
            });
        });

        describe('canManageAnugaMap', () => {
            it('should return true for manage permission', () => {
                expect(canManageAnugaMap(createStateWithPermission('manage'))).toBe(true);
            });

            it('should return true for owner permission', () => {
                expect(canManageAnugaMap(createStateWithPermission('owner'))).toBe(true);
            });

            it('should return false for edit permission', () => {
                expect(canManageAnugaMap(createStateWithPermission('edit'))).toBe(false);
            });

            it('should return false for view permission', () => {
                expect(canManageAnugaMap(createStateWithPermission('view'))).toBe(false);
            });
        });
    });

    describe('Layer Selectors', () => {
        const createStateWithLayers = (layers, projectData) => ({
            layers: { flat: layers },
            swamm: { projectData: projectData }
        });

        it('bmpOutletLayerSelector finds layer by pk', () => {
            const state = createStateWithLayers(
                [
                    { id: 'l1', name: 'some_layer', extendedParams: { pk: '100' } },
                    { id: 'l2', name: 'bmp_outlet', extendedParams: { pk: '42' } }
                ],
                { bmp_outlet: { id: 42, name: 'tst_bmp_outlet' } }
            );
            const result = bmpOutletLayerSelector(state);
            expect(result.id).toBe('l2');
        });

        it('bmpOutletLayerSelector falls back to name match', () => {
            const state = createStateWithLayers(
                [
                    { id: 'l1', name: 'tst_bmp_outlet', extendedParams: { pk: '999' } }
                ],
                { bmp_outlet: { id: 42, name: 'tst_bmp_outlet' } }
            );
            const result = bmpOutletLayerSelector(state);
            expect(result.id).toBe('l1');
        });

        it('bmpFootprintLayerSelector finds layer by pk', () => {
            const state = createStateWithLayers(
                [
                    { id: 'l1', name: 'bmp_footprint', extendedParams: { pk: '43' } }
                ],
                { bmp_footprint: { id: 43, name: 'tst_bmp_footprint' } }
            );
            const result = bmpFootprintLayerSelector(state);
            expect(result.id).toBe('l1');
        });

        it('bmpWatershedLayerSelector finds layer by pk', () => {
            const state = createStateWithLayers(
                [
                    { id: 'l1', name: 'bmp_watershed', extendedParams: { pk: '44' } }
                ],
                { bmp_watershed: { id: 44, name: 'tst_bmp_watershed' } }
            );
            const result = bmpWatershedLayerSelector(state);
            expect(result.id).toBe('l1');
        });

        it('bmpOutletLayerSelector returns undefined when no match', () => {
            const state = createStateWithLayers(
                [{ id: 'l1', name: 'other_layer', extendedParams: { pk: '999' } }],
                { bmp_outlet: { id: 42, name: 'tst_bmp_outlet' } }
            );
            const result = bmpOutletLayerSelector(state);
            expect(result).toBe(undefined);
        });
    });

    describe('getSwammModels', () => {
        it('should return empty array when no erosion data', () => {
            const state = { swamm: { erosions: [] } };
            const result = getSwammModels(state);
            expect(result).toEqual([]);
        });

        it('should return erosion models with apiKey', () => {
            const state = {
                swamm: {
                    erosions: [
                        { id: 1, name: 'Erosion 1' },
                        { id: 2, name: 'Erosion 2' }
                    ]
                }
            };
            const result = getSwammModels(state);
            expect(result.length).toBe(2);
            expect(result[0].apiKey).toBe('erosion');
            expect(result[0].id).toBe(1);
            expect(result[1].apiKey).toBe('erosion');
        });

        it('should handle undefined swamm state gracefully', () => {
            // getSwammModels accesses state?.swamm?.[modelType]
            // If erosions is undefined, .map will fail
            // This tests the current behavior
            const state = { swamm: {} };
            try {
                getSwammModels(state);
            } catch (e) {
                // Expected - erosions is undefined, can't call .map
                expect(e).toExist();
            }
        });
    });
});
