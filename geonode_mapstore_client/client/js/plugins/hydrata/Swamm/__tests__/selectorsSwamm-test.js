import expect from 'expect';
import {
    bmpByUniqueNameSelector,
    canViewSwammMap,
    canEditSwammMap,
    isOwnerSwammMap
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
    });
});
