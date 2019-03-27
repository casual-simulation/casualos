import { CausalTreeStore, AtomOp, StoredCausalTree, Atom, atomIdToString, StoredCausalTreeVersion3, upgrade, SiteInfo, StoredCryptoKeys } from "@yeti-cgi/aux-common/causal-trees";
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
                await this.add(id, upgraded.weave, false);
            }
        }
    }
    
    async get<T extends AtomOp>(id: string, archived?: boolean): Promise<StoredCausalTree<T>> {
        const value = await this._db.trees.get(id);

        if (!value) {
            return null;
        }

        if (typeof value.wrapperVersion === 'undefined') {
            const query = await this._db.atoms.where('tree')
                .equals(id);
            let stored: StoredAtom<T>[];

            if (typeof archived !== 'undefined') {
                stored = await query.filter(a => a.archived === archived)
                    .toArray();
            } else {
                stored = await query.toArray();
            }
                
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

    async add<T extends AtomOp>(id: string, atoms: Atom<T>[], archived: boolean = false): Promise<void> {
        const stored = atoms.map(a => ({
            id: `${id}:${atomIdToString(a.id)}`,
            archived: archived,
            tree: id,
            atom: a,
        }));
        await this._db.atoms.bulkPut(stored);
    }

    async putKeys(id: string, privateKey: string, publicKey: string): Promise<void> {
        const stored: CryptoKeys = {
            id: id,
            keys: {
                privateKey: privateKey,
                publicKey: publicKey
            }
        };
        await this._db.keys.put(stored);
    }

    async getKeys(id: string): Promise<StoredCryptoKeys> {
        const item = await this._db.keys.get(id);
        if (item) {
            return item.keys;
        } else {
            return null;
        }
    }
}

interface StoredAtom<T extends AtomOp> {
    tree: string;
    atom: Atom<T>;
    archived: boolean;
}

type StoredTree<T extends AtomOp> = StoredTreeVersion1<T>;

interface StoredTreeVersion1<T extends AtomOp> {
    id: string;
    wrapperVersion?: 1;
    formatVersion: number;
    site: SiteInfo;
    knownSites: SiteInfo[];
}

interface CryptoKeys {
    id: string;
    keys: StoredCryptoKeys;
}

class CausalTreeDatabase extends Dexie {

    trees: Dexie.Table<StoredTree<any>, string>;
    atoms: Dexie.Table<StoredAtom<any>, number>;
    keys: Dexie.Table<CryptoKeys, string>

    constructor() {
        super('AuxCausalTrees');

        this.version(4).stores({
            'trees': 'id,site.id',
            'atoms': 'id,tree,atom.id.timestamp,atom.id.site,archived',
            'keys': 'id'
        }).upgrade(trans => {});

        this.version(3).stores({
            'trees': 'id,site.id',
            'atoms': 'id,tree,atom.id.timestamp,atom.id.site,archived'
        }).upgrade(trans => {
            console.log('[BrowserCausalTreeStore] Upgrading database to version 3...');
            return trans.table<StoredAtom<any>, string>('atoms').toCollection().modify(atom => {
                atom.archived = !!atom.archived;
            });
        });

        this.version(2).stores({
            'trees': 'id,site.id',
            'atoms': 'id,tree,atom.id.timestamp,atom.id.site,archived'
        });

        this.version(1).stores({
            'trees': 'id,site.id',
            'atoms': 'id,tree,atom.id.timestamp,atom.id.site'
        });
        this.trees = this.table('trees');
        this.atoms = this.table('atoms');
        this.keys = this.table('keys');
    }

}