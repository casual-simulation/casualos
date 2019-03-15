import { CausalTreeStore } from "../CausalTreeStore";
import { AtomOp } from "../Atom";
import { StoredCausalTree } from "../StoredCausalTree";

export class TestCausalTreeStore implements CausalTreeStore {
    
    private _store: {
        [key: string]: StoredCausalTree<any>;
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
}