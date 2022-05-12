

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
