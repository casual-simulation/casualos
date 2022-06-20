import {
    StoredUpdates,
    UpdatesStore,
} from '@casual-simulation/causal-trees/core2';
import { flatMap } from 'lodash';
import { Collection } from 'mongodb';

/**
 * Defines a class that is able to store updates for a branch in a MongoDB collection.
 */
export class MongoDBUpdatesStore implements UpdatesStore {
    private _updates: Collection<MongoDBUpdate>;

    constructor(updates: Collection<MongoDBUpdate>) {
        this._updates = updates;
    }

    async init() {
        await this._updates.createIndex({ branch: 1 });
    }

    async getUpdates(branch: string): Promise<StoredUpdates> {
        const updates = await this._updates
            .find({
                branch: branch,
            })
            .toArray();

        const timestamps = flatMap(updates, (u) => u.timestamps ?? []);
        return {
            updates: flatMap(updates, (u) => u.updates),
            timestamps: timestamps.length > 0 ? timestamps : null,
        };
    }

    async addUpdates(branch: string, updates: string[]): Promise<void> {
        const doc: MongoDBUpdate = {
            branch,
            updates,
            timestamps: updates.map((u) => Date.now()),
        };

        await this._updates.insertOne(doc);
    }

    async clearUpdates(branch: string): Promise<void> {
        await this._updates.deleteMany({
            branch,
        });
    }
}

export interface MongoDBUpdate {
    branch: string;
    updates: string[];
    timestamps?: number[];
}
