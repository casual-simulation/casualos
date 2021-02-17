import { ConnectableAuxVM } from '@casual-simulation/aux-vm-browser/vm/ConnectableAuxVM';
import { Simulation } from '@casual-simulation/aux-vm/managers/Simulation';
import { BaseSimulation } from '@casual-simulation/aux-vm/managers/BaseSimulation';
import { filter } from 'rxjs/operators';
import { ConsoleMessages } from '@casual-simulation/causal-trees';
import { Observable } from 'rxjs';
import { Bot, BotSpace, BotTags } from '@casual-simulation/aux-common/bots/Bot';

class CustomPortalSimulation extends BaseSimulation implements Simulation {
    get consoleMessages() {
        return <Observable<ConsoleMessages>>(
            this._vm.connectionStateChanged.pipe(
                filter(
                    (m) =>
                        m.type === 'log' ||
                        m.type === 'error' ||
                        m.type === 'warn'
                )
            )
        );
    }

    constructor(id: string, port: MessagePort) {
        super(id, null, null, () => new ConnectableAuxVM(id, port));
    }
}

const port: MessagePort = (globalThis as any).__injectedPorts?.casualos;

const simulation = port
    ? new CustomPortalSimulation('custom-portal', port)
    : null;

simulation.init();

/**
 * Creates a bot with the given tags in the given space.
 * Returns a promise that resolves with the new bot.
 * @param tags The tags that the new bot should have.
 * @param space The space that the new bot should be in. If not specified, then the shared space will be used.
 */
export async function createBot(tags: BotTags, space?: BotSpace): Promise<Bot> {
    const id = await simulation.helper.createBot(
        undefined,
        tags,
        undefined,
        space
    );
    return simulation.helper.botsState[id];
}

/**
 * An observable that is triggered when a bot is added to the local simulation.
 * On subscription all the currently available bots will be sent.
 */
export const onBotsDiscovered = simulation.watcher.botsDiscovered;

/**
 * An observable that is triggered when a bot is updated in the local simulation.
 */
export const onBotsUpdated = simulation.watcher.botsUpdated;

/**
 * An observable that is triggered when a bot is removed from the local simulation.
 */
export const onBotsRemoved = simulation.watcher.botsRemoved;

/**
 * Updates the given bot with the given value.
 * Returns a promise that resolves when the bot has been updated.
 * @param bot The bot that should be updated.
 * @param newData The data that should be changed in the bot.
 */
export async function updateBot(
    bot: Bot,
    newData: Partial<Bot>
): Promise<void> {
    await simulation.helper.updateBot(bot, newData);
}

/**
 * Destroys the given bot.
 * Returns a promise that resolves with true if the bot was destroyed and false if not.
 * @param bot The bot that should be destroyed.
 */
export async function destroyBot(bot: Bot): Promise<boolean> {
    return await simulation.helper.destroyBot(bot);
}

export { simulation };
