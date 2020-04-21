import {
    Bot,
    merge,
    parseSimulationId,
    createBot,
    DEVICE_BOT_ID,
    LOCAL_BOT_ID,
    botUpdated,
    TEMPORARY_BOT_PARTITION_ID,
    COOKIE_BOT_PARTITION_ID,
    COOKIE_BOT_ID,
    BotTags,
    isBotTags,
    isBot,
    ERROR_BOT_PARTITION_ID,
    AuxPartitionConfig,
} from '@casual-simulation/aux-common';

import {
    AuxUser,
    AuxVM,
    BaseSimulation,
    LoginManager,
    getTreeName,
    Simulation,
    AuxConfig,
} from '@casual-simulation/aux-vm';
import { BotPanelManager } from './BotPanelManager';
import { BrowserSimulation } from './BrowserSimulation';
import { AuxVMImpl } from '../vm/AuxVMImpl';
import { ProgressManager } from '@casual-simulation/aux-vm/managers';
import { filter, flatMap, tap, map } from 'rxjs/operators';
import { ConsoleMessages } from '@casual-simulation/causal-trees';
import { Observable, fromEventPattern, Subscription } from 'rxjs';
import pickBy from 'lodash/pickBy';
import { getFinalUrl } from '@casual-simulation/aux-vm-client';
import { LocalStoragePartitionImpl } from '../partitions/LocalStoragePartition';

/**
 * Defines a class that interfaces with the AppManager and SocketManager
 * to reactively edit bots.
 */
export class BotManager extends BaseSimulation implements BrowserSimulation {
    private _botPanel: BotPanelManager;
    private _login: LoginManager;
    private _progress: ProgressManager;

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
        config: AuxConfig['config'],
        defaultHost: string = location.origin
    ) {
        super(
            id,
            config,
            createPartitions(),
            config => new AuxVMImpl(user, config)
        );
        this.helper.userId = user ? user.id : null;

        this._login = new LoginManager(this._vm);
        this._progress = new ProgressManager(this._vm);

        function createPartitions(): AuxPartitionConfig {
            const parsedId = parseSimulationId(id);
            const host = getFinalUrl(defaultHost, parsedId.host);
            return {
                shared: {
                    type: 'remote_causal_repo',
                    branch: parsedId.channel,
                    host: host,
                },
                [COOKIE_BOT_PARTITION_ID]: {
                    type: 'proxy',
                    partition: new LocalStoragePartitionImpl({
                        type: 'local_storage',
                        namespace: `aux/${parsedId.channel}`,
                        private: true,
                    }),
                },
                [TEMPORARY_BOT_PARTITION_ID]: {
                    type: 'memory',
                    private: true,
                    initialState: {},
                },
                [ERROR_BOT_PARTITION_ID]: {
                    type: 'bot',
                    host: host,
                    universe: parsedId.channel,
                },
            };
        }
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
        }
    }

    protected _initManagers() {
        super._initManagers();
        this._botPanel = new BotPanelManager(this._watcher, this._helper);
    }
}
