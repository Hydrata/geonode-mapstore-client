

export const canEditAnugaMap = (state) => {
    const currentUserId = state?.security?.user?.pk;
    const currentUserPerms = state?.gnresource?.compactPermissions?.users?.filter(id === currentUserId)[0].permissions;
    return "edit" in currentUserPerms;
};
