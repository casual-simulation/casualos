import { CausalTreeStore, StoredCryptoKeys } from '../core/CausalTreeStore';
import { AtomOp, Atom } from '../core/Atom';
import {
    StoredCausalTree,
    WeaveReference,
    upgrade,
} from '../core/StoredCausalTree';

export class TestCausalTreeStore implements CausalTreeStore {
    private _store: {
        [key: string]: StoredCausalTree<any>;
    } = {};

    private _atoms: {
        [key: string]: Atom<any>[];
    } = {};

    private _keys: {
        [key: string]: StoredCryptoKeys;
    } = {};

    init(): Promise<void> {
        return Promise.resolve();
    }

    put<T extends AtomOp>(
        id: string,
        tree: StoredCausalTree<T>
    ): Promise<void> {
        return new Promise((resolve, reject) => {
            this._store[id] = tree;
            resolve();
        });
    }

    add<T extends AtomOp>(id: string, atoms: Atom<T>[]): Promise<void> {
        return new Promise((resolve, reject) => {
            let list = this._atoms[id];
            if (!list) {
                list = [];
                this._atoms[id] = list;
            }
            list.push(...atoms);
        });
    }

    get<T extends AtomOp>(id: string): Promise<StoredCausalTree<T>> {
        return new Promise((resolve, reject) => {
            const stored = this._store[id];
            const list = this._atoms[id];
            const upgraded = upgrade(stored);
            let atoms: Atom<any>[] = null;
            if (stored) {
                if (stored.weave) {
                    atoms = list
                        ? [...upgraded.weave, ...list]
                        : upgraded.weave;
                }
                const ordered = !list;
                resolve({
                    formatVersion: 3,
                    knownSites: stored.knownSites,
                    site: stored.site,
                    ordered: ordered && upgraded.ordered,
                    weave: atoms,
                });
            } else {
                resolve(undefined);
            }
        });
    }

    async putKeys(
        id: string,
        privateKey: string,
        publicKey: string
    ): Promise<void> {
        const keys: StoredCryptoKeys = {
            privateKey: privateKey,
            publicKey: publicKey,
        };
        this._keys[id] = keys;
    }

    async getKeys(id: string): Promise<StoredCryptoKeys> {
        return this._keys[id] || null;
    }
}
