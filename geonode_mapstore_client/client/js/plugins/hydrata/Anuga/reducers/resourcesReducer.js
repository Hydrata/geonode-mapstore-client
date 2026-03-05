import {
    SET_ANUGA_ELEVATION_DATA,
    SET_ANUGA_BOUNDARY_DATA,
    SET_ANUGA_FRICTION_DATA,
    SET_ANUGA_INFLOW_DATA,
    SET_ANUGA_STRUCTURE_DATA,
    SET_ANUGA_FULL_MESH_DATA,
    SET_ANUGA_MESH_REGION_DATA,
    SET_NETWORK_DATA,
    SET_LUMPED_CATCHMENT_DATA,
    SET_ANUGA_NODES_DATA,
    SET_ANUGA_LINKS_DATA,
    SET_PUBLICATION_DATA,
    SET_COMPARISON_DATA,
    UPDATE_COMPUTE_INSTANCE_SUCCESS,
    UPDATE_NETWORK
} from "../actionsAnuga";

const initialState = {
    elevations: [],
    boundaries: [],
    frictions: [],
    inflows: [],
    structures: [],
    fullMeshes: [],
    meshRegions: [],
    networks: [],
    catchments: [],
    nodes: [],
    links: [],
    publications: [],
    comparisons: [],
    computeInstances: []
};

export default (state = initialState, action) => {
    switch (action.type) {
    case SET_ANUGA_ELEVATION_DATA:
        return { ...state, elevations: action.data };
    case SET_ANUGA_BOUNDARY_DATA:
        return { ...state, boundaries: action.data };
    case SET_ANUGA_FRICTION_DATA:
        return { ...state, frictions: action.data };
    case SET_ANUGA_INFLOW_DATA:
        return { ...state, inflows: action.data };
    case SET_ANUGA_STRUCTURE_DATA:
        return { ...state, structures: action.data };
    case SET_ANUGA_FULL_MESH_DATA:
        return { ...state, fullMeshes: action.data };
    case SET_ANUGA_MESH_REGION_DATA:
        return { ...state, meshRegions: action.data };
    case SET_NETWORK_DATA:
        return { ...state, networks: action.data };
    case SET_LUMPED_CATCHMENT_DATA:
        return { ...state, catchments: action.data };
    case SET_ANUGA_NODES_DATA:
        return { ...state, nodes: action.data };
    case SET_ANUGA_LINKS_DATA:
        return { ...state, links: action.data };
    case SET_PUBLICATION_DATA:
        return { ...state, publications: action.data };
    case SET_COMPARISON_DATA:
        return { ...state, comparisons: action.data };
    case UPDATE_COMPUTE_INSTANCE_SUCCESS:
        return { ...state, computeInstances: action.data };
    case UPDATE_NETWORK:
        return {
            ...state,
            networks: state.networks.map((network) => {
                if (network.id === action.network.id) {
                    return { ...action.network, unsaved: true };
                }
                return network;
            })
        };
    default:
        return state;
    }
};
