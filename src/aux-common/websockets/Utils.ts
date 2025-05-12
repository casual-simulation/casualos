/* CasualOS is a set of web-based tools designed to facilitate the creation of real-time, multi-user, context-aware interactive experiences.
 *
 * Copyright (c) 2019-2025 Casual Simulation, Inc.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
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

/**
 * Gets the ID for an inst with the given origin.
 * @param recordName The name of the record for the simulation.
 * @param inst The name of the inst for the simulation.
 */
export function formatInstId(recordName: string | null, inst: string): string {
    return `${recordName ?? ''}/${inst}`;
}

/**
 * Parses the given inst ID into the record name and inst name.
 * @param id The ID of the inst.
 */
export function parseInstId(id: string): {
    recordName: string | null;
    inst: string;
} {
    if (!id) {
        return null;
    }
    const indexOfFirstSlash = id.indexOf('/');
    if (indexOfFirstSlash < 0) {
        return null;
    }
    const recordName = id.substring(0, indexOfFirstSlash);
    const inst = id.substring(indexOfFirstSlash + 1);
    return {
        recordName: recordName ? recordName : null,
        inst,
    };
}

/**
 * Normalizes the given isnt ID.
 * Insts can belong to a record, so inst IDs have to formatted like: "{recordName}/{instName}""
 * In previous versions, insts were only referenced by their name. This function is able to normalize those IDs so that they can be parsed correctly.
 * @param id The ID that should be normalized.
 */
export function normalizeInstId(id: string): string {
    if (!id) {
        return null;
    }
    const indexOfFirstSlash = id.indexOf('/');
    if (indexOfFirstSlash < 0) {
        return '/' + id;
    }

    return id;
}
