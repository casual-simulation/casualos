import { WeaveResult, Weave } from './Weave2';
import { Atom, atom, atomId } from './Atom2';
import uuid from 'uuid/v4';

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
 * @param time The time to use.
 */
export function newSite(time?: number): SiteStatus {
    return {
        id: uuid(),
        time: time || 0,
    };
}

/**
 * Calculates the new site status from the current site status and result.
 * @param site The site.
 * @param result The result.
 */
export function updateSite(site: SiteStatus, result: WeaveResult): SiteStatus {
    if (result.type === 'atom_added') {
        return {
            id: site.id,
            time: calculateTime(site, result.atom),
        };
    } else if (result.type === 'conflict') {
        return {
            id: site.id,
            time: calculateTime(site, result.winner),
        };
    }
    return site;
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
    priority?: number
): Atom<T> {
    return atom(atomId(site.id, site.time + 1, priority), cause, value);
}

/**
 * Adds the given atom to the given weave.
 * Returns the updated site status, weave result, and final atom.
 * @param weave The weave that the atom should be added to.
 * @param site The current site.
 * @param atom The atom.
 */
export function addAtom<T>(weave: Weave<T>, site: SiteStatus, atom: Atom<T>) {
    const result = weave.insert(atom);
    const newSite = updateSite(site, result);

    let finalAtom: Atom<T>;
    if (result.type === 'atom_added') {
        finalAtom = result.atom;
    } else if (result.type === 'conflict') {
        finalAtom = result.winner;
    }

    return {
        result: result,
        site: newSite,
        atom: finalAtom || null,
    };
}

function calculateTime(site: SiteStatus, atom: Atom<any>) {
    if (atom.id.site !== site.id) {
        return Math.max(site.time, atom.id.timestamp) + 1;
    } else {
        return Math.max(site.time, atom.id.timestamp);
    }
}
