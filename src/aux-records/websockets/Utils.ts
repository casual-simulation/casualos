/**
 * Gets the namespace that the given branch should use.
 * @param branch The branch.
 */
export function branchNamespace(
    mode: string,
    recordName: string | null,
    inst: string,
    branch: string
) {
    return `/${mode}/${recordName ?? ''}/${inst}/${branch}`;
}

/**
 * Gets the namespace that should be used for watching devices connected to branches.
 * @param branch The branch to watch.
 */
export function watchBranchNamespace(
    recordName: string | null,
    inst: string,
    branch: string
) {
    return `/watched_branch/${recordName ?? ''}/${inst}/${branch}`;
}

export function branchFromNamespace(mode: string, namespace: string) {
    // e.g. /branch/recordName/inst/branch
    const [recordName, inst, branch] = namespace
        .slice(mode.length + 2)
        .split('/');
    return {
        recordName: recordName === '' ? null : recordName,
        inst,
        branch,
    };
}
