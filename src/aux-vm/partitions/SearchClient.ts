import { Bot } from '@casual-simulation/aux-common';

export interface SearchClient {
    /**
     * Adds the given bots to the given universe.
     * @param universe The universe the bots should be accociated with.
     * @param added The bots that should be added.
     */
    addBots(universe: string, added: Bot[]): Promise<void>;
}
