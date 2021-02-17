import { AtomStore } from './AtomStore';
import { Atom, AtomId, atomIdToString } from './Atom2';
import { sortBy } from 'lodash';

/**
 * Defines a class that implements an in-memory implementation of an AtomStore.
 */
export class MemoryAtomStore implements AtomStore {
    /**
     * The map of cause IDs to atoms for the cause.
     */
    private _causeIndex: Map<string, Atom<any>[]>;

    /**
     * The map of hashes to the atom for the hash.
     */
    private _hashIndex: Map<string, Atom<any>>;

    async init(): Promise<void> {
        this._causeIndex = new Map();
        this._hashIndex = new Map();
    }

    async add<T>(atoms: Atom<T>[]): Promise<void> {
        for (let atom of atoms) {
            const cause = atom.cause ? atomIdToString(atom.cause) : '';

            let causeList = this._causeIndex.get(cause);
            if (!causeList) {
                causeList = [];
                this._causeIndex.set(cause, causeList);
            }

            causeList.push(atom);

            this._hashIndex.set(atom.hash, atom);
        }
    }

    async findByCause(cause: AtomId): Promise<Atom<any>[]> {
        const atoms =
            this._causeIndex.get(cause ? atomIdToString(cause) : '') || [];
        return sortBy(atoms, (a) => a.id.timestamp);
    }

    async findByHashes(hashes: string[]): Promise<Atom<any>[]> {
        let list = [] as Atom<any>[];
        for (let hash of hashes) {
            const atom = this._hashIndex.get(hash);
            if (atom) {
                list.push(atom);
            } else {
                list.push(null);
            }
        }

        return list;
    }
}
