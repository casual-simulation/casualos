import { SearchClient } from './SearchClient';
import { Bot, BotsState } from '@casual-simulation/aux-common';

export class MemorySearchClient implements SearchClient {
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
}
