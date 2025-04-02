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
import type { AuxBotVisualizer } from './scene/AuxBotVisualizer';

/**
 * Defines an interface for objects that can find AuxBot3D instances.
 */
export interface AuxBotVisualizerFinder {
    /**
     * Finds the list of bot visualizers for the given bot ID.
     * First tries to match bots that have an exact match to the given ID.
     * If no bots are found, then it will search again but this time searching for bots
     * that have IDs that start with the given ID.
     * @param id The ID of the bot to find.
     */
    findBotsById(id: string): AuxBotVisualizer[];
}
