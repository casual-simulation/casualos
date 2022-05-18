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
    AuxPartitionConfig,
    ADMIN_PARTITION_ID,
    ADMIN_BRANCH_NAME,
    TEMPORARY_SHARED_PARTITION_ID,
    REMOTE_TEMPORARY_SHARED_PARTITION_ID,
    BOOTSTRAP_PARTITION_ID,
    getTagValueForSpace,
    getUpdateForTagAndSpace,
} from '@casual-simulation/aux-common';

import {
    AuxUser,
    AuxVM,
    BaseSimulation,
    LoginManager,
    getTreeName,
    Simulation,
    AuxConfig,
    RecordsManager,
} from '@casual-simulation/aux-vm';
import {
    BotPanelManager,
    BrowserSimulation,
    AuxVMImpl,
    LocalStoragePartitionImpl,
    IdePortalManager,
    AuthHelper,
    SystemPortalManager,
} from '@casual-simulation/aux-vm-browser';
import { PortalManager, ProgressManager } from '@casual-simulation/aux-vm';
import { filter, tap } from 'rxjs/operators';
import { ConsoleMessages } from '@casual-simulation/causal-trees';
import { Observable, fromEventPattern, Subscription } from 'rxjs';
import { getFinalUrl } from '@casual-simulation/aux-vm-client';
import { getBotsStateFromStoredAux } from '@casual-simulation/aux-vm/StoredAux';
import { AuthHelperInterface } from '@casual-simulation/aux-vm/managers';

/**
 * Defines a class that interfaces with the AppManager and SocketManager
 * to reactively edit bots.
 */
export class PlaywrightSimulation
    extends BaseSimulation
    implements BrowserSimulation
{
    private _botPanel: BotPanelManager;
    private _login: LoginManager;
    private _progress: ProgressManager;
    private _portals: PortalManager;
    private _idePortal: IdePortalManager;
    private _systemPortal: SystemPortalManager;
    private _authHelper: AuthHelper;
    private _recordsManager: RecordsManager;

    /**
     * Gets the bots panel manager.
     */
    get botPanel() {
        return this._botPanel;
    }

    get idePortal() {
        return this._idePortal;
    }

    get systemPortal() {
        return this._systemPortal;
    }

    get login() {
        return this._login;
    }

    get progress() {
        return this._progress;
    }

    get auth() {
        return this._authHelper;
    }

    get records() {
        return this._recordsManager;
    }

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

    get portals() {
        return this._portals;
    }

    constructor(
        user: AuxUser,
        id: string,
        config: AuxConfig['config'],
        defaultHost: string = location.origin,
        createVm: (user: AuxUser, config: AuxConfig) => AuxVM = (
            user: AuxUser,
            config: AuxConfig
        ) => new AuxVMImpl(user, config)
    ) {
        super(id, config, createPartitions(), (config) =>
            createVm(user, config)
        );
        this.helper.userId = user ? user.id : null;

        this._authHelper = new AuthHelper(
            config.authOrigin,
            config.recordsOrigin
        );
        this._login = new LoginManager(this._vm);
        this._progress = new ProgressManager(this._vm);

        function createPartitions(): AuxPartitionConfig {
            const parsedId = parseSimulationId(id);

            let partitions: AuxPartitionConfig = {
                // Use a memory partition instead of a shared partition
                // when collaboration is disabled.
                shared: {
                    type: 'memory',
                    initialState: {},
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
                    initialState: {
                        [user.id]: createBot(user.id, {
                            inst: id,
                        }),
                    },
                },
                [TEMPORARY_SHARED_PARTITION_ID]: {
                    type: 'memory',
                    initialState: {},
                },
                [REMOTE_TEMPORARY_SHARED_PARTITION_ID]: null,
                [BOOTSTRAP_PARTITION_ID]: {
                    type: 'memory',
                    initialState: {},
                    private: true,
                },
            };

            return partitions;
        }
    }

    async init() {
        const getInitialState =
            typeof (window as any)._getInitialBotStateHook === 'function'
                ? (window as any)._getInitialBotStateHook
                : null;
        if (getInitialState) {
            console.log('[PlaywrightSimulation] Getting initial state...');
        }
        const initialState = getInitialState ? await getInitialState() : null;

        if (!initialState) {
            console.log('[PlaywrightSimulation] No initial state found!');
        }

        (this._vm as any)._config.partitions = {
            ...(this._vm as any)._config.partitions,
            shared: {
                type: 'memory',
                initialState: initialState?.['shared'] ?? {},
            },
            [TEMPORARY_SHARED_PARTITION_ID]: {
                type: 'memory',
                initialState:
                    initialState?.[TEMPORARY_SHARED_PARTITION_ID] ?? {},
            },
        };

        (this._vm as any)._config.config.timesync = null;

        return await super.init();
    }

    async editBot(
        bot: Bot | BotTags,
        tag: string,
        value: any,
        space: string = null
    ): Promise<void> {
        const val = getTagValueForSpace(
            this.helper.botsState[bot.id],
            tag,
            space
        );
        if (val === value) {
            return;
        }
        if (isBot(bot) && bot.id !== 'empty' && bot.id !== 'mod') {
            await this.helper.updateBot(
                bot,
                getUpdateForTagAndSpace(tag, value, space)
            );
        }
    }

    protected _beforeVmInit() {
        super._beforeVmInit();
        this._portals = new PortalManager(this._vm);
        this._botPanel = new BotPanelManager(this._watcher, this._helper);
        this._idePortal = new IdePortalManager(this._watcher, this.helper);
        this._systemPortal = new SystemPortalManager(
            this._watcher,
            this.helper
        );
        this._recordsManager = new RecordsManager(
            this._config,
            this._helper,
            (endpoint) => this._getAuthEndpointHelper(endpoint)
        );

        this._subscriptions.push(this._portals);
        this._subscriptions.push(this._botPanel);
        this._subscriptions.push(this._idePortal);
        this._subscriptions.push(this._systemPortal);
        this._subscriptions.push(
            this._vm.localEvents
                .pipe(tap((e) => this._recordsManager.handleEvents(e)))
                .subscribe()
        );
    }

    private _getAuthEndpointHelper(endpoint: string): AuthHelperInterface {
        if (!endpoint) {
            return null;
        }
        if (endpoint === this._config.authOrigin) {
            return this._authHelper.primary;
        } else {
            const helper = this._authHelper.createEndpoint(endpoint);
            this._subscriptions.push(helper);
            return helper;
        }
    }
}
