import { Bot, TagFilter } from '../bots';

/**
 * Defines an interface for an object that is able to act as a client to store and query bots in a remote system.
 */
export interface BotClient {
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
    lookupBots(universe: string, tags: TagFilter[]): Promise<Bot[]>;
}
