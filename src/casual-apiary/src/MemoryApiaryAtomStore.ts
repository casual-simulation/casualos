import { Atom } from '@casual-simulation/causal-trees';
import { sortBy, sortedIndexBy } from 'lodash';
import { ApiaryAtomStore } from './ApiaryAtomStore';

/**
 * Defines an implementation of an ApiaryAtomStore that stores everything in RAM.
 */
export class MemoryApiaryAtomStore implements ApiaryAtomStore {
    private _map = new Map<string, Atom<any>[]>();

    reset() {
        this._map = new Map();
    }

    async saveAtoms(namespace: string, atoms: Atom<any>[]): Promise<void> {
        let list = this._getAtomList(namespace);
        for (let atom of atoms) {
            const insertIndex = sortedIndexBy(list, atom, (a) => a.hash);
            const found = list[insertIndex];
            if (!found || found.hash !== atom.hash) {
                list.splice(insertIndex, 0, atom);
            }
        }
    }

    async loadAtoms(namespace: string): Promise<Atom<any>[]> {
        return sortBy(this._getAtomList(namespace), (a) => a.id.timestamp);
    }

    async countAtoms(namespace: string): Promise<number> {
        return this._getAtomList(namespace).length;
    }

    async deleteAtoms(namespace: string, atomHashes: string[]): Promise<void> {
        let list = this._getAtomList(namespace);
        for (let hash of atomHashes) {
            const deleteIndex = list.findIndex((a) => a.hash === hash);
            if (deleteIndex >= 0) {
                list.splice(deleteIndex, 1);
            }
        }
    }

    async clearNamespace(namespace: string): Promise<void> {
        this._map.set(namespace, []);
    }

    private _getAtomList(namespace: string): Atom<any>[] {
        let list = this._map.get(namespace);
        if (!list) {
            list = [];
            this._map.set(namespace, list);
        }
        return list;
    }
}
