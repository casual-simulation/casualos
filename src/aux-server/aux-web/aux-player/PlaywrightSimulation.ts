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
    BotAction,
    ConnectionIndicator,
    getConnectionId,
} from '@casual-simulation/aux-common';

import {
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
    LivekitManager,
} from '@casual-simulation/aux-vm-browser';
import { PortalManager, ProgressManager } from '@casual-simulation/aux-vm';
import { filter, tap } from 'rxjs/operators';
import { ConsoleMessages } from '@casual-simulation/aux-common';
import { Observable, fromEventPattern, Subscription } from 'rxjs';
import { getFinalUrl } from '@casual-simulation/aux-vm-client';
import {
    AuthHelperInterface,
    SimulationOrigin,
} from '@casual-simulation/aux-vm/managers';

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
    private _authHelper: AuthHelper;
    private _recordsManager: RecordsManager;
    private _livekitManager: LivekitManager;
    private _config: AuxConfig['config'];
    private _origin: SimulationOrigin;

    get origin() {
        return this._origin;
    }

    get inst() {
        return this._origin.inst ?? this.id;
    }

    get recordName() {
        return this._origin.recordName;
    }

    /**
     * Gets the bots panel manager.
     */
    get botPanel() {
        return this._botPanel;
    }

    get idePortal() {
        return this._idePortal;
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

    get livekit() {
        return this._livekitManager;
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

    static createPartitions(
        id: string,
        indicator: ConnectionIndicator
    ): AuxPartitionConfig {
        const parsedId = parseSimulationId(id);
        const connectionId = getConnectionId(indicator);

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
                    [connectionId]: createBot(connectionId, {
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

    constructor(
        origin: SimulationOrigin,
        config: AuxConfig['config'],
        vm: AuxVM
    ) {
        super(vm);
        this._origin = origin;
        this._config = config;
        this._authHelper = new AuthHelper(
            config.authOrigin,
            config.recordsOrigin
        );
        this._login = new LoginManager(this._vm);
        this._progress = new ProgressManager(this._vm);
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
        this._recordsManager = new RecordsManager(
            this._config,
            this._helper,
            (endpoint) => this._getAuthEndpointHelper(endpoint)
        );
        this._livekitManager = new LivekitManager(this._helper);

        this._subscriptions.push(this._portals);
        this._subscriptions.push(this._botPanel);
        this._subscriptions.push(this._idePortal);
        this._subscriptions.push(
            this._vm.localEvents
                .pipe(
                    tap((e) =>
                        this._recordsManager.handleEvents(e as BotAction[])
                    )
                )
                .subscribe()
        );
        this._subscriptions.push(
            this._livekitManager,
            this._recordsManager.onRoomJoin.subscribe((join) =>
                this._livekitManager.joinRoom(join)
            ),
            this._recordsManager.onRoomLeave.subscribe((leave) =>
                this._livekitManager.leaveRoom(leave)
            ),
            this._recordsManager.onSetRoomOptions.subscribe((set) =>
                this._livekitManager.setRoomOptions(set)
            ),
            this._recordsManager.onGetRoomOptions.subscribe((set) =>
                this._livekitManager.getRoomOptions(set)
            ),
            this._vm.localEvents
                .pipe(
                    tap((e) =>
                        this._livekitManager.handleEvents(e as BotAction[])
                    )
                )
                .subscribe()
        );
    }

    protected _createSubSimulation(vm: AuxVM) {
        const sim = new PlaywrightSimulation(
            {
                recordName: null,
                inst: null,
                isStatic: this.origin.isStatic,
            },
            {
                version: this._config.version,
                versionHash: this._config.versionHash,
            },
            vm
        );
        sim._isSubSimulation = true;
        return sim;
    }

    private _getAuthEndpointHelper(endpoint: string): AuthHelperInterface {
        if (!endpoint) {
            return null;
        }
        if (endpoint === this._config.authOrigin) {
            return this._authHelper.primary;
        } else {
            const helper = this._authHelper.getOrCreateEndpoint(endpoint);
            this._subscriptions.push(helper);
            return helper;
        }
    }
}
