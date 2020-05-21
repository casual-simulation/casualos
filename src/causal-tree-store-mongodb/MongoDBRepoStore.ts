import { MongoClient, Db, Collection } from 'mongodb';
import {
    CausalRepoStore,
    CausalRepoObject,
    CausalRepoBranch,
    getObjectHash,
    CausalRepoIndex,
    getAtomHashes,
} from '@casual-simulation/causal-trees/core2';

/**
 * Defines a class that is able to store a causal tree in MongoDB.
 */
export class MongoDBRepoStore implements CausalRepoStore {
    private _objects: Collection<MongoDBObject>;
    private _heads: Collection<MongoDBHead>;
    private _indexes: Collection<MongoDBIndex>;

    constructor(
        objectsCollection: Collection<MongoDBObject>,
        headsCollection: Collection<MongoDBHead>,
        indexesCollection: Collection<MongoDBIndex>
    ) {
        this._objects = objectsCollection;
        this._heads = headsCollection;
        this._indexes = indexesCollection;
    }

    async init() {
        await this._heads.createIndex({ name: 1 }, { unique: true });
    }

    async loadIndex(
        head: string,
        index: CausalRepoIndex
    ): Promise<CausalRepoObject[]> {
        let idx = await this._indexes.findOne({
            _id: index.data.hash,
        });
        if (!idx) {
            return await this.getObjects(head, getAtomHashes(index.data.atoms));
        }

        return idx.objects;
    }

    async storeIndex(
        head: string,
        index: string,
        objects: CausalRepoObject[]
    ): Promise<void> {
        const idx: MongoDBIndex = {
            _id: index,
            objects,
        };

        await this._indexes.updateOne(
            { _id: index },
            {
                $set: idx,
            },
            { upsert: true }
        );
        await this.storeObjects(head, objects);
    }

    async getObjects(
        head: string,
        keys: string[]
    ): Promise<CausalRepoObject[]> {
        const objs = await this._objects
            .find({
                _id: { $in: keys },
            })
            .sort({ 'atom.id.timestamp': 1 })
            .map(a => a.object)
            .toArray();
        return objs;
    }

    async getObject(key: string): Promise<CausalRepoObject> {
        const obj = await this._objects.findOne({
            _id: key,
        });
        if (obj) {
            return obj.object;
        } else {
            return null;
        }
    }

    /**
     * Stores the given objects.
     * @param objects The objects to store.
     */
    async storeObjects(
        head: string,
        objects: CausalRepoObject[]
    ): Promise<void> {
        const mongoObjects: MongoDBObject[] = objects.map(o => ({
            _id: getObjectHash(o),
            object: o,
        }));

        if (mongoObjects.length <= 0) {
            return;
        }

        let op = this._objects.initializeUnorderedBulkOp();
        mongoObjects.forEach(o => {
            op.find({ _id: o._id })
                .upsert()
                .updateOne(o);
        });
        await op.execute();
    }

    /**
     * Gets the list of branches that match the given prefix.
     * @param prefix The prefix that branch names should match. If null, then all branches are returned.
     */
    async getBranches(prefix: string | null): Promise<CausalRepoBranch[]> {
        if (prefix) {
            prefix = escapeRegex(prefix);
            const branches = await this._heads
                .find({
                    name: { $regex: new RegExp(`^${prefix}`) },
                })
                .sort({
                    name: 1,
                })
                .toArray();
            return branches;
        } else {
            const branches = await this._heads
                .find({})
                .sort({
                    name: 1,
                })
                .toArray();
            return branches;
        }
    }

    /**
     * Saves/updates the given head to the given repo.
     * @param head The branch to save.
     */
    async saveBranch(head: CausalRepoBranch): Promise<void> {
        await this._heads.updateOne(
            { name: head.name },
            {
                $set: head,
            },
            {
                upsert: true,
            }
        );
    }

    /**
     * Deletes the given branch from the repo.
     * @param head The branch to delete.
     */
    async deleteBranch(head: CausalRepoBranch): Promise<void> {
        await this._heads.deleteOne({
            name: head.name,
        });
    }
}

export interface MongoDBHead extends CausalRepoBranch {}
export interface MongoDBObject {
    _id: string;
    object: CausalRepoObject;
}

export interface MongoDBIndex {
    _id: string;
    objects: CausalRepoObject[];
}

export function escapeRegex(value: string): string {
    let final = value;
    for (let char of REGEX_SPECIAL_CHARACTERS) {
        final = final.replace(char, `\\${char}`);
    }
    return final;
}

export const REGEX_SPECIAL_CHARACTERS = [
    '\\',
    '^',
    '$',
    '.',
    '*',
    '+',
    '?',
    '(',
    ')',
    '[',
    ']',
    '{',
    '}',
    '|',
];
