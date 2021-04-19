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
} from '@casual-simulation/aux-vm';
import { BotPanelManager } from './BotPanelManager';
import { BrowserSimulation } from './BrowserSimulation';
import { AuxVMImpl } from '../vm/AuxVMImpl';
import {
    PortalBundler,
    PortalManager,
    ProgressManager,
} from '@casual-simulation/aux-vm';
import { filter, flatMap, tap, map } from 'rxjs/operators';
import { ConsoleMessages } from '@casual-simulation/causal-trees';
import { Observable, fromEventPattern, Subscription } from 'rxjs';
import { getFinalUrl } from '@casual-simulation/aux-vm-client';
import { LocalStoragePartitionImpl } from '../partitions/LocalStoragePartition';
import { getBotsStateFromStoredAux } from '@casual-simulation/aux-vm/StoredAux';
import { ESBuildPortalBundler } from '@casual-simulation/aux-vm/managers';

// NOTE: This triggers an "Cannot find module or declarations" error for this
// during Jest tests but not during builds.
// @ts-ignore TS2307
import ESBuildWasmURL from 'esbuild-wasm/esbuild.wasm';
import { IdePortalManager } from './IdePortalManager';

/**
 * Defines a class that interfaces with the AppManager and SocketManager
 * to reactively edit bots.
 */
export class BotManager extends BaseSimulation implements BrowserSimulation {
    private _botPanel: BotPanelManager;
    private _login: LoginManager;
    private _progress: ProgressManager;
    private _bundler: PortalBundler;
    private _portals: PortalManager;
    private _idePortal: IdePortalManager;

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
        defaultHost: string = location.origin
    ) {
        super(
            id,
            config,
            createPartitions(),
            (config) => new AuxVMImpl(user, config)
        );
        this.helper.userId = user ? user.id : null;

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

            if (!config.device.isCollaborative) {
                console.log('[BotManager] Disabling Collaboration Features');
            }

            let partitions: AuxPartitionConfig = {
                // Use a memory partition instead of a shared partition
                // when collaboration is disabled.
                shared: config.device.isCollaborative
                    ? versions === 'v2'
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
                            server: id,
                        }),
                    },
                },
                [TEMPORARY_SHARED_PARTITION_ID]: config.device.isCollaborative
                    ? versions === 'v2'
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
                [REMOTE_TEMPORARY_SHARED_PARTITION_ID]: config.device
                    .isCollaborative
                    ? {
                          type: 'other_players_repo',
                          branch: parsedId.channel,
                          host: causalRepoHost,
                          connectionProtocol: protocol,
                          childPartitionType:
                              versions === 'v2'
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

            // Enable the admin partition and error partition when using the socket.io protocol.
            if (
                !config.causalRepoConnectionProtocol ||
                config.causalRepoConnectionProtocol === 'socket.io'
            ) {
                partitions[ADMIN_PARTITION_ID] = config.device.isCollaborative
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

    protected _initManagers() {
        super._initManagers();
        this._botPanel = new BotPanelManager(this._watcher, this._helper);
        this._bundler = new ESBuildPortalBundler({
            esbuildWasmUrl: ESBuildWasmURL,
        });
        this._portals = new PortalManager(
            this._vm,
            this.helper,
            this.watcher,
            this._bundler
        );
        this._idePortal = new IdePortalManager(this._watcher, this.helper);

        this._subscriptions.push(this._portals);
    }
}
