import expect from 'expect';
import { makeAnugaResourceState, makeAnugaState, ROLE_PERMS } from './fixtures/anugaState';

describe('V2P-23 makeAnugaResourceState', () => {
    // 15 cases: role × count combos per spec AC#2
    [
        ['viewer', 1], ['viewer', 50], ['viewer', 0],
        ['contributor', 0], ['contributor', 1], ['contributor', 50],
        ['editor', 0], ['editor', 1], ['editor', 50],
        ['manager', 0], ['manager', 1], ['manager', 50],
        ['owner', 0], ['owner', 1], ['owner', 50]
    ].forEach(([role, count]) => {
        it(`role=${role} layerCount=${count}: produces correct shape`, () => {
            const result = makeAnugaResourceState(role, count);

            // Every expected type key must be present
            expect(result.scenarios).toBeA('array');
            expect(result.elevations).toBeA('array');
            expect(result.boundaries).toBeA('array');
            expect(result.inflows).toBeA('array');
            expect(result.frictions).toBeA('array');
            expect(result.structures).toBeA('array');
            expect(result.meshRegions).toBeA('array');
            expect(result.fullMeshes).toBeA('array');
            expect(result.networks).toBeA('array');
            expect(result.catchments).toBeA('array');
            expect(result.nodes).toBeA('array');
            expect(result.links).toBeA('array');
            expect(result.comparisons).toBeA('array');
            expect(result.publications).toBeA('array');
            expect(result.computeInstances).toBeA('array');
            expect(result.idfTables).toBeA('array');
            expect(result.timeSeries).toBeA('array');
            expect(result.temporalPatterns).toBeA('array');

            // Array length matches requested count
            expect(result.scenarios.length).toBe(count);
            expect(result.elevations.length).toBe(count);

            if (count > 0) {
                // IDs are 1-based integers
                expect(result.scenarios[0].id).toBe(1);
                // Perms match the role's expected set
                expect(result.scenarios[0].perms).toEqual(ROLE_PERMS[role]);
                // computeInstances always has empty perms (V2P-12b global resource)
                expect(result.computeInstances[0].perms).toEqual([]);
            }

            if (count > 1) {
                // IDs are sequential
                expect(result.scenarios[1].id).toBe(2);
            }
        });
    });

    it('returns fresh arrays so mutations on one id do not leak to another', () => {
        const result = makeAnugaResourceState('editor', 2);
        result.scenarios[0].perms.push('mutated');
        expect(result.scenarios[1].perms).toNotContain('mutated');
    });

    it('returns fresh arrays so mutations on one type do not leak to another', () => {
        const result = makeAnugaResourceState('editor', 1);
        result.scenarios[0].perms.push('mutated');
        expect(result.elevations[0].perms).toNotContain('mutated');
    });

    it('unknown role returns empty perms', () => {
        const result = makeAnugaResourceState('bogus', 1);
        expect(result.scenarios[0].perms).toEqual([]);
        expect(result.elevations[0].perms).toEqual([]);
    });

    it('computeInstances always has empty perms regardless of role', () => {
        ['viewer', 'contributor', 'editor', 'manager', 'owner'].forEach(role => {
            const result = makeAnugaResourceState(role, 1);
            expect(result.computeInstances[0].perms).toEqual([]);
        });
    });
});

describe('V2P-23 makeAnugaState', () => {
    it('wraps resources in anuga state shape with my_role and permsLoadFailed', () => {
        const state = makeAnugaState('manager', 1);
        expect(state.anuga).toExist();
        expect(state.anuga.resources).toExist();
        expect(state.anuga.project.data.my_role).toBe('manager');
        expect(state.anuga.permsLoadFailed).toBe(false);
        expect(state.anuga.resources.scenarios[0].perms).toEqual(ROLE_PERMS.manager);
    });

    it('defaults layerCount to 1', () => {
        const state = makeAnugaState('viewer');
        expect(state.anuga.resources.scenarios.length).toBe(1);
    });
});

describe('V2P-23 ROLE_PERMS map', () => {
    it('viewer has exactly 2 perms', () => {
        expect(ROLE_PERMS.viewer).toEqual(['view_resourcebase', 'download_resourcebase']);
    });

    it('contributor has exactly 3 perms', () => {
        expect(ROLE_PERMS.contributor).toEqual([
            'view_resourcebase', 'download_resourcebase', 'change_resourcebase'
        ]);
    });

    it('editor has exactly 4 perms', () => {
        expect(ROLE_PERMS.editor).toEqual([
            'view_resourcebase', 'download_resourcebase', 'change_resourcebase', 'delete_resourcebase'
        ]);
    });

    it('manager has exactly 5 perms', () => {
        expect(ROLE_PERMS.manager).toEqual([
            'view_resourcebase', 'download_resourcebase', 'change_resourcebase',
            'delete_resourcebase', 'change_resourcebase_permissions'
        ]);
    });

    it('owner has same perms as manager', () => {
        expect(ROLE_PERMS.owner).toEqual(ROLE_PERMS.manager);
    });
});
