import { UserMode } from '@casual-simulation/aux-common';
import { RecentFilesManager } from './RecentFilesManager';
import SelectionManager from './SelectionManager';
import { BotPanelManager } from './FilePanelManager';
import { ProgressManager } from '@casual-simulation/aux-vm';
import { RemoteSimulation } from '@casual-simulation/aux-vm-client';
import { ConsoleMessages } from '@casual-simulation/causal-trees';
import { Bot } from '@casual-simulation/aux-common';
import { Observable } from 'rxjs';

/**
 * Defines an interface for objects that represent bot simulations.
 */
export interface BrowserSimulation extends RemoteSimulation {
    /**
     * Gets the selection manager.
     */
    selection: SelectionManager;

    /**
     * Gets the recent bots manager.
     */
    recent: RecentFilesManager;

    /**
     * Gets the bots panel manager.
     */
    botPanel: BotPanelManager;

    /**
     * Gets the progress manager.
     */
    progress: ProgressManager;

    /**
     * The observable list of console messages from the simulation.
     */
    consoleMessages: Observable<ConsoleMessages>;

    /**
     * Sets the bot mode that the user should be in.
     * @param mode The mode that the user should use.
     */
    setUserMode(mode: UserMode): Promise<void>;

    /**
     * Edits the given bot and tag as if the user edited it manually.
     * This means adding the correct recent bot record in addition to actually updating the bot.
     * Diff bots are also supported.
     * @param bot The bot to update.
     * @param tag The tag to update.
     * @param value The value that the tag should be set to.
     */
    editBot(bot: Bot, tag: string, value: any): Promise<void>;
}
