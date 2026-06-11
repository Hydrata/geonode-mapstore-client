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
    canEditScenario,
    getMemberships,
    getMembershipsLoading,
    // TASK-860 — invitation selectors (W3 new coverage)
    getInvitations,
    getInvitationsEnabled,
    selectedScenarios,
    getAnugaModels,
    getScenariosArray,
    getScenarioById,
    getSelectedScenario,
    getProjectData,
    getProjectId,
    getActiveRuns,
    canEditLayer,
    canDeleteLayer,
    canDownloadLayer,
    canEditLayerSelector,
    canDeleteLayerSelector,
    canDownloadLayerSelector
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

        describe('canEditScenario', () => {
            const createState = (role, currentUserPk) => ({
                anuga: { projects: { data: { id: 1, my_role: role } } },
                security: { user: { pk: currentUserPk } }
            });

            it('should return false for viewer regardless of ownership', () => {
                expect(canEditScenario(createState('viewer', 7), 7)).toBe(false);
                expect(canEditScenario(createState('viewer', 7), null)).toBe(false);
            });

            it('should return true for editor, manager, owner regardless of ownership', () => {
                expect(canEditScenario(createState('editor', 7), 99)).toBe(true);
                expect(canEditScenario(createState('manager', 7), 99)).toBe(true);
                expect(canEditScenario(createState('owner', 7), 99)).toBe(true);
            });

            it('should return true for contributor on their own scenario', () => {
                expect(canEditScenario(createState('contributor', 7), 7)).toBe(true);
            });

            it('should return false for contributor on someone elses scenario', () => {
                expect(canEditScenario(createState('contributor', 7), 99)).toBe(false);
            });

            it('should return true for contributor on unsaved scenario (null owner)', () => {
                expect(canEditScenario(createState('contributor', 7), null)).toBe(true);
                expect(canEditScenario(createState('contributor', 7), undefined)).toBe(true);
            });

            it('should return false for contributor when current user pk is missing', () => {
                expect(canEditScenario(createState('contributor', undefined), 7)).toBe(false);
            });

            it('should return false when no role', () => {
                expect(canEditScenario({}, 7)).toBe(false);
                expect(canEditScenario(createState(null, 7), 7)).toBe(false);
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

        // TASK-860 — invitation selectors added in W1 (860)
        describe('getInvitations', () => {
            it('returns the invitations array from state', () => {
                const invitations = [
                    {id: 1, email: 'a@b.com', status: 'pending', role: 1, role_label: 'Viewer'},
                    {id: 2, email: 'c@d.com', status: 'accepted', role: 3, role_label: 'Editor'}
                ];
                const state = {anuga: {memberships: {invitations}}};
                const result = getInvitations(state);
                expect(result.length).toBe(2);
                expect(result[0].email).toBe('a@b.com');
                expect(result[1].status).toBe('accepted');
            });

            it('returns empty array when invitations key is absent', () => {
                expect(getInvitations({})).toEqual([]);
                expect(getInvitations({anuga: {}})).toEqual([]);
                expect(getInvitations({anuga: {memberships: {}}})).toEqual([]);
            });

            it('returns empty array when memberships slice is null/undefined', () => {
                expect(getInvitations({anuga: {memberships: null}})).toEqual([]);
            });
        });

        describe('getInvitationsEnabled', () => {
            it('returns true when invitations_enabled is true', () => {
                const state = {anuga: {memberships: {invitations_enabled: true}}};
                expect(getInvitationsEnabled(state)).toBe(true);
            });

            it('returns false when invitations_enabled is explicitly false', () => {
                const state = {anuga: {memberships: {invitations_enabled: false}}};
                expect(getInvitationsEnabled(state)).toBe(false);
            });

            it('defaults to true when invitations_enabled key is absent (pre-fetch)', () => {
                // Before the first FETCH_INVITATIONS response arrives, the slice
                // has no invitations_enabled key. The default should be true so
                // the invite form is enabled optimistically.
                expect(getInvitationsEnabled({})).toBe(true);
                expect(getInvitationsEnabled({anuga: {}})).toBe(true);
                expect(getInvitationsEnabled({anuga: {memberships: {}}})).toBe(true);
            });

            it('defaults to true when invitations_enabled is null or undefined (not false)', () => {
                // The contract is: returns false ONLY when === false. null/undefined
                // must not disable the form.
                const stateNull = {anuga: {memberships: {invitations_enabled: null}}};
                const stateUndef = {anuga: {memberships: {invitations_enabled: undefined}}};
                expect(getInvitationsEnabled(stateNull)).toBe(true);
                expect(getInvitationsEnabled(stateUndef)).toBe(true);
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
                        terrain: [{ id: 1, name: 'Terrain 1' }],
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
            expect(result[0].apiKey).toBe('terrain');
            expect(result[1].apiKey).toBe('boundary');
            expect(result[2].apiKey).toBe('inflow');
        });

        it('should add correct apiKey to each model', () => {
            const state = {
                anuga: {
                    resources: {
                        terrain: [{ id: 1 }],
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
            expect(apiKeys).toContain('terrain');
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
                        terrain: [],
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

    // V2P-02 — per-layer permission helpers (canEditLayer, canDeleteLayer,
    // canDownloadLayer) plus their state-shaped wrappers. Read order is:
    //   state.anuga.resources[type] (lazy-fetched) -> layer.perms (V2P-01 spread)
    //   -> project my_role.
    // ANY level granting the perm is enough — owners must never be locked out
    // by a transient lookup miss. Contributor+ownership rule mirrors
    // canEditScenarioByRole and extends to nested resources.
    describe('Per-layer permission helpers (V2P-02)', () => {
        describe('canEditLayer (pure)', () => {
            it('returns true when layer.perms includes change_resourcebase (any role)', () => {
                const layer = { perms: ['view_resourcebase', 'change_resourcebase'] };
                expect(canEditLayer(layer, undefined, 'viewer', 1)).toBe(true);
                expect(canEditLayer(layer, undefined, null, null)).toBe(true);
            });

            it('returns true for editor / manager / owner regardless of layer.perms', () => {
                const layer = { perms: [] };
                expect(canEditLayer(layer, undefined, 'editor', 1)).toBe(true);
                expect(canEditLayer(layer, undefined, 'manager', 1)).toBe(true);
                expect(canEditLayer(layer, undefined, 'owner', 1)).toBe(true);
            });

            it('AC#2 — falls back to my_role when state.anuga.resources is undefined (no lazy-fetch lockout)', () => {
                const layer = { id: 1, resourceType: 'boundaries', perms: [] };
                expect(canEditLayer(layer, undefined, 'editor', 1)).toBe(true);
                expect(canEditLayer(layer, undefined, 'owner', 1)).toBe(true);
            });

            it('AC#6 — contributor can edit only their own layer', () => {
                const myLayer = { perms: [], owner: 5 };
                const otherLayer = { perms: [], owner: 99 };
                expect(canEditLayer(myLayer, undefined, 'contributor', 5)).toBe(true);
                expect(canEditLayer(otherLayer, undefined, 'contributor', 5)).toBe(false);
            });

            it('viewer cannot edit a layer with no explicit perms', () => {
                const layer = { perms: ['view_resourcebase'] };
                expect(canEditLayer(layer, undefined, 'viewer', 1)).toBe(false);
            });

            it('reads state.anuga.resources first when the matching id is present', () => {
                // Important: state.anuga.resources.{type} is an ARRAY per
                // resourcesReducer.js, not a byId map.
                const layer = { id: 5, resourceType: 'boundaries', perms: [] };
                const anugaResources = {
                    boundaries: [{ id: 5, perms: ['change_resourcebase'] }]
                };
                expect(canEditLayer(layer, anugaResources, 'viewer', 1)).toBe(true);
            });

            it('falls back to layer.perms when matching id is missing in resources slice', () => {
                const layer = { id: 99, resourceType: 'boundaries', perms: ['change_resourcebase'] };
                const anugaResources = { boundaries: [{ id: 5, perms: [] }] };
                expect(canEditLayer(layer, anugaResources, 'viewer', 1)).toBe(true);
            });

            it('contributor cannot edit when currentUserId is missing', () => {
                const layer = { perms: [], owner: 5 };
                expect(canEditLayer(layer, undefined, 'contributor', null)).toBe(false);
                expect(canEditLayer(layer, undefined, 'contributor', undefined)).toBe(false);
            });

            it('handles null/undefined layer without crashing', () => {
                expect(canEditLayer(undefined, undefined, 'editor', 1)).toBe(true);
                expect(canEditLayer(null, undefined, 'viewer', 1)).toBe(false);
            });
        });

        describe('canDeleteLayer (pure)', () => {
            it('returns true when layer.perms includes delete_resourcebase', () => {
                const layer = { perms: ['delete_resourcebase'] };
                expect(canDeleteLayer(layer, undefined, 'viewer', 1)).toBe(true);
            });

            it('returns true for editor / manager / owner', () => {
                const layer = { perms: [] };
                expect(canDeleteLayer(layer, undefined, 'editor', 1)).toBe(true);
                expect(canDeleteLayer(layer, undefined, 'manager', 1)).toBe(true);
                expect(canDeleteLayer(layer, undefined, 'owner', 1)).toBe(true);
            });

            it('viewer cannot delete', () => {
                const layer = { perms: ['view_resourcebase'] };
                expect(canDeleteLayer(layer, undefined, 'viewer', 1)).toBe(false);
            });

            it('contributor can delete their own layer (ownership extension)', () => {
                const myLayer = { perms: [], owner: 5 };
                const otherLayer = { perms: [], owner: 99 };
                expect(canDeleteLayer(myLayer, undefined, 'contributor', 5)).toBe(true);
                expect(canDeleteLayer(otherLayer, undefined, 'contributor', 5)).toBe(false);
            });

            it('reads state.anuga.resources first when available', () => {
                const layer = { id: 5, resourceType: 'inflows', perms: [] };
                const anugaResources = {
                    inflows: [{ id: 5, perms: ['delete_resourcebase'] }]
                };
                expect(canDeleteLayer(layer, anugaResources, 'viewer', 1)).toBe(true);
            });
        });

        describe('canDownloadLayer (pure)', () => {
            it('returns true when layer.perms includes download_resourcebase (even anon)', () => {
                const layer = { perms: ['download_resourcebase'] };
                expect(canDownloadLayer(layer, undefined, null, null)).toBe(true);
                expect(canDownloadLayer(layer, undefined, 'anonymous', null)).toBe(true);
            });

            it('any authenticated role can download by default', () => {
                const layer = { perms: [] };
                expect(canDownloadLayer(layer, undefined, 'viewer', 1)).toBe(true);
                expect(canDownloadLayer(layer, undefined, 'contributor', 1)).toBe(true);
                expect(canDownloadLayer(layer, undefined, 'editor', 1)).toBe(true);
                expect(canDownloadLayer(layer, undefined, 'owner', 1)).toBe(true);
            });

            it('anon cannot download when no explicit perm is granted', () => {
                const layer = { perms: [] };
                expect(canDownloadLayer(layer, undefined, null, null)).toBe(false);
                expect(canDownloadLayer(layer, undefined, 'anonymous', null)).toBe(false);
            });
        });

        describe('owner role passes every gate', () => {
            it('owner can edit / delete / download any layer', () => {
                const layer = { perms: [] };
                expect(canEditLayer(layer, undefined, 'owner', 1)).toBe(true);
                expect(canDeleteLayer(layer, undefined, 'owner', 1)).toBe(true);
                expect(canDownloadLayer(layer, undefined, 'owner', 1)).toBe(true);
            });
        });

        describe('state-shaped wrappers (canEditLayerSelector etc.)', () => {
            const buildState = (myRole, currentUserPk, anugaResources) => ({
                anuga: {
                    projects: { data: { id: 1, my_role: myRole } },
                    resources: anugaResources
                },
                security: { user: { pk: currentUserPk } }
            });

            it('canEditLayerSelector pulls myRole + currentUserId from state', () => {
                const state = buildState('contributor', 7);
                expect(canEditLayerSelector(state, { perms: [], owner: 7 })).toBe(true);
                expect(canEditLayerSelector(state, { perms: [], owner: 99 })).toBe(false);
            });

            it('canDeleteLayerSelector reads from state.anuga.resources when available', () => {
                const state = buildState('viewer', 1, {
                    boundaries: [{ id: 3, perms: ['delete_resourcebase'] }]
                });
                const layer = { id: 3, resourceType: 'boundaries', perms: [] };
                expect(canDeleteLayerSelector(state, layer)).toBe(true);
            });

            it('canDownloadLayerSelector grants any authenticated role', () => {
                const state = buildState('viewer', 1);
                expect(canDownloadLayerSelector(state, { perms: [] })).toBe(true);
            });

            it('handles empty state gracefully (no role => deny edit/delete, allow download via perm only)', () => {
                expect(canEditLayerSelector({}, { perms: [] })).toBe(false);
                expect(canDeleteLayerSelector({}, { perms: [] })).toBe(false);
                expect(canDownloadLayerSelector({}, { perms: ['download_resourcebase'] })).toBe(true);
                expect(canDownloadLayerSelector({}, { perms: [] })).toBe(false);
            });
        });
    });
});
