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
    RemoteAction,
    AuxPartitionServices,
} from '@casual-simulation/aux-common';
import {
    createYjsPartition,
    createRemoteClientYjsPartition,
} from '@casual-simulation/aux-common';
import type {
    PartitionConfig,
    AuxPartition,
} from '@casual-simulation/aux-common';
import {
    createAuxPartition,
    createMemoryPartition,
} from '@casual-simulation/aux-common';
import type { AuxConfig } from '@casual-simulation/aux-vm';
import { BaseAuxChannel } from '@casual-simulation/aux-vm/vm';
import type { Observable } from 'rxjs';
import { Subject } from 'rxjs';
import type { AuxRuntime } from '@casual-simulation/aux-runtime';
import {
    createRemoteYjsPartition,
    createRemoteYjsSharedDocument,
} from '@casual-simulation/aux-vm-client';
import type { SharedDocument } from '@casual-simulation/aux-common/documents/SharedDocument';
import type { RemoteSharedDocumentConfig } from '@casual-simulation/aux-common/documents/SharedDocumentConfig';
import type { SharedDocumentServices } from '@casual-simulation/aux-common/documents/SharedDocumentFactories';
import { createSharedDocument } from '@casual-simulation/aux-common/documents/SharedDocumentFactories';
import { createYjsSharedDocument } from '@casual-simulation/aux-common/documents/YjsSharedDocument';

export class NodeAuxChannel extends BaseAuxChannel {
    private _remoteEvents: Subject<RemoteAction[]>;

    get remoteEvents(): Observable<RemoteAction[]> {
        return this._remoteEvents;
    }

    constructor(config: AuxConfig) {
        super(config, {});
        this._remoteEvents = new Subject<RemoteAction[]>();
    }

    protected async _createPartition(
        config: PartitionConfig,
        services: AuxPartitionServices
    ): Promise<AuxPartition> {
        return await createAuxPartition(
            config,
            services,
            createMemoryPartition,
            (config) => createYjsPartition(config),
            (config) => createRemoteYjsPartition(config, services.authSource),
            (config) =>
                createRemoteClientYjsPartition(config, services.authSource)
        );
    }

    protected async _createSharedDocument(
        config: RemoteSharedDocumentConfig,
        services: SharedDocumentServices
    ): Promise<SharedDocument> {
        return await createSharedDocument(
            config,
            services,
            (config, services) =>
                createRemoteYjsSharedDocument(config, services.authSource),
            createYjsSharedDocument
        );
    }

    protected async _sendRemoteEvents(events: RemoteAction[]): Promise<void> {
        await super._sendRemoteEvents(events);
        this._remoteEvents.next(events);
    }

    protected _createRuntime(): AuxRuntime {
        const manager = super._createRuntime();
        // manager.logFormulaErrors = true;
        return manager;
    }

    protected _createSubChannel(
        runtime: AuxRuntime,
        config: AuxConfig
    ): BaseAuxChannel {
        const channel = new NodeAuxChannel(config);
        channel._runtime = runtime;
        return channel;
    }
}
