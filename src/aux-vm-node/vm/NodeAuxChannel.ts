import {
    RemoteAction,
    ConnectionInfo,
    ConnectionIndicator,
    createYjsPartition,
    createRemoteClientYjsPartition,
    AuxPartitionServices,
} from '@casual-simulation/aux-common';
import {
    PartitionConfig,
    AuxPartition,
    createAuxPartition,
    createMemoryPartition,
} from '@casual-simulation/aux-common';
import { AuxConfig, BaseAuxChannel } from '@casual-simulation/aux-vm';
import { Observable, Subject } from 'rxjs';
import { AuxRuntime } from '@casual-simulation/aux-runtime';
import { createRemoteYjsPartition } from '@casual-simulation/aux-vm-client';

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
