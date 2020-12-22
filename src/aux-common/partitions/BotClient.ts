import { Bot, TagFilter } from '../bots';

/**
 * Defines an interface for an object that is able to act as a client to store and query bots in a remote system.
 */
export interface BotClient {
    /**
     * Adds the given bots to the given server.
     * @param server The server the bots should be accociated with.
     * @param added The bots that should be added.
     */
    addBots(server: string, added: Bot[]): Promise<void>;

    /**
     * Clears all the bots in the given server.
     * @param server The server to clear.
     */
    clearBots(server: string): Promise<void>;

    /**
     * Searches for bots matching the given tags in the given server.
     * @param server The server.
     * @param tags The tags to search for.
     */
    lookupBots(server: string, tags: TagFilter[]): Promise<Bot[]>;
}
