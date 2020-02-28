import {
    DeviceInfo,
    RemoteAction,
    RealtimeChannelInfo,
    SESSION_ID_CLAIM,
    device as deviceEvent,
    DeviceSelector,
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
    ATOMS_RECEIVED,
    UNWATCH_BRANCH,
    WATCH_BRANCHES,
    WATCH_DEVICES,
    DEVICE_CONNECTED_TO_BRANCH,
    DEVICE_DISCONNECTED_FROM_BRANCH,
    LOAD_BRANCH,
    UNLOAD_BRANCH,
    BRANCH_INFO,
    AddAtomsEvent,
    CausalRepoSession,
    CausalRepoStageStore,
    SEND_EVENT,
    RECEIVE_EVENT,
    BRANCHES,
    COMMIT,
    WATCH_COMMITS,
    loadCommit,
    listCommits,
    AddCommitsEvent,
    ADD_COMMITS,
    CHECKOUT,
    calculateDiff,
    calculateCommitDiff,
    RESTORE,
    commit,
    CommitEvent,
    CausalRepoCommit,
    CommitData,
    CheckoutEvent,
} from '@casual-simulation/causal-trees/core2';
import { ConnectionServer, Connection } from './ConnectionServer';
import { devicesForEvent } from './DeviceManagerHelpers';

/**
 * Defines a class that is able to serve causal repos in realtime.
 */
export class CausalRepoServer {
    private _connectionServer: ConnectionServer;
    private _deviceManager: DeviceManager;
    private _store: CausalRepoStore;
    private _stage: CausalRepoStageStore;
    private _repos: Map<string, CausalRepo>;

    /**
     * Gets or sets the default device selector that should be used
     * for events that are sent without a selector.
     */
    defaultDeviceSelector: DeviceSelector;

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
                const id = conn.device.claims[SESSION_ID_CLAIM];
                console.log(`[CausalRepoServer] Got Connection: ${id}`);
                const device = await this._deviceManager.connectDevice(
                    id,
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

                    let added: Atom<any>[];
                    let removed: Atom<any>[];

                    if (event.atoms) {
                        added = repo.add(...event.atoms);
                        await this._stage.addAtoms(event.branch, added);
                        await storeData(this._store, added);
                    }
                    if (event.removedAtoms) {
                        removed = repo.remove(...event.removedAtoms);
                        await this._stage.removeAtoms(event.branch, removed);
                    }
                    const hasAdded = added && added.length > 0;
                    const hasRemoved = removed && removed.length > 0;
                    if (hasAdded || hasRemoved) {
                        const info = infoForBranch(event.branch);
                        const devices = this._deviceManager.getConnectedDevices(
                            info
                        );

                        let ret: AddAtomsEvent = {
                            branch: event.branch,
                        };

                        if (hasAdded) {
                            ret.atoms = added;
                        }
                        if (hasRemoved) {
                            ret.removedAtoms = removed.map(r => r.hash);
                        }

                        sendToDevices(devices, ADD_ATOMS, ret, device);
                    }

                    const addedAtomHashes = (event.atoms || []).map(
                        a => a.hash
                    );
                    const removedAtomHashes = event.removedAtoms || [];
                    sendToDevices([device], ATOMS_RECEIVED, {
                        branch: event.branch,
                        hashes: [...addedAtomHashes, ...removedAtomHashes],
                    });
                });

                conn.event(COMMIT).subscribe(async event => {
                    const repo = await this._getOrLoadRepo(event.branch, false);
                    if (!repo) {
                        return;
                    }

                    if (repo.hasChanges()) {
                        await this._commitToRepo(event, repo);
                    }
                });

                conn.event(WATCH_COMMITS).subscribe(async branch => {
                    const info = infoForBranchCommits(branch);
                    await this._deviceManager.joinChannel(device, info);

                    const repo = await this._getOrLoadRepo(branch, false);
                    if (!repo) {
                        return;
                    }

                    if (!repo.currentCommit) {
                        return;
                    }

                    const commits = await listCommits(
                        this._store,
                        repo.currentCommit.commit.hash
                    );
                    let e: AddCommitsEvent = {
                        branch: branch,
                        commits: commits,
                    };

                    conn.send(ADD_COMMITS, e);
                });

                conn.event(CHECKOUT).subscribe(async event => {
                    const repo = await this._getOrLoadRepo(event.branch, true);

                    console.log(
                        `[CausalRepoServer] Checking out ${event.commit} on ${
                            event.branch
                        }`
                    );
                    const current = repo.currentCommit;
                    await repo.reset(event.commit);
                    await this._stage.clearStage(event.branch);
                    const after = repo.currentCommit;

                    this._sendDiff(current, after, event.branch);
                });

                conn.event(RESTORE).subscribe(async event => {
                    const repo = await this._getOrLoadRepo(event.branch, true);

                    console.log(
                        `[CausalRepoServer] Restoring ${event.commit} on ${
                            event.branch
                        }`
                    );

                    if (repo.hasChanges()) {
                        await this._commitToRepo(
                            {
                                branch: event.branch,
                                message: 'Save before restore',
                            },
                            repo
                        );
                    }

                    const current = repo.currentCommit;
                    const [oldCommit] = await this._store.getObjects([
                        event.commit,
                    ]);
                    if (!oldCommit || oldCommit.type !== 'commit') {
                        console.log(
                            `[CausalRepoServer] Could not restore to ${
                                event.commit
                            } because it does not exist!`
                        );
                        return;
                    }
                    const newCommit = commit(
                        `Restore to ${event.commit}`,
                        new Date(),
                        oldCommit.index,
                        current ? current.commit : null
                    );
                    await storeData(this._store, [newCommit]);
                    await repo.reset(newCommit);
                    const after = repo.currentCommit;

                    this._sendCommits(event.branch, [newCommit]);
                    this._sendDiff(current, after, event.branch);
                });

                conn.event(SEND_EVENT).subscribe(async event => {
                    const info = infoForBranch(event.branch);
                    const connectedDevices = this._deviceManager.getConnectedDevices(
                        info
                    );
                    const devices = connectedDevices.map(
                        d => [d, d.extra.device as DeviceInfo] as const
                    );

                    let finalAction: RemoteAction;
                    if (
                        event.action.deviceId ||
                        event.action.sessionId ||
                        event.action.username
                    ) {
                        finalAction = event.action;
                    } else if (this.defaultDeviceSelector) {
                        finalAction = {
                            ...event.action,
                            ...this.defaultDeviceSelector,
                        };
                    }

                    if (!finalAction) {
                        return;
                    }
                    const targetedDevices = devicesForEvent(
                        finalAction,
                        devices
                    );
                    const dEvent = deviceEvent(conn.device, finalAction.event);
                    sendToDevices(targetedDevices, RECEIVE_EVENT, {
                        branch: event.branch,
                        action: dEvent,
                    });
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
                    console.log(`[CausalRepoServer] Watch Devices`);
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
                                device: device.extra.device,
                            });
                        }
                    }
                });

                conn.event(BRANCH_INFO).subscribe(async branch => {
                    const branches = await this._store.getBranches(branch);
                    const exists = branches.some(b => b.name === branch);

                    conn.send(BRANCH_INFO, {
                        branch: branch,
                        exists: exists,
                    });
                });

                conn.event(BRANCHES).subscribe(async () => {
                    const branches = await this._store.getBranches(null);

                    conn.send(BRANCHES, {
                        branches: branches.map(b => b.name),
                    });
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

    private _sendDiff(current: CommitData, after: CommitData, branch: string) {
        const delta = calculateCommitDiff(current, after);
        const info = infoForBranch(branch);
        const devices = this._deviceManager.getConnectedDevices(info);
        let ret: AddAtomsEvent = {
            branch: branch,
            atoms: [...delta.additions.values()],
            removedAtoms: [...delta.deletions.keys()],
        };
        sendToDevices(devices, ADD_ATOMS, ret);
    }

    private async _commitToRepo(event: CommitEvent, repo: CausalRepo) {
        console.log(
            `[CausalRepoServer] Committing '${event.branch}' with message '${
                event.message
            }'...`
        );
        const commit = await repo.commit(event.message);
        if (commit) {
            await this._stage.clearStage(event.branch);
            console.log(`[CausalRepoServer] Committed.`);
            this._sendCommits(event.branch, [commit]);
        } else {
            console.log(`[CausalRepoServer] No Commit Created.`);
        }
    }

    private _sendCommits(branch: string, commits: CausalRepoCommit[]) {
        const info = infoForBranchCommits(branch);
        const devices = this._deviceManager.getConnectedDevices(info);
        let e: AddCommitsEvent = {
            branch: branch,
            commits: commits,
        };
        sendToDevices(devices, ADD_COMMITS, e);
    }

    private _sendConnectedToBranch(
        device: DeviceConnection<Connection>,
        branch: string
    ) {
        const info = devicesInfo();
        const devices = this._deviceManager.getConnectedDevices(info);
        sendToDevices(devices, DEVICE_CONNECTED_TO_BRANCH, {
            branch: branch,
            device: device.extra.device,
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
            device: device.extra.device,
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
        if (repo && repo.hasChanges()) {
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
            repo.addMany(stage.additions);
            const hashes = Object.keys(stage.deletions);
            repo.removeMany(hashes);

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

function infoForBranchCommits(branch: any): RealtimeChannelInfo {
    return {
        id: `${branch}-commits`,
        type: 'aux-branch-commits',
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
