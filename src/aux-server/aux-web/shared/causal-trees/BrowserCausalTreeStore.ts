import { CausalTreeStore, AtomOp, StoredCausalTree, Atom, atomIdToString, StoredCausalTreeVersion3, upgrade, SiteInfo } from "@yeti-cgi/aux-common/causal-trees";
import Dexie from 'dexie';

export class BrowserCausalTreeStore implements CausalTreeStore {
    
    
    private _db: CausalTreeDatabase;

    constructor() {
        this._db = new CausalTreeDatabase();
    }

    async init(): Promise<void> {
        await this._db.open();
    }

    async put<T extends AtomOp>(id: string, tree: StoredCausalTree<T>, fullUpdate: boolean = true): Promise<void> {
        const upgraded = upgrade(tree);
        const stored: StoredTreeVersion1<T> = {
            id: id,
            formatVersion: upgraded.formatVersion,
            knownSites: upgraded.knownSites,
            site: upgraded.site,
        };

        await this._db.trees.put(stored);

        if (fullUpdate) {
            await this._db.atoms.where('tree').equals(id).delete();
            
            if (upgraded.weave) {
                await this.add(id, upgraded.weave);
            }
        }
    }
    
    async get<T extends AtomOp>(id: string): Promise<StoredCausalTree<T>> {
        const value = await this._db.trees.get(id);

        if (!value) {
            return null;
        }

        if (typeof value.wrapperVersion === 'undefined') {
            const stored = await this._db.atoms.where('tree')
                .equals(id)
                .toArray();
            const atoms = stored.map(a => a.atom);

            return {
                formatVersion: 3,
                knownSites: value.knownSites,
                site: value.site,
                weave: atoms,
                ordered: false
            };
        } else {
            throw new Error(`[BrowserCausalTreeStore] Got unrecognized wrapper version: ${value.wrapperVersion}.`)
        }
    }

    async add<T extends AtomOp>(id: string, atoms: Atom<T>[]): Promise<void> {
        const keys = atoms.map(a => atomIdToString(a.id));
        const stored = atoms.map(a => ({
            id: atomIdToString(a.id),
            tree: id,
            atom: a,
        }));
        await this._db.atoms.bulkAdd(stored, keys);
    }
}

interface StoredAtom<T extends AtomOp> {
    tree: string;
    atom: Atom<T>;
}

type StoredTree<T extends AtomOp> = StoredTreeVersion1<T>;

interface StoredTreeVersion1<T extends AtomOp> {
    id: string;
    wrapperVersion?: 1;
    formatVersion: number;
    site: SiteInfo;
    knownSites: SiteInfo[];
}

class CausalTreeDatabase extends Dexie {

    trees: Dexie.Table<StoredTree<any>, string>;
    atoms: Dexie.Table<StoredAtom<any>, number>;

    constructor() {
        super('AuxCausalTrees');
        this.version(1).stores({
            'trees': 'id,site.id',
            'atoms': 'id,tree,atom.id.timestamp,atom.id.site'
        });
        this.trees = this.table('trees');
    }

}