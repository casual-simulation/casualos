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
    getBotsStateFromStoredAux,
    BotActions,
    BotAction,
    ConnectionIndicator,
    getConnectionId,
    DEFAULT_BRANCH_NAME,
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
import { BotPanelManager } from './BotPanelManager';
import { BrowserSimulation } from './BrowserSimulation';
import { AuxVMImpl } from '../vm/AuxVMImpl';
import { PortalManager, ProgressManager } from '@casual-simulation/aux-vm';
import { filter, tap, map } from 'rxjs/operators';
import { ConsoleMessages } from '@casual-simulation/aux-common';
import { Observable, fromEventPattern, Subscription } from 'rxjs';
import { getFinalUrl } from '@casual-simulation/aux-vm-client';
import { LocalStoragePartitionImpl } from '../partitions/LocalStoragePartition';
import { IdePortalManager } from './IdePortalManager';
import { AuthHelper } from './AuthHelper';
import {
    AuthHelperInterface,
    SimulationOrigin,
} from '@casual-simulation/aux-vm/managers';
import { LivekitManager } from './LivekitManager';
import { SocketManager as WebSocketManager } from '@casual-simulation/websocket';
import { ApiGatewayWebsocketConnectionClient } from '@casual-simulation/aux-websocket-aws';
import { WebsocketConnectionClient } from '@casual-simulation/aux-websocket';

/**
 * Defines a class that interfaces with the AppManager and SocketManager
 * to reactively edit bots.
 */
export class BotManager extends BaseSimulation implements BrowserSimulation {
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

    /**
     * Gets the bots panel manager.
     */
    get botPanel() {
        return this._botPanel;
    }

    get origin() {
        return this._origin;
    }

    get inst() {
        return this._origin.inst ?? this.id;
    }

    get recordName() {
        return this._origin.recordName;
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

    static createDefaultPartitions(
        id: string,
        configBotId: string,
        origin: SimulationOrigin,
        config: AuxConfig['config']
    ): Partial<AuxPartitionConfig> {
        const defaultPartitions: Partial<AuxPartitionConfig> = {
            [TEMPORARY_BOT_PARTITION_ID]: {
                type: 'memory',
                private: true,
                initialState: {
                    [configBotId]: createBot(configBotId, {
                        inst: origin.inst ?? id,
                    }),
                },
            },
            [COOKIE_BOT_PARTITION_ID]: {
                type: 'proxy',
                partition: new LocalStoragePartitionImpl({
                    type: 'local_storage',
                    namespace: !origin.recordName
                        ? `aux/${origin.inst}`
                        : `aux/${origin.recordName}/${origin.inst}`,
                    private: true,
                }),
            },
            [BOOTSTRAP_PARTITION_ID]: {
                type: 'memory',
                initialState: config.bootstrapState
                    ? getBotsStateFromStoredAux(config.bootstrapState)
                    : {},
                private: true,
            },
        };

        return defaultPartitions;
    }

    static createPartitions(
        id: string,
        configBotId: string,
        origin: SimulationOrigin,
        config: AuxConfig['config'],
        defaultHost: string = location.origin
    ): AuxPartitionConfig {
        const host = origin.host ?? defaultHost;
        const protocol = config.causalRepoConnectionProtocol;
        const versions = config.sharedPartitionsVersion;
        const localPersistence =
            config.collaborativeRepLocalPersistence ?? false;

        console.log('[BotManager] Using v2 shared partitions');
        if (localPersistence) {
            console.log('[BotManager] Enabling local persistence.');
        }

        const defaultPartitions = BotManager.createDefaultPartitions(
            id,
            configBotId,
            origin,
            config
        );

        const partitions: AuxPartitionConfig = {
            shared: {
                type: 'remote_yjs',
                recordName: origin.recordName,
                inst: origin.inst,
                branch: DEFAULT_BRANCH_NAME,
                host: host,
                connectionProtocol: protocol,
                localPersistence: localPersistence
                    ? {
                          saveToIndexedDb: true,
                      }
                    : null,
            },

            [TEMPORARY_SHARED_PARTITION_ID]: {
                type: 'remote_yjs',
                recordName: origin.recordName,
                inst: origin.inst,
                branch: `${DEFAULT_BRANCH_NAME}-player-${configBotId}`,
                host: host,
                connectionProtocol: protocol,
                temporary: true,
                remoteEvents: false,
            },
            [REMOTE_TEMPORARY_SHARED_PARTITION_ID]: {
                type: 'other_players_repo',
                recordName: origin.recordName,
                inst: origin.inst,
                branch: DEFAULT_BRANCH_NAME,
                host: host,
                connectionProtocol: protocol,
                childPartitionType: 'yjs_client',
            },
        };

        const finalPartitions = Object.assign(
            {},
            defaultPartitions,
            partitions
        );
        return finalPartitions;
    }

    static createStaticPartitions(
        id: string,
        configBotId: string,
        origin: SimulationOrigin,
        config: AuxConfig['config']
    ): AuxPartitionConfig {
        const localPersistence = config.staticRepoLocalPersistence ?? true;
        console.log('[BotManager] Using static partitions');

        if (localPersistence) {
            console.log('[BotManager] Enabling local persistence.');
        }

        const defaultPartitions = BotManager.createDefaultPartitions(
            id,
            configBotId,
            origin,
            config
        );

        let partitions: AuxPartitionConfig = {
            shared: {
                type: 'memory',
                initialState: {},
            },
            [TEMPORARY_SHARED_PARTITION_ID]: {
                type: 'memory',
                initialState: {},
            },
            [REMOTE_TEMPORARY_SHARED_PARTITION_ID]: null,
        };

        if (localPersistence) {
            partitions.shared = {
                type: 'yjs',
                remoteEvents: true,
                localPersistence: {
                    saveToIndexedDb: true,
                    database: `${origin.recordName ?? ''}/${
                        origin.inst
                    }/${DEFAULT_BRANCH_NAME}`,
                },
                connectionId: configBotId,
            };
        }

        const finalPartitions = Object.assign(
            {},
            defaultPartitions,
            partitions
        );
        return finalPartitions;
    }

    constructor(
        origin: SimulationOrigin,
        config: AuxConfig['config'],
        vm: AuxVM,
        auth?: AuthHelper
    ) {
        super(vm);
        this._origin = origin;
        this._config = config;
        this._authHelper =
            auth ??
            new AuthHelper(
                config.authOrigin,
                config.recordsOrigin,
                undefined,
                config.requirePrivoLogin
            );
        this._login = new LoginManager(this._vm);
        this._progress = new ProgressManager(this._vm);
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
            (endpoint) => this._getAuthEndpointHelper(endpoint),
            undefined,
            (endpoint, protocol) => {
                if (protocol === 'apiary-aws') {
                    const url = new URL(endpoint);
                    if (url.protocol === 'http:') {
                        url.protocol = 'ws:';
                    } else if (url.protocol === 'https:') {
                        url.protocol = 'wss:';
                    }
                    const manager = new WebSocketManager(url);
                    manager.init();
                    return new ApiGatewayWebsocketConnectionClient(
                        manager.socket
                    );
                } else {
                    const url = new URL('/websocket', endpoint);
                    if (url.protocol === 'http:') {
                        url.protocol = 'ws:';
                    } else if (url.protocol === 'https:') {
                        url.protocol = 'wss:';
                    }
                    const manager = new WebSocketManager(url);
                    manager.init();

                    return new WebsocketConnectionClient(manager.socket);
                }
            }
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
        const sim = new BotManager(
            {
                recordName: null,
                inst: null,
                isStatic: !!this._origin.isStatic,
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
        if (endpoint === this._authHelper.primaryAuthOrigin) {
            return this._authHelper.primary;
        } else {
            const helper = this._authHelper.getOrCreateEndpoint(endpoint);
            this._subscriptions.push(helper);
            return helper;
        }
    }
}
