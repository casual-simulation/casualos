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
    storeData,
    WATCH_BRANCH,
    ADD_ATOMS,
    UNWATCH_BRANCH,
    WATCH_BRANCHES,
    WATCH_DEVICES,
    DEVICE_CONNECTED_TO_BRANCH,
    DEVICE_DISCONNECTED_FROM_BRANCH,
    LOAD_BRANCH,
    UNLOAD_BRANCH,
    AddAtomsEvent,
    CausalRepoSession,
    CausalRepoStageStore,
} from '@casual-simulation/causal-trees/core2';
import { ConnectionServer, Connection } from './ConnectionServer';

/**
 * Defines a class that is able to serve causal repos in realtime.
 */
export class CausalRepoServer {
    private _connectionServer: ConnectionServer;
    private _deviceManager: DeviceManager;
    private _store: CausalRepoStore;
    private _stage: CausalRepoStageStore;
    private _repos: Map<string, CausalRepo>;

    constructor(
        server: ConnectionServer,
        store: CausalRepoStore,
        stageStore: CausalRepoStageStore
    ) {
        this._connectionServer = server;
        this._store = store;
        this._deviceManager = new DeviceManagerImpl();
        this._repos = new Map();
        this._stage = stageStore;
    }

    init() {
        this._setupServer();
    }

    private _setupServer() {
        this._connectionServer.connection.subscribe(
            async (conn: CausalRepoSession) => {
                const device = await this._deviceManager.connectDevice(
                    conn.id,
                    conn
                );

                conn.event(WATCH_BRANCH).subscribe(async branch => {
                    const info = infoForBranch(branch);
                    await this._deviceManager.joinChannel(device, info);
                    const repo = await this._getOrLoadRepo(branch, true);
                    const atoms = repo.getAtoms();

                    this._sendConnectedToBranch(device, branch);
                    conn.send(ADD_ATOMS, {
                        branch: branch,
                        atoms: atoms,
                    });
                });

                conn.event(ADD_ATOMS).subscribe(async event => {
                    const repo = await this._getOrLoadRepo(event.branch, false);
                    const added = repo.add(...event.atoms);
                    if (added.length <= 0) {
                        return;
                    }
                    await storeData(this._store, added);
                    await this._stage.addAtoms(event.branch, added);

                    const info = infoForBranch(event.branch);
                    const devices = this._deviceManager.getConnectedDevices(
                        info
                    );
                    sendToDevices(
                        devices,
                        ADD_ATOMS,
                        {
                            branch: event.branch,
                            atoms: added,
                        },
                        device
                    );
                });

                conn.event(UNWATCH_BRANCH).subscribe(async branch => {
                    const info = infoForBranch(branch);
                    await this._deviceManager.leaveChannel(device, info);

                    this._sendDisconnectedFromBranch(device, branch);
                    await this._tryUnloadBranch(info);
                });

                conn.event(WATCH_BRANCHES).subscribe(async () => {
                    const info = branchesInfo();
                    await this._deviceManager.joinChannel(device, info);

                    for (let branch of this._repos.keys()) {
                        conn.send(LOAD_BRANCH, loadBranchEvent(branch));
                    }
                });

                conn.event(WATCH_DEVICES).subscribe(async () => {
                    const info = devicesInfo();
                    await this._deviceManager.joinChannel(device, info);

                    const branches = this._repos.keys();
                    for (let branch of branches) {
                        const branchInfo = infoForBranch(branch);
                        const devices = this._deviceManager.getConnectedDevices(
                            branchInfo
                        );
                        for (let device of devices) {
                            conn.send(DEVICE_CONNECTED_TO_BRANCH, {
                                branch: branch,
                                connectionId: device.id,
                            });
                        }
                    }
                });

                conn.disconnect.subscribe(async () => {
                    var channels = this._deviceManager.getConnectedChannels(
                        device
                    );
                    this._deviceManager.disconnectDevice(device);

                    for (let channel of channels) {
                        this._sendDisconnectedFromBranch(
                            device,
                            channel.info.id
                        );
                        await this._tryUnloadBranch(channel.info);
                    }
                });
            }
        );
    }

    private _sendConnectedToBranch(
        device: DeviceConnection<Connection>,
        branch: string
    ) {
        const info = devicesInfo();
        const devices = this._deviceManager.getConnectedDevices(info);
        sendToDevices(devices, DEVICE_CONNECTED_TO_BRANCH, {
            branch: branch,
            connectionId: device.id,
        });
    }

    private _sendDisconnectedFromBranch(
        device: DeviceConnection<Connection>,
        branch: string
    ) {
        const info = devicesInfo();
        const devices = this._deviceManager.getConnectedDevices(info);
        sendToDevices(devices, DEVICE_DISCONNECTED_FROM_BRANCH, {
            branch: branch,
            connectionId: device.id,
        });
    }

    private async _tryUnloadBranch(info: RealtimeChannelInfo) {
        const devices = this._deviceManager.getConnectedDevices(info);
        if (devices.length <= 0) {
            await this._unloadBranch(info.id);
        }
    }

    private async _unloadBranch(branch: string) {
        const repo = this._repos.get(branch);
        if (repo && repo.hasChanges) {
            console.log(
                `[CausalRepoServer] Committing '${branch}' before unloading...`
            );
            await repo.commit('Save before unload');
            console.log(`[CausalRepoServer] Committed '${branch}'!`);
        }
        await this._stage.clearStage(branch);
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
            const stage = await this._stage.getStage(branch);
            repo.add(...stage.additions);
            const hashes = Object.keys(stage.deletions);
            repo.remove(...hashes);

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

function devicesInfo(): RealtimeChannelInfo {
    return {
        id: 'devices',
        type: 'aux-devices',
    };
}
