import { BotClient } from './BotClient';
import { Bot, BotsState, TagFilter } from '../bots';
import values from 'lodash/values';

export class MemoryBotClient implements BotClient {
    universes: {
        [universe: string]: BotsState;
    } = {};

    async addBots(universe: string, added: Bot[]): Promise<void> {
        let uni = this.universes[universe];
        if (!uni) {
            uni = this.universes[universe] = {};
        }

        for (let bot of added) {
            uni[bot.id] = bot;
        }
    }

    async lookupBots(universe: string, tags: TagFilter[]): Promise<Bot[]> {
        let uni = this.universes[universe];
        if (!uni) {
            return [];
        }

        return values(uni).filter(b =>
            tags.every(t => b.tags[t.tag] === t.value)
        );
    }
}
