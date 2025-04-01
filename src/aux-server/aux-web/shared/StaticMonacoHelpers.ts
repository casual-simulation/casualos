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
import type * as monaco from './MonacoLibs';
import type { Bot } from '@casual-simulation/aux-common';
import { hasPortalScript } from '@casual-simulation/aux-common';
import { Subscription } from 'rxjs';
import type { BrowserSimulation } from '@casual-simulation/aux-vm-browser';

export function setup() {}

export function getModelInfoFromUri(uri: monaco.Uri) {}

/**
 * The model that should be marked as active.
 * @param model The model.
 */
export function setActiveModel(model: monaco.editor.ITextModel) {}

/**
 * Watches the given simulation for changes and updates the corresponding models.
 * @param simulation The simulation to watch.
 */
export function watchSimulation() {}

export function watchEditor(): void {}

/**
 * Clears the currently loaded models.
 */
export function clearModels() {}

/**
 * Loads the model for the given tag.
 * @param simulation The simulation that the bot is in.
 * @param bot The bot.
 * @param tag The tag.
 */
export function loadModel() {}

/**
 * Unloads and disposes of the given model.
 * @param model The model that should be unloaded.
 */
export function unloadModel() {}

/**
 * Determines if the given model should be kept alive.
 * @param model The model to check.
 */
export function shouldKeepModelLoaded(): boolean {
    return true;
}

export function getScript(bot: Bot, tag: string, space: string) {}

export function isCustomPortalScript(
    simulation: BrowserSimulation,
    value: unknown
) {
    const prefixes = simulation.portals.scriptPrefixes.map((p) => p.prefix);
    return hasPortalScript(prefixes, value);
}

export function toSubscription(disposable: monaco.IDisposable) {
    return new Subscription(() => disposable.dispose());
}
