import { WeaveResult, Weave, addedAtom } from './Weave2';
import { Atom, atom, atomId, AtomCardinality } from './Atom2';
import { v4 as uuid } from 'uuid';

/**
 * Describes information about the current status of a site.
 */
export interface SiteStatus {
    /**
     * The ID of the site.
     */
    id: string;

    /**
     * The time that the site is currently at.
     */
    time: number;
}

/**
 * Creates a new site.
 * @param id The ID to use.
 * @param time The time to use.
 */
export function newSite(id?: string, time?: number): SiteStatus {
    return {
        id: id || uuid(),
        time: time || 0,
    };
}

/**
 * Calculates the new site status from the current site status and result.
 * @param site The site.
 * @param result The result.
 */
export function updateSite(site: SiteStatus, result: WeaveResult): SiteStatus {
    const added = addedAtom(result);
    if (added) {
        if (Array.isArray(added)) {
            let time = -1;
            for (let a of added) {
                time = Math.max(time, calculateTime(site, a));
            }
            return {
                id: site.id,
                time: time,
            };
        } else {
            return {
                id: site.id,
                time: calculateTime(site, added),
            };
        }
    }
    return site;
}

export function calculateResultTime(
    site: SiteStatus,
    result: WeaveResult
): number {
    const added = addedAtom(result);
    if (added) {
        if (Array.isArray(added)) {
            let time = -1;
            for (let a of added) {
                time = Math.max(time, calculateTime(site, a));
            }
            return time;
        } else {
            return calculateTime(site, added);
        }
    }
    return site.time;
}

/**
 * Merges the two sites together.
 * @param first The first site.
 * @param second The second site.
 */
export function mergeSites(first: SiteStatus, second: SiteStatus): SiteStatus {
    if (first && !second) {
        return first;
    } else if (!first && second) {
        return second;
    } else if (!first && !second) {
        return null;
    }
    return {
        id: first.id,
        time: calculateTimeFromId(first.id, first.time, second.id, second.time),
    };
}

/**
 * Creates an atom for the given site.
 * @param site The site.
 * @param cause The cause of the new atom.
 * @param value The value to include with the atom.
 * @param priority The priority of the atom.
 */
export function createAtom<T>(
    site: SiteStatus,
    cause: Atom<any>,
    value: T,
    priority?: number,
    cardinality?: AtomCardinality
): Atom<T> {
    return atom(
        atomId(site.id, site.time + 1, priority, cardinality),
        cause,
        value
    );
}

function calculateTime(site: SiteStatus, atom: Atom<any>) {
    return calculateTimeFromId(
        site.id,
        site.time,
        atom.id.site,
        atom.id.timestamp
    );
}

export function calculateTimeFromId(
    id: string,
    time: number,
    newId: string,
    newTime: number
) {
    if (id !== newId) {
        return Math.max(time, newTime) + 1;
    } else {
        return Math.max(time, newTime);
    }
}
