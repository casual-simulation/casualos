import type {
    AuxPartitionConfig,
    ConnectionIndicator,
} from '@casual-simulation/aux-common';
import {
    parseSimulationId,
    TEMPORARY_BOT_PARTITION_ID,
    ADMIN_PARTITION_ID,
    ADMIN_BRANCH_NAME,
    TEMPORARY_SHARED_PARTITION_ID,
    REMOTE_TEMPORARY_SHARED_PARTITION_ID,
    getConnectionId,
    DEFAULT_BRANCH_NAME,
} from '@casual-simulation/aux-common';

import { BaseSimulation, LoginManager } from '@casual-simulation/aux-vm';
import type { DenoVM } from '../vm/DenoVM';
import type { SimulationOrigin } from '@casual-simulation/aux-vm/managers';
import {
    PortalManager,
    ProgressManager,
} from '@casual-simulation/aux-vm/managers';
import { getFinalUrl } from '@casual-simulation/aux-vm-client';
import type { RemoteSimulation } from '@casual-simulation/aux-vm-client';

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
    implements DenoSimulation
{
    private _login: LoginManager;
    private _progress: ProgressManager;
    private _portals: PortalManager;
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

    get login() {
        return this._login;
    }

    get progress() {
        return this._progress;
    }

    get portals() {
        return this._portals;
    }

    static createPartitions(
        id: string,
        indicator: ConnectionIndicator,
        defaultHost: string
    ): AuxPartitionConfig {
        const parsedId = parseSimulationId(id);
        const host = getFinalUrl(defaultHost, parsedId.host);
        const connectionId = getConnectionId(indicator);
        return {
            shared: {
                type: 'remote_yjs',
                recordName: null,
                inst: parsedId.channel,
                branch: DEFAULT_BRANCH_NAME,
                host: host,
            },
            [TEMPORARY_BOT_PARTITION_ID]: {
                type: 'memory',
                private: true,
                initialState: {},
            },
            [TEMPORARY_SHARED_PARTITION_ID]: {
                type: 'remote_yjs',
                recordName: null,
                inst: parsedId.channel,
                branch: `${DEFAULT_BRANCH_NAME}-player-${connectionId}`,
                host: host,
                temporary: true,
                remoteEvents: false,
            },
            [REMOTE_TEMPORARY_SHARED_PARTITION_ID]: {
                type: 'other_players_repo',
                recordName: null,
                inst: parsedId.channel,
                branch: DEFAULT_BRANCH_NAME,
                host: host,
            },
        };
    }

    constructor(
        indicator: ConnectionIndicator,
        origin: SimulationOrigin,
        vm: DenoVM
    ) {
        super(vm);
        this._origin = origin;
        this.helper.userId = getConnectionId(indicator);

        this._login = new LoginManager(this._vm);
        this._progress = new ProgressManager(this._vm);
    }

    protected _beforeVmInit() {
        super._beforeVmInit();
        this._portals = new PortalManager(this._vm);
        this._subscriptions.push(this._portals);
    }
}
