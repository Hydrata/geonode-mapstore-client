/*
 * TASK-2038 (F5) — a new scenario's default resolution must match the BE
 * model default (apps/gn_anuga/models/scenario.py: `resolution = FloatField(
 * default=100)`). The FE previously stamped 1000, silently landing on
 * max_triangle_area = resolution^2 / 2 ≈ 1 triangle for a small domain
 * (dogfood 2026-07-01, F5).
 */
import expect from 'expect';
import scenariosReducer from '../scenariosReducer';
import {ADD_ANUGA_SCENARIO} from '../../actions/scenarioActions';

describe('TASK-2038 scenariosReducer ADD_ANUGA_SCENARIO default resolution', () => {
    it('stamps the new temp scenario with resolution 100 (matches the BE default)', () => {
        const state = scenariosReducer(undefined, {type: ADD_ANUGA_SCENARIO});
        const tempId = state.allIds[0];
        expect(state.byId[tempId].resolution).toBe(100);
    });
});
