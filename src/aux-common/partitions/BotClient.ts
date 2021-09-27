import { Bot, TagFilter } from '../bots';

/**
 * Defines an interface for an object that is able to act as a client to store and query bots in a remote system.
 */
export interface BotClient {
    /**
     * Adds the given bots to the given instance.
     * @param inst The instance the bots should be accociated with.
     * @param added The bots that should be added.
     */
    addBots(inst: string, added: Bot[]): Promise<void>;

    /**
     * Clears all the bots in the given instance.
     * @param inst The instance to clear.
     */
    clearBots(inst: string): Promise<void>;

    /**
     * Searches for bots matching the given tags in the given instance.
     * @param inst The instance.
     * @param tags The tags to search for.
     */
    lookupBots(inst: string, tags: TagFilter[]): Promise<Bot[]>;
}
