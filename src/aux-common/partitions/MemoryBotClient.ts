import { BotClient } from './BotClient';
import { Bot, BotsState, TagFilter } from '../bots';
import values from 'lodash/values';

export class MemoryBotClient implements BotClient {
    stories: {
        [story: string]: BotsState;
    } = {};

    async addBots(story: string, added: Bot[]): Promise<void> {
        let uni = this.stories[story];
        if (!uni) {
            uni = this.stories[story] = {};
        }

        for (let bot of added) {
            uni[bot.id] = bot;
        }
    }

    async clearBots(story: string) {
        this.stories[story] = {};
    }

    async lookupBots(story: string, tags: TagFilter[]): Promise<Bot[]> {
        let uni = this.stories[story];
        if (!uni) {
            return [];
        }

        return values(uni).filter(b =>
            tags.every(t => b.tags[t.tag] === t.value)
        );
    }
}
