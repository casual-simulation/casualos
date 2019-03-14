import { CausalTreeStore, ArchivingCausalTreeStore } from "../CausalTreeStore";
import { AtomOp, Atom } from "../Atom";
import { StoredCausalTree } from "../StoredCausalTree";

export class TestCausalTreeStore implements ArchivingCausalTreeStore {
    
    
    private _store: {
        [key: string]: StoredCausalTree<any>;
    } = {};

    private _archive: {
        [key: string]: Atom<any>[];
    } = {};

    init(): Promise<void> {
        return Promise.resolve();
    }
    
    update<T extends AtomOp>(id: string, tree: StoredCausalTree<T>): Promise<void> {
        return new Promise((resolve, reject) => {
            this._store[id] = tree;
            resolve();
        });
    }
    
    get<T extends AtomOp>(id: string): Promise<StoredCausalTree<T>> {
        return new Promise((resolve, reject) => {
            resolve(this._store[id]);
        });
    }

    archiveAtoms<T extends AtomOp>(id: string, atoms: Atom<T>[]): Promise<void> {
        return new Promise((resolve, reject) => {
            let archive = this._archive[id];
            if (!archive) {
                archive = [];
                this._archive[id] = archive;
            }
            archive.push(...atoms);
        });
    }

    getArchive<T extends AtomOp>(id: string): Promise<Atom<T>[]> {
        return new Promise((resolve, reject) => {
            resolve(this._archive[id] || []);
        });
    }
}