/* CasualOS is a set of web-based tools designed to facilitate the creation of real-time, multi-user, context-aware interactive experiences.
 *
 * Copyright (c) 2019-2025 Casual Simulation, Inc.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */
import type {
    AuxPartitionConfig,
    ConnectionIndicator,
} from '@casual-simulation/aux-common';
import {
    parseSimulationId,
    TEMPORARY_BOT_PARTITION_ID,
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
        this._portals = new PortalManager(this._vm);
        this._progress = new ProgressManager(
            this._vm,
            this._portals.portalLoaded
        );
    }

    protected _beforeVmInit() {
        super._beforeVmInit();
        this._subscriptions.push(this._portals);
    }
}
