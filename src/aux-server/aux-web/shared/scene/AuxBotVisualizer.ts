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
import type {
    BotCalculationContext,
    Bot,
    LocalActions,
} from '@casual-simulation/aux-common';
import type { DimensionGroup } from './DimensionGroup';

/**
 * Defines an interface for a visualizer for a bot.
 */
export interface AuxBotVisualizer {
    /**
     * The bot used by this visualizer.
     */
    bot: Bot;

    /**
     * The dimension group that this visualization belongs to.
     */
    dimensionGroup: DimensionGroup;

    /**
     * Indicates to the visualizer that the bot was updated.
     * @param bot The bot.
     * @param tags The tags that changed.
     * @param calc The calculation context.
     */
    botUpdated(bot: Bot, tags: Set<string>, calc: BotCalculationContext): void;

    /**
     * Updates the visualizer for the frame.
     * @param calc The calculation context.
     */
    frameUpdate(calc: BotCalculationContext): void;

    /**
     * Handles the given local event.
     * @param event The event.
     * @param calc The calculation context.
     */
    localEvent(event: LocalActions, calc: BotCalculationContext): void;

    /**
     * Disposes of all the resources this bot uses.
     */
    dispose(): void;
}
