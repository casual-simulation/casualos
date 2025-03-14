import type {
    RemoteAction,
    AuxPartitionServices,
} from '@casual-simulation/aux-common';
import {
    ConnectionInfo,
    ConnectionIndicator,
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
import { BaseAuxChannel } from '@casual-simulation/aux-vm';
import type { Observable } from 'rxjs';
import { Subject } from 'rxjs';
import type { AuxRuntime } from '@casual-simulation/aux-runtime';
import {
    createRemoteYjsPartition,
    createRemoteYjsSharedDocument,
} from '@casual-simulation/aux-vm-client';
import type { SharedDocument } from '@casual-simulation/aux-common/documents/SharedDocument';
import type { RemoteSharedDocumentConfig } from '@casual-simulation/aux-common/documents/SharedDocumentConfig';
import { SharedDocumentConfig } from '@casual-simulation/aux-common/documents/SharedDocumentConfig';
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
