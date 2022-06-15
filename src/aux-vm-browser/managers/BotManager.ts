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
import { BotPanelManager } from './BotPanelManager';
import { BrowserSimulation } from './BrowserSimulation';
import { AuxVMImpl } from '../vm/AuxVMImpl';
import { PortalManager, ProgressManager } from '@casual-simulation/aux-vm';
import { filter, flatMap, tap, map } from 'rxjs/operators';
import { ConsoleMessages } from '@casual-simulation/causal-trees';
import { Observable, fromEventPattern, Subscription } from 'rxjs';
import { getFinalUrl } from '@casual-simulation/aux-vm-client';
import { LocalStoragePartitionImpl } from '../partitions/LocalStoragePartition';
import { getBotsStateFromStoredAux } from '@casual-simulation/aux-vm/StoredAux';
import { IdePortalManager } from './IdePortalManager';
import { AuthHelper } from './AuthHelper';
import { AuthEndpointHelper } from './AuthEndpointHelper';
import { SystemPortalManager } from './SystemPortalManager';
import { AuthHelperInterface } from '@casual-simulation/aux-vm/managers';
import { LivekitManager } from './LivekitManager';

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
    private _systemPortal: SystemPortalManager;
    private _authHelper: AuthHelper;
    private _recordsManager: RecordsManager;
    private _livekitManager: LivekitManager;

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
            const host = getFinalUrl(defaultHost, parsedId.host);
            const causalRepoHost = getFinalUrl(
                config.causalRepoConnectionUrl || defaultHost,
                parsedId.host
            );
            const protocol = config.causalRepoConnectionProtocol;
            const versions = config.sharedPartitionsVersion;
            const isV2 = versions === 'v2';
            const isCollaborative = !!config.device?.isCollaborative;

            if (!isCollaborative) {
                console.log('[BotManager] Disabling Collaboration Features');
            } else {
                if (isV2) {
                    console.log('[BotManager] Using v2 shared partitions');
                }
            }

            let partitions: AuxPartitionConfig = {
                // Use a memory partition instead of a shared partition
                // when collaboration is disabled.
                shared: isCollaborative
                    ? isV2
                        ? {
                              type: 'remote_yjs',
                              branch: parsedId.channel,
                              host: causalRepoHost,
                              connectionProtocol: protocol,
                          }
                        : {
                              type: 'remote_causal_repo',
                              branch: parsedId.channel,
                              host: causalRepoHost,
                              connectionProtocol: protocol,
                          }
                    : {
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
                [TEMPORARY_SHARED_PARTITION_ID]: isCollaborative
                    ? isV2
                        ? {
                              type: 'remote_yjs',
                              branch: `${parsedId.channel}-player-${user.id}`,
                              host: causalRepoHost,
                              connectionProtocol: protocol,
                              temporary: true,
                              remoteEvents: false,
                          }
                        : {
                              type: 'remote_causal_repo',
                              branch: `${parsedId.channel}-player-${user.id}`,
                              host: causalRepoHost,
                              connectionProtocol: protocol,
                              temporary: true,
                              remoteEvents: false,
                          }
                    : {
                          type: 'memory',
                          initialState: {},
                      },
                [REMOTE_TEMPORARY_SHARED_PARTITION_ID]: isCollaborative
                    ? {
                          type: 'other_players_repo',
                          branch: parsedId.channel,
                          host: causalRepoHost,
                          connectionProtocol: protocol,
                          childPartitionType: isV2
                              ? 'yjs_client'
                              : 'causal_repo_client',
                      }
                    : null,
                [BOOTSTRAP_PARTITION_ID]: {
                    type: 'memory',
                    initialState: config.bootstrapState
                        ? getBotsStateFromStoredAux(config.bootstrapState)
                        : {},
                    private: true,
                },
            };

            // Enable the admin partition and error partition when using the websocket protocol.
            if (
                !config.causalRepoConnectionProtocol ||
                config.causalRepoConnectionProtocol === 'websocket'
            ) {
                partitions[ADMIN_PARTITION_ID] = isCollaborative
                    ? {
                          type: 'remote_causal_repo',
                          branch: ADMIN_BRANCH_NAME,
                          host: causalRepoHost,
                          connectionProtocol: protocol,
                          private: true,
                          static: true,
                      }
                    : null;
            }

            return partitions;
        }
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
        this._livekitManager = new LivekitManager(this._helper);

        this._subscriptions.push(this._portals);
        this._subscriptions.push(this._botPanel);
        this._subscriptions.push(this._idePortal);
        this._subscriptions.push(this._systemPortal);
        this._subscriptions.push(
            this._vm.localEvents
                .pipe(tap((e) => this._recordsManager.handleEvents(e)))
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
                .pipe(tap((e) => this._livekitManager.handleEvents(e)))
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
