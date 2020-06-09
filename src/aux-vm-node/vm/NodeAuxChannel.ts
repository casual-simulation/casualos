import {
    ADMIN_ROLE,
    RemoteAction,
    DeviceInfo,
} from '@casual-simulation/causal-trees';
import {
    PartitionConfig,
    AuxPartition,
    createAuxPartition,
    createMemoryPartition,
    createCausalRepoPartition,
    AuxRuntime,
} from '@casual-simulation/aux-common';
import { AuxConfig, BaseAuxChannel, AuxUser } from '@casual-simulation/aux-vm';
import { Observable, Subject } from 'rxjs';

export class NodeAuxChannel extends BaseAuxChannel {
    private _remoteEvents: Subject<RemoteAction[]>;
    private _device: DeviceInfo;

    get remoteEvents(): Observable<RemoteAction[]> {
        return this._remoteEvents;
    }

    constructor(user: AuxUser, device: DeviceInfo, config: AuxConfig) {
        super(user, config, {});
        this._device = device;
        this._remoteEvents = new Subject<RemoteAction[]>();
    }

    protected async _createPartition(
        config: PartitionConfig
    ): Promise<AuxPartition> {
        return await createAuxPartition(config, createMemoryPartition, config =>
            createCausalRepoPartition(config, this.user)
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
}
