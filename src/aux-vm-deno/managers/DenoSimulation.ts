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
import { DenoVM } from '../vm/DenoVM';
import {
    ESBuildPortalBundler,
    PortalManager,
    ProgressManager,
} from '@casual-simulation/aux-vm/managers';
import { filter, flatMap, tap, map } from 'rxjs/operators';
import { ConsoleMessages } from '@casual-simulation/causal-trees';
import { Observable, fromEventPattern, Subscription } from 'rxjs';
import { pickBy } from 'lodash';
import { getFinalUrl } from '@casual-simulation/aux-vm-client';
import { RemoteSimulation } from '@casual-simulation/aux-vm-client';

/**
 * Defines an interface for objects that represent bot simulations.
 */
export interface DenoSimulation extends RemoteSimulation {
    /**
     * Gets the progress manager.
     */
    progress: ProgressManager;
}

/**
 * Defines a class that interfaces with the AppManager and SocketManager
 * to reactively edit bots.
 */
export class DenoSimulationImpl
    extends BaseSimulation
    implements DenoSimulation {
    private _login: LoginManager;
    private _progress: ProgressManager;
    private _portals: PortalManager;

    get login() {
        return this._login;
    }

    get progress() {
        return this._progress;
    }

    get portals() {
        return this._portals;
    }

    constructor(
        user: AuxUser,
        id: string,
        config: AuxConfig['config'],
        defaultHost: string
    ) {
        super(
            id,
            config,
            createPartitions(),
            (config) => new DenoVM(user, config)
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
                [ADMIN_PARTITION_ID]: {
                    type: 'remote_causal_repo',
                    branch: ADMIN_BRANCH_NAME,
                    host: host,
                    private: true,
                    static: true,
                },
                [TEMPORARY_BOT_PARTITION_ID]: {
                    type: 'memory',
                    private: true,
                    initialState: {},
                },
                [TEMPORARY_SHARED_PARTITION_ID]: {
                    type: 'remote_causal_repo',
                    branch: `${parsedId.channel}-player-${user.id}`,
                    host: host,
                    temporary: true,
                    remoteEvents: false,
                },
                [REMOTE_TEMPORARY_SHARED_PARTITION_ID]: {
                    type: 'other_players_repo',
                    branch: parsedId.channel,
                    host: host,
                },
            };
        }
    }

    protected _initManagers() {
        super._initManagers();
        const bundler = new ESBuildPortalBundler();
        this._portals = new PortalManager(
            this._vm,
            this._helper,
            this._watcher,
            bundler
        );
    }
}
