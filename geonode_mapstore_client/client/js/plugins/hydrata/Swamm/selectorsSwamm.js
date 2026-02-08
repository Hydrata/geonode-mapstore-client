export const bmpByUniqueNameSelector = (state) => state?.swamm?.bmpTypes ?
    state?.swamm?.bmpTypes.filter(
        (v, i, a)=>a.findIndex(t=>(t?.name === v?.name)
        ) === i
    ) :
    [];

export const bmpOutletLayerSelector = (state) => state?.layers?.flat?.filter((layer) => parseInt(layer?.extendedParams?.pk, 10) === state?.swamm?.projectData?.bmp_outlet?.id)[0] ||
    state?.layers?.flat?.filter((layer) => layer.name.includes(state?.swamm?.projectData?.bmp_outlet?.name))[0];

export const bmpFootprintLayerSelector = (state) => state?.layers?.flat?.filter((layer) => parseInt(layer?.extendedParams?.pk, 10) === state?.swamm?.projectData?.bmp_footprint?.id)[0] ||
    state?.layers?.flat?.filter((layer) => layer.name.includes(state?.swamm?.projectData?.bmp_footprint?.name))[0];

export const bmpWatershedLayerSelector = (state) => state?.layers?.flat?.filter((layer) => parseInt(layer?.extendedParams?.pk, 10) === state?.swamm?.projectData?.bmp_watershed?.id)[0] ||
    state?.layers?.flat?.filter((layer) => layer.name.includes(state?.swamm?.projectData?.bmp_watershed?.name))[0];


export const canViewSwammMap = (state) => {
    const currentUserId = state?.security?.user?.pk;
    const currentUserPerm = state?.gnresource?.compactPermissions?.users?.filter(user => user.id === currentUserId)[0]?.permissions;
    return ["view", "edit", "manage", "owner"].includes(currentUserPerm);
};

export const canEditSwammMap = (state) => {
    return state?.gnresource?.initialResource?.perms?.includes("change_resourcebase");
};

export const canManageAnugaMap = (state) => {
    const currentUserId = state?.security?.user?.pk;
    const currentUserPerm = state?.gnresource?.compactPermissions?.users?.filter(user => user.id === currentUserId)[0]?.permissions;
    return ["manage", "owner"].includes(currentUserPerm);
};

export const isOwnerSwammMap = (state) => {
    const currentUserId = state?.security?.user?.pk;
    const currentUserPerm = state?.gnresource?.compactPermissions?.users?.filter(user => user.id === currentUserId)[0]?.permissions;
    return ["owner"].includes(currentUserPerm);
};

export const getSwammModels = (state) => {
    const modelTypes = [
        'erosions'
    ];
    const modelTypesToApiName = {
        erosions: 'erosion'
    };
    let modelsArray = Array();
    modelTypes.map(swammModel => {
        state?.swamm?.[swammModel].map(instance => {
            modelsArray.push({...instance, apiKey: modelTypesToApiName[swammModel]});
        });
    });
    return modelsArray;
};
