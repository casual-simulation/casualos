import { BotStore } from '../storage/BotStore';
import { Collection, Db } from 'mongodb';
import { Bot, TagFilter } from '@casual-simulation/aux-common';
import { BotsServerConfig } from 'server/config';

/**
 * Defines a class that provides an implemention of a Bot store backed by MongoDB.
 *
 * This store has a simplistic implementation and does not handle things like indexing.
 * For most cases, it is recommended to set a Time-To-Live index to force bots to expire over time.
 */
export class MongoDBBotStore implements BotStore {
    private _database: Db;
    private _config: BotsServerConfig;

    constructor(config: BotsServerConfig, db: Db) {
        this._config = config;
        this._database = db;
    }

    async addBots(namespace: string, bots: Bot[]): Promise<void> {
        const collection = await this._getCollection(namespace);
        await collection.insertMany(bots);
    }

    async findBots(namespace: string, tags: TagFilter[]): Promise<Bot[]> {
        let query: { [key: string]: any } = {};

        for (let t of tags) {
            query[`tags.${t.tag}`] = t.value;
        }

        const collection = await this._getCollection(namespace);
        const botsCursor = collection.find(query);
        const bots = await botsCursor.toArray();

        return bots;
    }

    private async _getCollection(namespace: string) {
        const collection = this._database.collection<Bot>(namespace);

        if (this._config.timeToLive > 0) {
            await collection.createIndex(
                { expireAt: 1 },
                { expireAfterSeconds: this._config.timeToLive }
            );
        } else {
            // TODO: Support dropping the expiration index
        }

        return collection;
    }
}
