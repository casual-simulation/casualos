import {
    ADMIN_ROLE,
    RemoteAction,
    DeviceInfo,
} from '@casual-simulation/causal-trees';
import {
    AuxConfig,
    PrecalculationManager,
    BaseAuxChannel,
    AuxUser,
    createAuxPartition,
    createMemoryPartition,
    PartitionConfig,
    AuxPartition,
} from '@casual-simulation/aux-vm';
import { getSandbox } from './VM2Sandbox';
import { Observable, Subject } from 'rxjs';
import { createCausalRepoPartition } from '@casual-simulation/aux-vm/partitions';

export class NodeAuxChannel extends BaseAuxChannel {
    private _remoteEvents: Subject<RemoteAction[]>;
    private _device: DeviceInfo;

    get remoteEvents(): Observable<RemoteAction[]> {
        return this._remoteEvents;
    }

    constructor(user: AuxUser, device: DeviceInfo, config: AuxConfig) {
        super(user, config, {
            sandboxFactory: lib => getSandbox(lib),
        });
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

    protected _createPrecalculationManager(): PrecalculationManager {
        const manager = super._createPrecalculationManager();
        manager.logFormulaErrors = true;
        return manager;
    }

    protected async _createGlobalsBot() {
        await super._createGlobalsBot();
    }
}
