import { Bot, TagFilter } from '@casual-simulation/aux-common';

/**
 * Defines an interface for an object that is able to store and retrieve
 * entire bots.
 */
export interface BotStore {
    /**
     * Adds the given bots to the given namespace.
     * @param namespace The namespace.
     * @param bots The bots.
     */
    addBots(namespace: string, bots: Bot[]): Promise<void>;

    /**
     * Finds the bots with the given tags.
     * @param namespace The namespace that the bots are stored in.
     * @param tags The tags that the bots should have.
     */
    findBots(namespace: string, tags: TagFilter[]): Promise<Bot[]>;
}
