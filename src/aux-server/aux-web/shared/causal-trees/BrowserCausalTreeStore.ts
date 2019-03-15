import { CausalTreeStore, AtomOp, StoredCausalTree, ArchivingCausalTreeStore, Atom, atomIdToString } from "@yeti-cgi/aux-common/causal-trees";
import Dexie from 'dexie';

export class BrowserCausalTreeStore implements ArchivingCausalTreeStore {
    
    private _db: CausalTreeDatabase;

    constructor() {
        this._db = new CausalTreeDatabase();
    }

    async init(): Promise<void> {
        await this._db.open();
    }

    async update<T extends AtomOp>(id: string, tree: StoredCausalTree<T>): Promise<void> {
        await this._db.trees.put(tree, id);
    }
    
    async get<T extends AtomOp>(id: string): Promise<StoredCausalTree<T>> {
        const value = await this._db.trees.get(id);
        return value;
    }

    async archiveAtoms<T extends AtomOp>(id: string, atoms: Atom<T>[]): Promise<void> {
        const keys = atoms.map(a => atomIdToString(a.id));
        const stored = atoms.map(a => ({
            ...a,
            name: id
        }));
        await this._db.archive.bulkPut(stored, keys);
    }

    async getArchive<T extends AtomOp>(id: string): Promise<Atom<T>[]> {
        return await this._db.archive.where('name').equals(id).toArray();
    }

}

interface StoredAtom<T extends AtomOp> extends Atom<T> {
    name: string;
}

class CausalTreeDatabase extends Dexie {

    trees: Dexie.Table<StoredCausalTree<any>, string>;
    archive: Dexie.Table<StoredAtom<any>, number>;

    constructor() {
        super('AuxCausalTrees');
        this.version(1).stores({
            'trees': ',site.id',
            'archive': ',name,id.timestamp,id.site'
        });
        this.trees = this.table('trees');
    }

}