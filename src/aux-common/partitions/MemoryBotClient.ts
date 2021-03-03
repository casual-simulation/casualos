import { BotClient } from './BotClient';
import { Bot, BotsState, TagFilter } from '../bots';
import { values } from 'lodash';

export class MemoryBotClient implements BotClient {
    servers: {
        [server: string]: BotsState;
    } = {};

    async addBots(server: string, added: Bot[]): Promise<void> {
        let uni = this.servers[server];
        if (!uni) {
            uni = this.servers[server] = {};
        }

        for (let bot of added) {
            uni[bot.id] = bot;
        }
    }

    async clearBots(server: string) {
        this.servers[server] = {};
    }

    async lookupBots(server: string, tags: TagFilter[]): Promise<Bot[]> {
        let uni = this.servers[server];
        if (!uni) {
            return [];
        }

        return values(uni).filter((b) =>
            tags.every((t) => b.tags[t.tag] === t.value)
        );
    }
}
