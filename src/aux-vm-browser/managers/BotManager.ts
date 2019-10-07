import {
    Bot,
    UserMode,
    isDiff,
    merge,
    parseSimulationId,
    createBot,
    DEVICE_BOT_ID,
    botUpdated,
} from '@casual-simulation/aux-common';

import {
    AuxUser,
    AuxVM,
    BaseSimulation,
    LoginManager,
    getTreeName,
    Simulation,
} from '@casual-simulation/aux-vm';
import SelectionManager from './SelectionManager';
import { RecentBotManager } from './RecentBotManager';
import { BotPanelManager } from './BotPanelManager';
import { BrowserSimulation } from './BrowserSimulation';
import { AuxVMImpl } from '../vm/AuxVMImpl';
import { ProgressManager } from '@casual-simulation/aux-vm/managers';
import { filter, flatMap, tap, map } from 'rxjs/operators';
import { ConsoleMessages } from '@casual-simulation/causal-trees';
import { Observable, fromEventPattern, Subscription } from 'rxjs';
import { AuxPartitionConfig } from '@casual-simulation/aux-vm/partitions';
import { pickBy } from 'lodash';

/**
 * Defines a class that interfaces with the AppManager and SocketManager
 * to reactively edit bots.
 */
export class BotManager extends BaseSimulation implements BrowserSimulation {
    private _selection: SelectionManager;
    private _recent: RecentBotManager;
    private _botPanel: BotPanelManager;
    private _login: LoginManager;
    private _progress: ProgressManager;

    /**
     * Gets all the selected bots that represent an object.
     */
    get selectedObjects(): Bot[] {
        return this.selection.getSelectedBotsForUser(this.helper.userBot);
    }

    /**
     * Gets the selection manager.
     */
    get selection() {
        return this._selection;
    }

    /**
     * Gets the recent bots manager.
     */
    get recent() {
        return this._recent;
    }

    /**
     * Gets the bots panel manager.
     */
    get botPanel() {
        return this._botPanel;
    }

    get login() {
        return this._login;
    }

    get progress() {
        return this._progress;
    }

    get consoleMessages() {
        return <Observable<ConsoleMessages>>(
            this._vm.connectionStateChanged.pipe(
                filter(
                    m =>
                        m.type === 'log' ||
                        m.type === 'error' ||
                        m.type === 'warn'
                )
            )
        );
    }

    constructor(
        user: AuxUser,
        id: string,
        config: { isBuilder: boolean; isPlayer: boolean }
    ) {
        super(
            id,
            config,
            createPartitions(),
            config => new AuxVMImpl(user, config)
        );
        this.helper.userId = user ? user.id : null;

        this._selection = new SelectionManager(this._helper);
        this._recent = new RecentBotManager(this._helper);
        this._login = new LoginManager(this._vm);
        this._progress = new ProgressManager(this._vm);

        this._subscriptions.push(
            bindBotToStorage(this, this.parsedId.channel, DEVICE_BOT_ID)
        );

        function createPartitions(): AuxPartitionConfig {
            const parsedId = parseSimulationId(id);
            return {
                '*': {
                    type: 'remote_causal_tree',
                    id: id,
                    host: parsedId.host,
                    treeName: getTreeName(parsedId.channel),
                },
                [DEVICE_BOT_ID]: {
                    type: 'memory',
                    initialState: {
                        [DEVICE_BOT_ID]:
                            getStoredBot(parsedId.channel, DEVICE_BOT_ID) ||
                            createBot(DEVICE_BOT_ID),
                    },
                },
            };
        }
    }

    /**
     * Sets the bot mode that the user should be in.
     * @param mode The mode that the user should use.
     */
    setUserMode(mode: UserMode) {
        return this.helper.updateBot(this.helper.userBot, {
            tags: {
                'aux._mode': mode,
            },
        });
    }

    async editBot(bot: Bot, tag: string, value: any): Promise<void> {
        const val = this.helper.botsState[bot.id].tags[tag];
        if (val === value) {
            return;
        }
        if (!isDiff(null, bot) && bot.id !== 'empty') {
            await this.recent.addTagDiff(`mod-${bot.id}_${tag}`, tag, value);
            await this.helper.updateBot(bot, {
                tags: {
                    [tag]: value,
                },
            });
        } else {
            const updated = merge(bot, {
                tags: {
                    [tag]: value,
                },
                values: {
                    [tag]: value,
                },
            });
            await this.recent.addBotDiff(updated, true);
        }
    }

    protected _initManagers() {
        super._initManagers();
        this._botPanel = new BotPanelManager(
            this._watcher,
            this._helper,
            this._selection,
            this._recent
        );
    }
}

function getStoredBot(channel: string, id: string): Bot {
    const json = localStorage.getItem(`${channel}_${id}`);
    if (json) {
        return JSON.parse(json);
    } else {
        return null;
    }
}

function storeBot(channel: string, id: string, bot: Bot) {
    if (bot) {
        const json = JSON.stringify(bot);
        localStorage.setItem(`${channel}_${id}`, json);
    } else {
        localStorage.removeItem(`${channel}_${id}`);
    }
}

function bindBotToStorage(
    simulation: Simulation,
    channel: string,
    id: string
): Subscription {
    const sub = new Subscription();
    sub.add(
        storedBotUpdated(channel, id)
            .pipe(
                flatMap(async bot => {
                    await simulation.helper.transaction(botUpdated(id, bot));
                })
            )
            .subscribe()
    );

    sub.add(
        simulation.localEvents
            .pipe(
                tap(e => {
                    if (e.type === 'update_bot') {
                        // Update stored bot
                        if (e.id === id) {
                            const updatedTags = Object.keys(
                                e.update.tags || {}
                            );
                            if (updatedTags.length > 0) {
                                updateStoredBot(channel, id, e.update);
                            }
                        }
                    }
                })
            )
            .subscribe()
    );

    return sub;
}

function storedBotUpdated(
    channel: string,
    id: string
): Observable<Partial<Bot>> {
    return storageUpdated().pipe(
        filter(e => e.url !== location.href),
        filter(e => e.key === `${channel}_${id}`),
        map(e => {
            const newBot = JSON.parse(e.newValue);
            const oldBot = JSON.parse(e.oldValue);
            const differentTags = pickBy(
                newBot.tags,
                (val, tag) => oldBot.tags[tag] !== val
            );
            return {
                tags: differentTags,
            };
        }),
        filter(bot => Object.keys(bot.tags).length > 0)
    );
}

function storageUpdated(): Observable<StorageEvent> {
    return fromEventPattern(
        h => window.addEventListener('storage', h),
        h => window.removeEventListener('storage', h)
    );
}

function updateStoredBot(channel: string, id: string, update: Partial<Bot>) {
    if (!update.tags) {
        return;
    }
    const oldBot = getStoredBot(channel, id) || createBot(id);
    const differentTags = pickBy(
        update.tags,
        (val, tag) => oldBot.tags[tag] !== val
    );

    if (Object.keys(differentTags).length <= 0) {
        return;
    }

    const merged = merge(oldBot, update);
    storeBot(channel, id, merged);
}
