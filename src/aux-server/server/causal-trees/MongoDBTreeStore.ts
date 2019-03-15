import { MongoClient, Db, Collection } from 'mongodb';
import pify from 'pify';
import { CausalTreeStore, AtomOp, StoredCausalTree, ArchivingCausalTreeStore, Atom, ArchivedAtom } from '@yeti-cgi/aux-common/causal-trees';

/**
 * Defines a class that is able to store a causal tree in MongoDB.
 */
export class MongoDBTreeStore implements ArchivingCausalTreeStore {
    private _client: MongoClient;
    private _db: Db;
    private _collection: Collection;
    private _archive: Collection;
    private _dbName: string;
    private _collectionName: string = 'trees';
    private _archiveName: string = 'archive';

    constructor(client: MongoClient, dbName: string) {
        this._client = client;
        this._dbName = dbName;
    }

    async init() {
        this._db = this._client.db(this._dbName);
        this._collection = this._db.collection(this._collectionName);
        this._archive = this._db.collection(this._archiveName);
    }

    async update<T extends AtomOp>(id: string, tree: StoredCausalTree<T>): Promise<void> {
        const wrapper: StorageWrapper<T> = {
            id: id,
            tree: tree
        };
        await this._collection.updateOne({ channel: id }, { 
            $set: wrapper
        }, {
            upsert: true
        });
    }

    async get<T extends AtomOp>(id: string): Promise<StoredCausalTree<T>> {
        const wrapper: StorageWrapper<T> = await this._collection.findOne({ id: id });
        if (wrapper) {
            return wrapper.tree;
        } else {
            return null;
        }
    }

    async archiveAtoms<T extends AtomOp>(id: string, atoms: Atom<T>[]): Promise<void> {
        await this._archive.insertMany(atoms.map(atom => <ArchivedAtom>{
            key: id,
            atom
        }));
    }
    
    async getArchive<T extends AtomOp>(id: string): Promise<Atom<T>[]> {
        const archived: ArchivedAtom[] = await this._archive.find({ key: id }).toArray();
        return archived.map(a => a.atom);
    }
}

interface StorageWrapper<T extends AtomOp> {
    id: string;
    tree: StoredCausalTree<T>;
}