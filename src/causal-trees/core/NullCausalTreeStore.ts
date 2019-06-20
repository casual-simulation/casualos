import { CausalTreeStore, StoredCryptoKeys } from './CausalTreeStore';
import { AtomOp, Atom } from './Atom';
import { StoredCausalTree } from './StoredCausalTree';

export class NullCausalTreeStore implements CausalTreeStore {
    init(): Promise<void> {
        return Promise.resolve();
    }

    put<T extends AtomOp>(
        id: string,
        tree: StoredCausalTree<T>,
        fullUpdate?: boolean
    ): Promise<void> {
        return Promise.resolve();
    }

    add<T extends AtomOp>(
        id: string,
        atoms: Atom<T>[],
        archived?: boolean
    ): Promise<void> {
        return Promise.resolve();
    }

    get<T extends AtomOp>(
        id: string,
        archived?: boolean
    ): Promise<StoredCausalTree<T>> {
        return Promise.resolve(null);
    }

    putKeys(id: string, privateKey: string, publicKey: string): Promise<void> {
        return Promise.resolve();
    }

    getKeys(id: string): Promise<StoredCryptoKeys> {
        return Promise.resolve(null);
    }
}
