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
        properties: ['NAME_0', 'ISO'],
        required: true // used for boundary validation
    },
    {
        name: 'geonode:admin_level_1',
        label: 'Department',
        properties: ['NAME_1', 'ENGTYPE_1']
    },
    {
        name: 'geonode:admin_level_2',
        label: 'Municipality',
        properties: ['NAME_2', 'ENGTYPE_2']
    },
    {
        name: 'geonode:lakes_02',
        label: 'Lakes',
        properties: ['name'],
        required: true // used for lake validation
    },
    {
        name: 'geonode:groundwater_potential_01',
        label: 'Groundwater Potential',
        properties: ['GWpot_calc', 'EN_GWpot_D', 'ES_GWpot_D']
    },
    {
        name: 'geonode:permeability_03',
        label: 'Permeability',
        properties: ['EN_Perm', 'EN_PrmDesc', 'ES_PrmDesc']
    },
    {
        name: 'geonode:hydrogeological_environments_01',
        label: 'Hydrogeological Environment',
        properties: ['EN_Hyd_Env', 'ES_Hyd_Env']
    },
    {
        name: 'geonode:landform_01',
        label: 'Landform',
        properties: ['Lnd_Code', 'Lnd_Desc']
    },
    {
        name: 'geonode:master_geology_01',
        label: 'Geology',
        properties: ['FLG_Lperm', 'FLG_PotCon', 'FLG_Drill', 'FLG_Thick',
            'EN_Desc', 'ES_Desc', 'EN_Hyd_Env']
    },
    {
        name: 'geonode:islands_01',
        label: 'Islands',
        properties: ['OBJECTID', 'name']
    },
    {
        name: 'geonode:wq_arsenic_01',
        label: 'Arsenic Risk',
        properties: ['As_Risk', 'EN_As_Desc', 'ES_As_Desc']
    },
    {
        name: 'geonode:wq_industrial_contamination_01',
        label: 'Industrial Contamination',
        properties: ['InCon_Risk', 'EN_ICon_De', 'ES_ICon_De']
    },
    {
        name: 'geonode:wq_saltwater_intrusion_01',
        label: 'Saltwater Intrusion',
        properties: ['SI_Risk', 'EN_SI_Desc', 'ES_SI_Desc']
    },
    {
        name: 'geonode:wq_nitrate_01',
        label: 'Nitrate Risk',
        properties: ['N03_Risk', 'EN_NO3_Des', 'ES_NO3_Des']
    },
    {
        name: 'geonode:wq_chloride_01',
        label: 'Chloride Risk',
        properties: ['cl_risk', 'en_cl_desc', 'es_cl_desc']
    }
];

export const RASTER_LAYERS = ['elevation', 'precip_annual', 'precip_driest_quarter'];

export const TOTAL_QUERIES = VECTOR_LAYERS.length + 1; // +1 for raster API call
