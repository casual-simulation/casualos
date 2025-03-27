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
import type { BotCursorType } from '@casual-simulation/aux-common';
import type Vue from 'vue';
import type { Game } from '../scene/Game';

/**
 * Interface that described what properties and functions should be available to a GameView class/component implementation.
 * Concept of a GameView is shared across aux-web applications. This interface will ensure shared functionality across these applications.
 */
export interface IGameView extends Vue {
    _game: Game;

    readonly gameView: HTMLElement;
    readonly container: HTMLElement;
    readonly dev: boolean;
    readonly gameBackground: HTMLElement;

    calculateContainerSize(): { width: number; height: number };
    resize(): void;

    /**
     * Sets the cursor that should be used for the game view.
     */
    setCursor(cursor: BotCursorType): void;
}
