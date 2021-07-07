import { Bot, BotAction } from '@casual-simulation/aux-common';

/**
 * Defines an interface that manages the interaction between a portal's runtime and how it is displayed on screen.
 */
export interface PortalBackend {
    /**
     * The ID of the portal.
     */
    portalId: string;

    /**
     * The ID of the bot that manages this portal.
     */
    botId: string;

    /**
     * Handles the given events.
     */
    handleEvents(events: BotAction[]): void;

    /**
     * Releases any dynamic resources used by this portal.
     */
    dispose(): void;
}
