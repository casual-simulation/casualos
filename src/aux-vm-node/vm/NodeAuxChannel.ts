import { AuxCausalTree } from '@casual-simulation/aux-common';
import {
    LocalRealtimeCausalTree,
    RealtimeCausalTree,
    ADMIN_ROLE,
    RemoteAction,
    DeviceInfo,
} from '@casual-simulation/causal-trees';
import {
    AuxConfig,
    PrecalculationManager,
    BaseAuxChannel,
    AuxUser,
    AuxHelper,
} from '@casual-simulation/aux-vm';
import { getSandbox } from './VM2Sandbox';
import { Observable, Subject } from 'rxjs';

export class NodeAuxChannel extends BaseAuxChannel {
    private _tree: AuxCausalTree;
    private _remoteEvents: Subject<RemoteAction[]>;
    private _device: DeviceInfo;

    get remoteEvents(): Observable<RemoteAction[]> {
        return this._remoteEvents;
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

    async setGrant(grant: string): Promise<void> {}

    protected async _sendRemoteEvents(events: RemoteAction[]): Promise<void> {
        this._remoteEvents.next(events);
    }

    protected async _createRealtimeCausalTree(): Promise<
        RealtimeCausalTree<AuxCausalTree>
    > {
        return new LocalRealtimeCausalTree<AuxCausalTree>(
            this._tree,
            this.user,
            this._device
        );
    }

    protected _createPrecalculationManager(): PrecalculationManager {
        const manager = super._createPrecalculationManager();
        manager.logFormulaErrors = true;
        return manager;
    }

    protected async _createGlobalsFile() {
        await super._createGlobalsFile();

        if (this._config.id === 'aux-admin') {
            const globals = this.helper.globalsFile;

            await this.helper.updateFile(globals, {
                tags: {
                    'aux.whitelist.roles': [ADMIN_ROLE],
                },
            });
        }
    }
}
