import {
    RemoteAction,
    ConnectionInfo,
    ConnectionIndicator,
    createYjsPartition,
    createRemoteClientYjsPartition,
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
    private _device: ConnectionInfo;

    get remoteEvents(): Observable<RemoteAction[]> {
        return this._remoteEvents;
    }

    constructor(
        indicator: ConnectionIndicator,
        device: ConnectionInfo,
        config: AuxConfig
    ) {
        super(indicator, config, {});
        this._device = device;
        this._remoteEvents = new Subject<RemoteAction[]>();
    }

    protected async _createPartition(
        config: PartitionConfig
    ): Promise<AuxPartition> {
        return await createAuxPartition(
            config,
            createMemoryPartition,
            (config) => createYjsPartition(config),
            (config) => createRemoteYjsPartition(config, this.indicator),
            (config) => createRemoteClientYjsPartition(config)
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
        indicator: ConnectionIndicator,
        runtime: AuxRuntime,
        config: AuxConfig
    ): BaseAuxChannel {
        const channel = new NodeAuxChannel(indicator, this._device, config);
        channel._runtime = runtime;
        return channel;
    }
}
