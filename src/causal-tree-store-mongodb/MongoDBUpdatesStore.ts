import { UpdatesStore } from '@casual-simulation/causal-trees/core2';
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

    async getUpdates(branch: string): Promise<string[]> {
        const updates = await this._updates
            .find({
                branch: branch,
            })
            .map((d) => d.updates)
            .toArray();

        return flatMap(updates, (u) => u);
    }

    async addUpdates(branch: string, updates: string[]): Promise<void> {
        const doc: MongoDBUpdate = {
            branch,
            updates,
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
}
