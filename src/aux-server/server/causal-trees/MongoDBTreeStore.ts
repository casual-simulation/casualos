import { MongoClient, Db, Collection } from 'mongodb';
import pify from 'pify';
import { CausalTreeStore, AtomOp, StoredCausalTree, Atom, ArchivedAtom, upgrade, SiteInfo, atomIdToString } from '@yeti-cgi/aux-common/causal-trees';

/**
 * Defines a class that is able to store a causal tree in MongoDB.
 */
export class MongoDBTreeStore implements CausalTreeStore {
    private _client: MongoClient;
    private _db: Db;
    private _trees: Collection;
    private _atoms: Collection;
    private _dbName: string;
    private _collectionName: string = 'trees';
    private _atomsName: string = 'atoms';

    constructor(client: MongoClient, dbName: string) {
        this._client = client;
        this._dbName = dbName;
    }

    async init() {
        this._db = this._client.db(this._dbName);
        this._trees = this._db.collection(this._collectionName);
        this._atoms = this._db.collection(this._atomsName);
    }

    async put<T extends AtomOp>(id: string, tree: StoredCausalTree<T>, fullUpdate: boolean = true): Promise<void> {
        const upgraded = upgrade(tree);
        const wrapper: StorageWrapperVersion2<T> = {
            id: id,
            wrapperVersion: 2,
            formatVersion: upgraded.formatVersion,
            site: upgraded.site,
            knownSites: upgraded.knownSites,
        };
        
        await this._trees.updateOne({ channel: id }, {
            $set: wrapper
        }, { upsert: true });

        if (fullUpdate) {
            await this._atoms.deleteMany({
                tree: id
            });
            if (upgraded.weave) {
                await this.add(id, upgraded.weave);
            }
        }
    }

    async get<T extends AtomOp>(id: string): Promise<StoredCausalTree<T>> {
        const wrapper: StorageWrapper<T> = await this._trees.findOne({ id: id });
        if (!wrapper) {
            return null;
        }
        if (wrapper.wrapperVersion === 2) {

            const atoms = await this._atoms.find<AtomWrapper<T>>({ tree: id })
                .map(a => a.atom)
                .toArray();

            return {
                formatVersion: 3,
                knownSites: wrapper.knownSites,
                site: wrapper.site,
                weave: atoms,
                ordered: false
            };
        } else if (typeof wrapper.wrapperVersion === 'undefined') {
            return wrapper.tree;
        } else {
            throw new Error(`[MongoDBTreeStore] Got unrecognized wrapper version: ${wrapper.wrapperVersion}`);
        }
    }

    async add<T extends AtomOp>(id: string, atoms: Atom<T>[]): Promise<void> {
        const wrappers: AtomWrapperVersion1<T>[] = atoms.map(a => ({
            tree: id,
            id: atomIdToString(a.id),
            atom: a
        }));
        if (wrappers.length === 0) {
            return;
        }
        let op = this._atoms.initializeUnorderedBulkOp();
        wrappers.forEach(w => {
            op.find({ id: w.id, tree: id })
                .upsert()
                .updateOne(w);
        });
        await op.execute();
    }
}

type StorageWrapper<T extends AtomOp> = StorageWrapperVersion1<T> | StorageWrapperVersion2<T>;

interface StorageWrapperVersion2<T extends AtomOp> {
    id: string;
    wrapperVersion: 2;
    formatVersion: number;
    site: SiteInfo;
    knownSites: SiteInfo[];
}

interface StorageWrapperVersion1<T extends AtomOp> {
    id: string;
    wrapperVersion?: 1;
    tree: StoredCausalTree<T>;
}

type AtomWrapper<T extends AtomOp> = AtomWrapperVersion1<T>;

interface AtomWrapperVersion1<T extends AtomOp> {
    tree: string;
    id: string;
    atom: Atom<T>;
}