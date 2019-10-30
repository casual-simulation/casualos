import {
    Bot,
    UserMode,
    merge,
    parseSimulationId,
    createBot,
    DEVICE_BOT_ID,
    LOCAL_BOT_ID,
    botUpdated,
    BotTags,
    isBotTags,
    isBot,
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
import pickBy from 'lodash/pickBy';

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
            bindBotToStorage(
                this,
                storageId(this.parsedId.channel, LOCAL_BOT_ID),
                LOCAL_BOT_ID
            )
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
                [LOCAL_BOT_ID]: {
                    type: 'memory',
                    initialState: {
                        [LOCAL_BOT_ID]:
                            getStoredBot(
                                storageId(parsedId.channel, LOCAL_BOT_ID)
                            ) || createBot(LOCAL_BOT_ID),
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

    async editBot(bot: Bot | BotTags, tag: string, value: any): Promise<void> {
        const val = this.helper.botsState[bot.id].tags[tag];
        if (val === value) {
            return;
        }
        if (isBot(bot) && bot.id !== 'empty' && bot.id !== 'mod') {
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

function storageId(...parts: string[]): string {
    return parts.join('_');
}

function getStoredBot(key: string): Bot {
    const json = localStorage.getItem(key);
    if (json) {
        return JSON.parse(json);
    } else {
        return null;
    }
}

function storeBot(key: string, bot: Bot) {
    if (bot) {
        const json = JSON.stringify(bot);
        localStorage.setItem(key, json);
    } else {
        localStorage.removeItem(key);
    }
}

function bindBotToStorage(
    simulation: Simulation,
    key: string,
    id: string
): Subscription {
    const sub = new Subscription();
    sub.add(
        storedBotUpdated(key, id)
            .pipe(
                flatMap(async bot => {
                    let event = botUpdated(id, bot);

                    // Record that this event is only for updating and that local storage
                    // should be ignored
                    (<any>event).__remote = true;
                    await simulation.helper.transaction(event);
                })
            )
            .subscribe()
    );

    sub.add(
        simulation.localEvents
            .pipe(
                tap(e => {
                    if (e.type === 'update_bot') {
                        if ((<any>e).__remote) {
                            return;
                        }

                        if (e.id !== id) {
                            return;
                        }

                        // Update stored bot
                        const updatedTags = Object.keys(e.update.tags || {});
                        if (updatedTags.length > 0) {
                            updateStoredBot(key, id, e.update);
                        }
                    }
                })
            )
            .subscribe()
    );

    return sub;
}

function storedBotUpdated(key: string, id: string): Observable<Partial<Bot>> {
    return storageUpdated().pipe(
        filter(e => e.key === key),
        map(e => {
            const newBot = JSON.parse(e.newValue) || createBot(id);
            const oldBot = JSON.parse(e.oldValue) || createBot(id);
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

function updateStoredBot(key: string, id: string, update: Partial<Bot>) {
    if (!update.tags) {
        return;
    }
    const oldBot = getStoredBot(key) || createBot(id);
    const differentTags = pickBy(
        update.tags,
        (val, tag) => oldBot.tags[tag] !== val
    );

    if (Object.keys(differentTags).length <= 0) {
        return;
    }

    const merged = merge(oldBot, update);
    storeBot(key, merged);
}
