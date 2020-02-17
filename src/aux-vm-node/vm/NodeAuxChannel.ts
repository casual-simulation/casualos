import { AuxCausalTree } from '@casual-simulation/aux-common';
import {
    LocalRealtimeCausalTree,
    RealtimeCausalTree,
    ADMIN_ROLE,
    RemoteAction,
    DeviceInfo,
    RealtimeCausalTreeOptions,
} from '@casual-simulation/causal-trees';
import {
    AuxConfig,
    PrecalculationManager,
    BaseAuxChannel,
    AuxUser,
    AuxHelper,
    createAuxPartition,
    createLocalCausalTreePartitionFactory,
    createMemoryPartition,
    PartitionConfig,
    AuxPartition,
    filterAtomFactory,
} from '@casual-simulation/aux-vm';
import { getSandbox } from './VM2Sandbox';
import { Observable, Subject } from 'rxjs';
import { createCausalRepoPartition } from '@casual-simulation/aux-vm/partitions';

export class NodeAuxChannel extends BaseAuxChannel {
    private _tree: AuxCausalTree;
    private _remoteEvents: Subject<RemoteAction[]>;
    private _device: DeviceInfo;

    get remoteEvents(): Observable<RemoteAction[]> {
        return this._remoteEvents;
    }

    get tree() {
        return this._tree;
    }

    constructor(
        tree: AuxCausalTree,
        user: AuxUser,
        device: DeviceInfo,
        config: AuxConfig
    ) {
        super(user, config, {
            sandboxFactory: lib => getSandbox(lib),
        });
        this._tree = tree;
        this._device = device;
        this._remoteEvents = new Subject<RemoteAction[]>();
    }

    protected async _createPartition(
        config: PartitionConfig
    ): Promise<AuxPartition> {
        return await createAuxPartition(
            config,
            createLocalCausalTreePartitionFactory(
                {
                    treeOptions: {
                        filter: filterAtomFactory(() => this.helper),
                    },
                },
                this.user,
                this._device
            ),
            createMemoryPartition,
            config => createCausalRepoPartition(config, this.user)
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
