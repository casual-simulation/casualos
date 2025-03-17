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
