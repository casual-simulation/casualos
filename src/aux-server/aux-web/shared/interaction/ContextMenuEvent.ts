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
import type { Vector2 } from '@casual-simulation/three';

/**
 * Defines an interface that represents the action of showing/hiding a context menu.
 */
export interface ContextMenuEvent {
    /**
     * Position on the page that the context menu should be placed.
     */
    pagePos: Vector2;

    /**
     * The actions that the context menu should show.
     */
    actions: ContextMenuAction[];
}

/**
 * Defines an interface that represents a single action in a context menu.
 */
export interface ContextMenuAction {
    /**
     * The label for the action.
     */
    label: string;

    /**
     * The function that should be trigered when the action is selected.
     */
    onClick: () => void;
}
