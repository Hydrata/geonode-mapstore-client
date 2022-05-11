

export const canEditAnugaMap = (state) => {
    const currentUserId = state?.security?.user?.pk;
    const currentUserPerm = state?.gnresource?.compactPermissions?.users?.filter(user => user.id === currentUserId)[0].permissions;
    return currentUserPerm in ["edit", "manage"];
};
