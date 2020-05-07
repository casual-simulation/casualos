import { MongoClient, Db, Collection } from 'mongodb';
import {
    CausalRepoStore,
    CausalRepoObject,
    CausalRepoBranch,
    getObjectHash,
} from '@casual-simulation/causal-trees/core2';

/**
 * Defines a class that is able to store a causal tree in MongoDB.
 */
export class MongoDBRepoStore implements CausalRepoStore {
    private _objects: Collection<MongoDBObject>;
    private _heads: Collection<MongoDBHead>;

    constructor(
        objectsCollection: Collection<MongoDBObject>,
        headsCollection: Collection<MongoDBHead>
    ) {
        this._objects = objectsCollection;
        this._heads = headsCollection;
    }

    async init() {
        await this._heads.createIndex({ name: 1 }, { unique: true });
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
