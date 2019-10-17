import { MongoClient, Db, Collection } from 'mongodb';
import {
    CausalTreeStore,
    AtomOp,
    StoredCausalTree,
    Atom,
    upgrade,
    SiteInfo,
    atomIdToString,
    StoredCryptoKeys,
} from '@casual-simulation/causal-trees';

/**
 * Defines a class that is able to store a causal tree in MongoDB.
 */
export class MongoDBTreeStore implements CausalTreeStore {
    private _client: MongoClient;
    private _db: Db;
    private _trees: Collection;
    private _atoms: Collection;
    private _keys: Collection;
    private _dbName: string;
    private _collectionName: string = 'trees';
    private _atomsName: string = 'atoms';
    private _keysName: string = 'keys';

    constructor(client: MongoClient, dbName: string) {
        this._client = client;
        this._dbName = dbName;
    }

    async init() {
        this._db = this._client.db(this._dbName);
        this._trees = this._db.collection(this._collectionName);
        this._atoms = this._db.collection(this._atomsName);
        this._keys = this._db.collection(this._keysName);

        await this._trees.createIndex({ id: 1 });
        await this._atoms.createIndex({ tree: 1, archived: 1, id: 1 });
        await this._keys.createIndex({ tree: 1 });
    }

    async put<T extends AtomOp>(
        id: string,
        tree: StoredCausalTree<T>,
        fullUpdate: boolean = true
    ): Promise<void> {
        const upgraded = upgrade(tree);
        const wrapper: StorageWrapperVersion2<T> = {
            id: id,
            wrapperVersion: 2,
            formatVersion: upgraded.formatVersion,
            site: upgraded.site,
            knownSites: upgraded.knownSites,
        };

        await this._trees.updateOne(
            { id: id },
            {
                $set: wrapper,
            },
            { upsert: true }
        );

        if (fullUpdate) {
            console.log('[MongoDBTreeStore] Running full update.');

            const deleted = await this._atoms.deleteMany({ tree: id });
            console.log(`[MongoDBTreeStore] Deleted ${deleted} atoms.`);

            if (upgraded.weave) {
                console.log(
                    `[MongoDBTreeStore] Re-Adding ${
                        upgraded.weave.length
                    } atoms for tree ${id}...`
                );
                await this.add(id, upgraded.weave, false);
            } else {
                console.log(
                    `[MongoDBTreeStore] Skipping re-adding atoms because it doesn't have a weave.`
                );
            }
        }
    }

    async get<T extends AtomOp>(
        id: string,
        archived?: boolean
    ): Promise<StoredCausalTree<T>> {
        console.log(`[MongoDBTreeStore] Getting tree for ${id}.`);
        const wrapper: StorageWrapper<T> = await this._trees.findOne({
            id: id,
        });
        if (!wrapper) {
            console.log(`[MongoDBTreeStore] No tree found.`);
            return null;
        }

        if (wrapper.wrapperVersion === 2) {
            console.log(
                `[MongoDBTreeStore] Wrapper version 2 tree found, loading atoms...`
            );
            let atoms: Atom<T>[];
            if (typeof archived === 'undefined') {
                console.log('[MongoDBTreeStore] Loading all atoms...');
                atoms = await this._atoms
                    .find<AtomWrapper<T>>({ tree: id })
                    .map(a => a.atom)
                    .toArray();
            } else {
                console.log(
                    `[MongoDBTreeStore] Loading all archived == ${archived} atoms...`
                );
                atoms = await this._atoms
                    .find<AtomWrapper<T>>({ tree: id, archived: archived })
                    .map(a => a.atom)
                    .toArray();
            }

            console.log(
                `[MongoDBTreeStore] Returning ${atoms.length} atoms...`
            );
            return {
                formatVersion: 3,
                knownSites: wrapper.knownSites,
                site: wrapper.site,
                weave: atoms,
                ordered: false,
            };
        } else if (typeof wrapper.wrapperVersion === 'undefined') {
            console.log(
                `[MongoDBTreeStore] Version 1 tree found, returning tree ${
                    wrapper.tree.weave.length
                } atoms...`
            );
            return wrapper.tree;
        } else {
            throw new Error(
                `[MongoDBTreeStore] Got unrecognized wrapper version: ${
                    wrapper.wrapperVersion
                }`
            );
        }
    }

    async getTreeIds(): Promise<string[]> {
        return await this._trees
            .find({}, { projection: { id: 1 } })
            .map(doc => <string>doc.id)
            .toArray();
    }

    async add<T extends AtomOp>(
        id: string,
        atoms: Atom<T>[],
        archived: boolean = false
    ): Promise<void> {
        const wrappers: AtomWrapperVersion2<T>[] = atoms.map(
            a =>
                <AtomWrapperVersion2<T>>{
                    version: 2,
                    tree: id,
                    archived: archived,
                    id: atomIdToString(a.id),
                    atom: a,
                }
        );
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

    async putKeys(
        id: string,
        privateKey: string,
        publicKey: string
    ): Promise<void> {
        const keys: StoredCryptoKeys = {
            privateKey: privateKey,
            publicKey: publicKey,
        };
        await this._keys.updateOne(
            { tree: id },
            {
                $set: keys,
            },
            { upsert: true }
        );
    }

    async getKeys(id: string): Promise<StoredCryptoKeys> {
        const keys = await this._keys.findOne({ tree: id });
        return keys;
    }
}

type StorageWrapper<T extends AtomOp> =
    | StorageWrapperVersion1<T>
    | StorageWrapperVersion2<T>;

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

type AtomWrapper<T extends AtomOp> =
    | AtomWrapperVersion1<T>
    | AtomWrapperVersion2<T>;

interface AtomWrapperVersion1<T extends AtomOp> {
    tree: string;
    id: string;
    atom: Atom<T>;
}

interface AtomWrapperVersion2<T extends AtomOp> {
    version: 2;
    tree: string;
    id: string;
    archived: boolean;
    atom: Atom<T>;
}
