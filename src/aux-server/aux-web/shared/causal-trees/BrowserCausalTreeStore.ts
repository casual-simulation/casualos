import { CausalTreeStore, AtomOp, StoredCausalTree } from "@yeti-cgi/aux-common/causal-trees";
import localForage from 'localforage';

export class BrowserCausalTreeStore implements CausalTreeStore {
    
    constructor() {
    }

    async init(): Promise<void> {}

    async update<T extends AtomOp>(id: string, tree: StoredCausalTree<T>): Promise<void> {
        await localForage.setItem(`tree_${id}`, tree);
    }
    
    async get<T extends AtomOp>(id: string): Promise<StoredCausalTree<T>> {
        const value = await localForage.getItem<StoredCausalTree<T>>(`tree_${id}`);
        return value;
    }
}