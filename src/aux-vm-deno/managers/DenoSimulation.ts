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
    PLAYER_PARTITION_ID,
    OTHER_PLAYERS_PARTITION_ID,
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
import { ProgressManager } from '@casual-simulation/aux-vm/managers';
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

    get login() {
        return this._login;
    }

    get progress() {
        return this._progress;
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
                [PLAYER_PARTITION_ID]: {
                    type: 'remote_causal_repo',
                    branch: `${parsedId.channel}-player-${user.id}`,
                    host: host,
                    temporary: true,
                    remoteEvents: false,
                },
                [OTHER_PLAYERS_PARTITION_ID]: {
                    type: 'other_players_repo',
                    branch: parsedId.channel,
                    host: host,
                },
            };
        }
    }
}
