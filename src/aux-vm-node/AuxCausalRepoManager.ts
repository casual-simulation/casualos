import {
    CausalRepoClient,
    LOAD_BRANCH,
    DEVICE_CONNECTED_TO_BRANCH,
    DEVICE_DISCONNECTED_FROM_BRANCH,
} from '@casual-simulation/causal-trees/core2';
import { AuxUser, AuxModule2, Simulation } from '@casual-simulation/aux-vm';
import { tap, flatMap, concatMap } from 'rxjs/operators';
import { Subscription } from 'rxjs';
import { nodeSimulationForBranch } from './managers/NodeSimulationFactories';

/**
 * Defines a manager that is able to bridge between aux modules and a causal repo server.
 * That is, given a causal repo client, this object is able to properly manage Aux Modules.
 */
export class AuxCausalRepoManager {
    private _client: CausalRepoClient;
    private _modules: AuxModule2[];

    private _branches: Map<string, BranchInfo>;
    private _user: AuxUser;

    constructor(
        user: AuxUser,
        client: CausalRepoClient,
        modules: AuxModule2[]
    ) {
        this._client = client;
        this._modules = modules;
        this._branches = new Map();
        this._user = user;
    }

    init() {
        // this._client.watchBranches().pipe(
        //     tap(e => {
        //         if (e.type === LOAD_BRANCH) {
        //             this._watchBranch(e.branch);
        //         } else {
        //             this._unwatchBranch(e.branch);
        //         }
        //     })
        // ).subscribe();

        this._client
            .watchDevices()
            .pipe(
                concatMap(async e => {
                    if (e.type === DEVICE_CONNECTED_TO_BRANCH) {
                        await this._deviceConnected(e.branch, e.connectionId);
                    } else {
                        await this._deviceDisconnected(
                            e.branch,
                            e.connectionId
                        );
                    }
                })
            )
            .subscribe();
    }

    private async _deviceConnected(branch: string, connectionId: string) {
        let info = await this._loadBranch(branch);
        info.connections.add(connectionId);
    }

    private async _deviceDisconnected(branch: string, connectionId: string) {
        let info = await this._loadBranch(branch);
        info.connections.delete(connectionId);

        if (info.connections.size <= 1) {
            this._unloadBranch(branch);
        }
    }

    private async _loadBranch(branch: string) {
        let info = this._branches.get(branch);
        if (!info) {
            const sim = nodeSimulationForBranch(
                this._user,
                this._client,
                branch
            );
            await sim.init();
            let sub = new Subscription();
            sub.add(sim);
            info = {
                connections: new Set(),
                subscription: sub,
                simulation: sim,
            };

            this._branches.set(branch, info);

            for (let mod of this._modules) {
                sub.add(await mod.setup(sim));
            }
        }

        return info;
    }

    private _unloadBranch(branch: string) {
        let info = this._branches.get(branch);
        if (info) {
            info.subscription.unsubscribe();
        }
        this._branches.delete(branch);
    }
}

interface BranchInfo {
    connections: Set<string>;
    subscription: Subscription;
    simulation: Simulation;
}
