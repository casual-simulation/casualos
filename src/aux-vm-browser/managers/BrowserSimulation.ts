import { BotPanelManager } from './BotPanelManager';
import { ProgressManager } from '@casual-simulation/aux-vm';
import { RemoteSimulation } from '@casual-simulation/aux-vm-client';
import { ConsoleMessages } from '@casual-simulation/causal-trees';
import { Bot } from '@casual-simulation/aux-common';
import { Observable } from 'rxjs';
import { IdePortalManager } from './IdePortalManager';
import { AuthHelper } from './AuthHelper';

/**
 * Defines an interface for objects that represent bot simulations.
 */
export interface BrowserSimulation extends RemoteSimulation {
    /**
     * Gets the bots panel manager.
     */
    botPanel: BotPanelManager;

    /**
     * Gets the IDE portal manager.
     */
    idePortal: IdePortalManager;

    /**
     * Gets the progress manager.
     */
    progress: ProgressManager;

    /**
     * Gets the authentication helper.
     */
    auth: AuthHelper;

    /**
     * The observable list of console messages from the simulation.
     */
    consoleMessages: Observable<ConsoleMessages>;

    /**
     * Edits the given bot and tag as if the user edited it manually.
     * This means adding the correct recent bot record in addition to actually updating the bot.
     * Diff bots are also supported.
     * @param bot The bot to update.
     * @param tag The tag to update.
     * @param value The value that the tag should be set to.
     * @param space The space that the tag should be set in. If specified, then the tag mask in the given space will be set to the given value.
     */
    editBot(bot: Bot, tag: string, value: any, space?: string): Promise<void>;
}
