/* CasualOS is a set of web-based tools designed to facilitate the creation of real-time, multi-user, context-aware interactive experiences.
 *
 * Copyright (c) 2019-2025 Casual Simulation, Inc.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */
import type { BotPanelManager } from './BotPanelManager';
import type {
    ProgressManager,
    RecordsManager,
} from '@casual-simulation/aux-vm';
import type { RemoteSimulation } from '@casual-simulation/aux-vm-client';
import type { ConsoleMessages } from '@casual-simulation/aux-common';
import type { Bot } from '@casual-simulation/aux-common';
import type { Observable } from 'rxjs';
import type { IdePortalManager } from './IdePortalManager';
import type { AuthHelper } from './AuthHelper';
import type { LivekitManager } from './LivekitManager';

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
     * Gets the records manager.
     */
    records: RecordsManager;

    /**
     * Gets the Livekit manager.
     */
    livekit: LivekitManager;

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
