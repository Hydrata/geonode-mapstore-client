/**
 * Layer configuration for HGeval queries.
 * Each layer defines the WFS typeName, properties to extract, and display metadata.
 * Raster layers (elevation, precip) are queried via Django backend, not WFS.
 */

export const NICARAGUA_BOUNDS = {
    minLon: -87.7,
    maxLon: -82.5,
    minLat: 10.7,
    maxLat: 15.1
};

export const VECTOR_LAYERS = [
    {
        name: 'geonode:admin_level_0',
        label: 'Country',
        properties: ['admin_leve', 'name'],
        required: true // used for boundary validation
    },
    {
        name: 'geonode:admin_level_1',
        label: 'Department',
        properties: ['admin_leve', 'name']
    },
    {
        name: 'geonode:admin_level_2',
        label: 'Municipality',
        properties: ['admin_leve', 'name']
    },
    {
        name: 'geonode:lakes_02',
        label: 'Lakes',
        properties: ['Lk_Name'],
        required: true // used for lake validation
    },
    {
        name: 'geonode:groundwater_potential_01',
        label: 'Groundwater Potential',
        properties: ['GW_Pot', 'EN_GW_Desc', 'ES_GW_Desc']
    },
    {
        name: 'geonode:permeability_03',
        label: 'Permeability',
        properties: ['Perm_Code', 'EN_Per_Des', 'ES_Per_Des']
    },
    {
        name: 'geonode:hydrogeological_environments_01',
        label: 'Hydrogeological Environment',
        properties: ['HGE_Code', 'EN_HGE_Des', 'ES_HGE_Des']
    },
    {
        name: 'geonode:landform_01',
        label: 'Landform',
        properties: ['Lnd_Code', 'EN_Lnd_Des', 'ES_Lnd_Des']
    },
    {
        name: 'geonode:master_geology_01',
        label: 'Geology',
        properties: ['FLG_Lperm', 'FLG_PotCon', 'FLG_Drill', 'FLG_Thick',
            'EN_Geo_Des', 'ES_Geo_Des', 'EN_Aqu_Des', 'ES_Aqu_Des']
    },
    {
        name: 'geonode:islands_01',
        label: 'Islands',
        properties: ['OBJECTID', 'ISLAND']
    },
    {
        name: 'geonode:wq_arsenic_01',
        label: 'Arsenic Risk',
        properties: ['As_Risk', 'EN_As_Desc', 'ES_As_Desc']
    },
    {
        name: 'geonode:wq_industrial_contamination_01',
        label: 'Industrial Contamination',
        properties: ['InCon_Risk', 'EN_InCon_D', 'ES_InCon_D']
    },
    {
        name: 'geonode:wq_saltwater_intrusion_01',
        label: 'Saltwater Intrusion',
        properties: ['SI_Risk', 'EN_SI_Desc', 'ES_SI_Desc']
    },
    {
        name: 'geonode:wq_nitrate_01',
        label: 'Nitrate Risk',
        properties: ['N03_Risk', 'EN_N03_Des', 'ES_N03_Des']
    },
    {
        name: 'geonode:wq_chloride_01',
        label: 'Chloride Risk',
        properties: ['cl_risk', 'en_cl_desc', 'es_cl_desc']
    }
];

export const RASTER_LAYERS = ['elevation', 'precip_annual', 'precip_driest_quarter'];

export const TOTAL_QUERIES = VECTOR_LAYERS.length + 1; // +1 for raster API call
