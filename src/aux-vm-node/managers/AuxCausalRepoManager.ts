import {
    CausalRepoClient,
    DEVICE_CONNECTED_TO_BRANCH,
    WatchBranchEvent,
} from '@casual-simulation/causal-trees/core2';
import { DeviceInfo, SESSION_ID_CLAIM } from '@casual-simulation/causal-trees';
import { AuxUser, AuxModule2, Simulation } from '@casual-simulation/aux-vm';
import { concatMap } from 'rxjs/operators';
import { Subscription } from 'rxjs';
import { nodeSimulationForBranch } from './NodeSimulationFactories';

/**
 * Defines a manager that is able to bridge between aux modules and a causal repo server.
 * That is, given a causal repo client, this object is able to properly manage Aux Modules.
 */
export class AuxCausalRepoManager {
    private _client: CausalRepoClient;
    private _modules: AuxModule2[];

    private _branches: Map<string, BranchInfo>;
    private _user: AuxUser;
    private _serverDevice: DeviceInfo;
    private _ignoredUserIds: Set<string>;
    private _factory: (
        user: AuxUser,
        client: CausalRepoClient,
        branch: string
    ) => Simulation;

    constructor(
        user: AuxUser,
        client: CausalRepoClient,
        modules: AuxModule2[],
        simulationFactory?: (
            user: AuxUser,
            client: CausalRepoClient,
            branch: string
        ) => Simulation,
        userIdsToIgnore?: string[]
    ) {
        this._client = client;
        this._modules = modules;
        this._branches = new Map();
        this._user = user;
        this._ignoredUserIds = new Set([user.id, ...(userIdsToIgnore || [])]);
        this._factory =
            simulationFactory ||
            ((user, client, branch) =>
                nodeSimulationForBranch(user, client, branch));
    }

    init() {
        this._client
            .watchDevices()
            .pipe(
                concatMap(async e => {
                    if (e.type === DEVICE_CONNECTED_TO_BRANCH) {
                        await this._deviceConnected(e.branch, e.device);
                    } else {
                        await this._deviceDisconnected(e.branch, e.device);
                    }
                })
            )
            .subscribe(null, err => console.error(err));
    }

    private async _deviceConnected(
        branch: WatchBranchEvent,
        device: DeviceInfo
    ) {
        const id = device.claims[SESSION_ID_CLAIM];
        if (id === this._user.id) {
            this._serverDevice = device;
        }
        if (this._ignoredUserIds.has(id)) {
            return;
        }
        if (branch.temporary === true) {
            return;
        }

        let info = await this._loadBranch(branch.branch, true);
        info.connections.add(id);

        for (let mod of this._modules) {
            await mod.deviceConnected(info.simulation, device);
        }
    }

    private async _deviceDisconnected(branch: string, device: DeviceInfo) {
        if (this._ignoredUserIds.has(device.claims[SESSION_ID_CLAIM])) {
            return;
        }

        let info = await this._loadBranch(branch, false);
        if (!info) {
            return;
        }
        const id = device.claims[SESSION_ID_CLAIM];
        info.connections.delete(id);

        for (let mod of this._modules) {
            await mod.deviceDisconnected(info.simulation, device);
        }

        if (info.connections.size <= 1) {
            // Send the server disconnect event before the simulation is unloaded
            if (this._serverDevice) {
                for (let mod of this._modules) {
                    await mod.deviceDisconnected(
                        info.simulation,
                        this._serverDevice
                    );
                }
            }

            this._unloadBranch(branch);
        }
    }

    /**
     * Loads a simulation for the given branch.
     * @param branch The branch to load.
     * @param allowLoadingFresh Whether to allow loading a new simulation. If false and the branch is not already loaded, then null will be returned.
     */
    private async _loadBranch(branch: string, allowLoadingFresh: boolean) {
        let info = this._branches.get(branch);
        if (!info && allowLoadingFresh) {
            const sim = this._factory(this._user, this._client, branch);
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
