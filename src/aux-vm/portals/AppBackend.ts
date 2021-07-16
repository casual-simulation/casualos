import { Bot, BotAction } from '@casual-simulation/aux-common';

/**
 * Defines an interface that manages the interaction between a app's runtime and how it is displayed on screen.
 */
export interface AppBackend {
    /**
     * The ID of the app.
     */
    appId: string;

    /**
     * The ID of the bot that manages this app.
     */
    botId: string;

    /**
     * Handles the given events.
     */
    handleEvents(events: BotAction[]): void;

    /**
     * Releases any dynamic resources used by this app.
     */
    dispose(): void;
}
