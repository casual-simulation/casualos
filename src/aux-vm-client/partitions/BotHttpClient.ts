import { BotClient } from '@casual-simulation/aux-vm';
import { Bot, TagFilter } from '@casual-simulation/aux-common';
import axios from 'axios';

export class BotHttpClient implements BotClient {
    host: string;

    constructor(host: string) {
        this.host = host;
    }

    async addBots(universe: string, added: Bot[]): Promise<void> {
        const request = {
            namespace: universe,
            bots: added,
        };
        try {
            const response = await axios.post(
                `${this.host}/api/bots/upload`,
                request
            );
        } catch (err) {
            console.error('[BotHttpClient] Unable to upload bots:', err);
        }
    }

    async lookupBots(universe: string, tags: TagFilter[]): Promise<Bot[]> {
        const request = {
            namespace: universe,
            tags: tags,
        };

        try {
            const response = await axios.post(`${this.host}/api/bots`, request);

            return response.data;
        } catch (err) {
            console.error('[BotHttpClient] Unable to lookup bots:', err);
        }
    }
}
