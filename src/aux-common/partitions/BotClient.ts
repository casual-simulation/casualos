import { Bot, TagFilter } from '../bots';

/**
 * Defines an interface for an object that is able to act as a client to store and query bots in a remote system.
 */
export interface BotClient {
    /**
     * Adds the given bots to the given story.
     * @param story The story the bots should be accociated with.
     * @param added The bots that should be added.
     */
    addBots(story: string, added: Bot[]): Promise<void>;

    /**
     * Clears all the bots in the given story.
     * @param story The story to clear.
     */
    clearBots(story: string): Promise<void>;

    /**
     * Searches for bots matching the given tags in the given story.
     * @param story The story.
     * @param tags The tags to search for.
     */
    lookupBots(story: string, tags: TagFilter[]): Promise<Bot[]>;
}
