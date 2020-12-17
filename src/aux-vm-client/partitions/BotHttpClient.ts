import { Bot, TagFilter, BotClient } from '@casual-simulation/aux-common';
import axios from 'axios';

export class BotHttpClient implements BotClient {
    host: string;

    constructor(host: string) {
        this.host = host;
    }

    async addBots(server: string, added: Bot[]): Promise<void> {
        const request = {
            namespace: server,
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

    async clearBots(server: string): Promise<void> {
        const request = {
            namespace: server,
        };
        try {
            const response = await axios.post(
                `${this.host}/api/bots/clear`,
                request
            );
        } catch (err) {
            console.error('[BotHttpClient] Unable to clear bots:', err);
        }
    }

    async lookupBots(server: string, tags: TagFilter[]): Promise<Bot[]> {
        const request = {
            namespace: server,
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
