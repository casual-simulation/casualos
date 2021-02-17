import {
    WeaveResult,
    iterateFrom,
    AtomConflictResult,
    WeaveNode,
} from './Weave2';
import { AtomIndexFullDiff, AtomHashList } from './AtomIndex';
import { Atom, atomIdToString } from './Atom2';
import { uniqBy } from 'lodash';

/**
 * Calculates the index diff from the given weave results.
 * @param results The results.
 */
export function batchDiff(results: WeaveResult[]): AtomIndexFullDiff {
    let added: Atom<any>[] = [];
    let deleted: AtomHashList = {};
    for (let result of results) {
        if (result.type === 'atom_added') {
            added.push(result.atom);
        } else if (result.type === 'conflict') {
            added.push(result.winner);

            if (result.loserRef) {
                removeRef(result.loserRef);
            }
        } else if (result.type === 'atom_removed') {
            removeRef(result.ref);
        }
    }

    return {
        additions: uniqBy(added, (a) => a.hash),
        deletions: deleted,
    };

    function removeRef(ref: WeaveNode<any>) {
        for (let removed of iterateFrom(ref)) {
            const hash = removed.atom.hash;
            const idx = added.findIndex((a) => a.hash === hash);
            if (idx >= 0) {
                added.splice(idx, 1);
            } else {
                deleted[hash] = atomIdToString(removed.atom.id);
            }
        }
    }
}

export function batch(
    generator: () => Iterator<WeaveResult>
): AtomIndexFullDiff {
    let results: WeaveResult[] = [];

    let iterator = generator();
    let result = iterator.next();
    while (!result.done) {
        results.push(result.value);
        result = iterator.next();
    }

    return batchDiff(results);
}
