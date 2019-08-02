import { AuxCausalTree } from '@casual-simulation/aux-common';
import {
    LocalRealtimeCausalTree,
    RealtimeCausalTree,
    ADMIN_ROLE,
    RemoteEvent,
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
    private _remoteEvents: Subject<RemoteEvent[]>;

    get remoteEvents(): Observable<RemoteEvent[]> {
        return this._remoteEvents;
    }

    constructor(tree: AuxCausalTree, user: AuxUser, config: AuxConfig) {
        super(user, config);
        this._tree = tree;
        this._remoteEvents = new Subject<RemoteEvent[]>();
    }

    async setGrant(grant: string): Promise<void> {}

    protected async _sendRemoteEvents(events: RemoteEvent[]): Promise<void> {
        this._remoteEvents.next(events);
    }

    protected async _createRealtimeCausalTree(): Promise<
        RealtimeCausalTree<AuxCausalTree>
    > {
        return new LocalRealtimeCausalTree<AuxCausalTree>(this._tree);
    }

    protected _createPrecalculationManager(): PrecalculationManager {
        const manager = super._createPrecalculationManager();
        manager.logFormulaErrors = true;
        return manager;
    }

    protected _createAuxHelper() {
        const helper = new AuxHelper(this._aux.tree, this._config.config, lib =>
            getSandbox(lib)
        );
        helper.userId = this.user ? this.user.id : null;
        return helper;
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
