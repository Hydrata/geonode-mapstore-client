

export const canEditAnugaMap = (state) => {
    const currentUserId = state?.security?.user?.pk;
    const currentUserPerm = state?.gnresource?.compactPermissions?.users?.filter(user => user.id === currentUserId)[0].permissions;
    return ["edit", "manage", "owner"].includes(currentUserPerm);
};

export const canManageAnugaMap = (state) => {
    const currentUserId = state?.security?.user?.pk;
    const currentUserPerm = state?.gnresource?.compactPermissions?.users?.filter(user => user.id === currentUserId)[0].permissions;
    return ["manage", "owner"].includes(currentUserPerm);
};

export const isOwnerAnugaMap = (state) => {
    const currentUserId = state?.security?.user?.pk;
    const currentUserPerm = state?.gnresource?.compactPermissions?.users?.filter(user => user.id === currentUserId)[0].permissions;
    return ["owner"].includes(currentUserPerm);
};

export const getAnugaModels = (state) => {
    const modelTypes = [
        'elevations',
        'boundaries',
        'frictions',
        'inflows',
        'meshRegions',
        'structures'
    ];
    const modelTypesToApiKey = {
        elevations: 'elevation',
        boundaries: 'boundary',
        frictions: 'friction',
        inflows: 'inflow',
        meshRegions: 'mesh-region',
        structures: 'structure'
    };
    let modelsArray = Array();
    modelTypes.map(anugaModel => {
        state?.anuga?.[anugaModel].map(instance => {
            // console.log('getAnugaModels modelsArray:', modelsArray);
            // console.log('getAnugaModels anugaModel:', anugaModel);
            // console.log('getAnugaModels instance:', instance);
            modelsArray.push({...instance, apiKey: modelTypesToApiKey[anugaModel]});
        });
    });
    return modelsArray;
};
