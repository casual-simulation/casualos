import { Bot } from '@casual-simulation/aux-common';

export interface SearchClient {
    /**
     * Adds the given bots to the given universe.
     * @param universe The universe the bots should be accociated with.
     * @param added The bots that should be added.
     */
    addBots(universe: string, added: Bot[]): Promise<void>;

    /**
     * Searches for bots matching the given tags in the given universe.
     * @param universe The universe.
     * @param tags The tags to search for.
     */
    lookupBots(universe: string, tags: TagSearch[]): Promise<Bot[]>;
}

export interface TagSearch {
    tag: string;
    value?: any;
}
