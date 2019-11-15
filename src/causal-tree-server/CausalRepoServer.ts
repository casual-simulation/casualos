import {
    DeviceInfo,
    RemoteAction,
    RealtimeChannelInfo,
} from '@casual-simulation/causal-trees';
import { Socket, Server } from 'socket.io';
import { DeviceManager } from './DeviceManager';
import { DeviceManagerImpl } from './DeviceManagerImpl';
import { DeviceConnection } from './DeviceConnection';
import {
    CausalRepoStore,
    CausalRepo,
    CausalRepoBranch,
    Atom,
} from '@casual-simulation/causal-trees/core2';
import { fromEventPattern, Observable, merge, Observer } from 'rxjs';
import {
    flatMap,
    map,
    takeUntil,
    startWith,
    shareReplay,
    tap,
    switchMap,
    takeWhile,
    scan,
    share,
    endWith,
    skipWhile,
    take,
    withLatestFrom,
    groupBy,
} from 'rxjs/operators';
import mergeObj from 'lodash/merge';
import { ConnectionServer } from './ConnectionServer';

export const WATCH_BRANCHES = 'watch_branches';
export const UNWATCH_BRANCHES = 'unwatch_branches';
export const WATCH_BRANCH = 'watch_branch';
export const UNWATCH_BRANCH = 'unwatch_branch';
export const ADD_ATOMS = 'add_atoms';
export const LOAD_BRANCH = 'load_branch';
export const UNLOAD_BRANCH = 'unload_branch';

/**
 * Defines a class that is able to serve causal repos in realtime.
 */
export class CausalRepoServer {
    private _connectionServer: ConnectionServer;
    private _deviceManager: DeviceManager;
    private _store: CausalRepoStore;
    private _repos: Map<string, CausalRepo>;

    constructor(server: ConnectionServer, store: CausalRepoStore) {
        this._connectionServer = server;
        this._store = store;
        this._deviceManager = new DeviceManagerImpl();
        this._repos = new Map();
    }

    init() {
        this._setupServer();
    }

    private _setupServer() {
        this._connectionServer.connection.subscribe(async conn => {
            const device = await this._deviceManager.connectDevice(
                conn.id,
                conn
            );

            conn.event<string>(WATCH_BRANCH).subscribe(async branch => {
                const info = infoForBranch(branch);
                await this._deviceManager.joinChannel(device, info);
                const repo = await this._getOrLoadRepo(branch, true);
                const atoms = repo.getAtoms();

                conn.send(ADD_ATOMS, {
                    branch: branch,
                    atoms: atoms,
                });
            });

            conn.event<AddAtomsEvent>(ADD_ATOMS).subscribe(async event => {
                const repo = await this._getOrLoadRepo(event.branch, false);
                repo.add(...event.atoms);

                const info = infoForBranch(event.branch);
                const devices = this._deviceManager.getConnectedDevices(info);
                sendToDevices(
                    devices,
                    ADD_ATOMS,
                    {
                        branch: event.branch,
                        atoms: event.atoms,
                    },
                    device
                );
            });

            conn.event<string>(UNWATCH_BRANCH).subscribe(async branch => {
                const info = infoForBranch(branch);
                await this._deviceManager.leaveChannel(device, info);

                const devices = this._deviceManager.getConnectedDevices(info);
                if (devices.length <= 0) {
                    this._unloadBranch(branch);
                }
            });

            conn.event<void>(WATCH_BRANCHES).subscribe(async () => {
                const info = branchesInfo();
                await this._deviceManager.joinChannel(device, info);

                for (let branch of this._repos.keys()) {
                    conn.send(LOAD_BRANCH, loadBranchEvent(branch));
                }
            });

            conn.disconnect.subscribe(() => {
                this._deviceManager.disconnectDevice(device);
            });
        });
    }

    private _unloadBranch(branch: string) {
        // TODO: Commit changes
        this._repos.delete(branch);
        this._branchUnloaded(branch);
    }

    private async _getOrLoadRepo(branch: string, createBranch: boolean) {
        let repo = this._repos.get(branch);

        if (!repo) {
            repo = new CausalRepo(this._store);
            await repo.checkout(branch, {
                createIfDoesntExist: createBranch
                    ? {
                          hash: null,
                      }
                    : null,
            });

            this._repos.set(branch, repo);
            this._branchLoaded(branch);
        }

        return repo;
    }

    private _branchLoaded(branch: string) {
        const info = branchesInfo();
        const devices = this._deviceManager.getConnectedDevices(info);
        sendToDevices(devices, LOAD_BRANCH, loadBranchEvent(branch));
    }

    private _branchUnloaded(branch: string) {
        const info = branchesInfo();
        const devices = this._deviceManager.getConnectedDevices(info);
        sendToDevices(devices, UNLOAD_BRANCH, unloadBranchEvent(branch));
    }
}

export interface AddAtomsEvent {
    branch: string;
    atoms: Atom<any>[];
}

export interface AddBranchEvent {
    branch: string;
}

function loadBranchEvent(branch: string) {
    return {
        branch: branch,
    };
}

function unloadBranchEvent(branch: string) {
    return {
        branch,
    };
}

function sendToDevices(
    devices: DeviceConnection<any>[],
    eventName: string,
    data: any,
    excludeDevice?: DeviceConnection<any>
) {
    for (let device of devices) {
        if (excludeDevice && excludeDevice.id === device.id) {
            continue;
        }
        device.extra.send(eventName, data);
    }
}

function infoForBranch(branch: any): RealtimeChannelInfo {
    return {
        id: branch,
        type: 'aux-branch',
    };
}

function branchesInfo(): RealtimeChannelInfo {
    return {
        id: 'branches',
        type: 'aux-branches',
    };
}
