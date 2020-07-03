import {
    DeviceInfo,
    RemoteAction,
    RealtimeChannelInfo,
    SESSION_ID_CLAIM,
    device as deviceEvent,
    DeviceSelector,
    RemoteActionResult,
    deviceResult,
    RemoteActionError,
    deviceError,
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
    GenericSession,
    CausalRepoMessageHandlerMethods,
    UNWATCH_BRANCHES,
    UNWATCH_DEVICES,
    UNWATCH_COMMITS,
    GET_BRANCH,
    DEVICES,
    MemoryCausalRepoStore,
    WatchBranchEvent,
    WATCH_BRANCH_DEVICES,
    UNWATCH_BRANCH_DEVICES,
    BRANCHES_STATUS,
    COMMIT_CREATED,
} from '@casual-simulation/causal-trees/core2';
import { ConnectionServer, Connection } from './ConnectionServer';
import { devicesForEvent } from './DeviceManagerHelpers';
import { map, concatMap } from 'rxjs/operators';
import { Observable, merge } from 'rxjs';
import orderBy from 'lodash/orderBy';

/**
 * Defines a class that is able to serve causal repos in realtime.
 */
export class CausalRepoServer {
    private _connectionServer: ConnectionServer;
    private _deviceManager: DeviceManager;
    private _store: CausalRepoStore;
    private _stage: CausalRepoStageStore;
    private _repos: Map<string, CausalRepo>;
    private _repoPromises: Map<string, Promise<CausalRepo>>;
    /**
     * The map of branch and device IDs to their site ID.
     */
    private _branchSiteIds: Map<string, string>;
    private _branches: Map<string, WatchBranchEvent>;

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
        this._repoPromises = new Map();
        this._branches = new Map();
        this._branchSiteIds = new Map();
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

                handleEvents(conn, {
                    [WATCH_BRANCH]: async event => {
                        if (!event) {
                            console.log(
                                '[CasualRepoServer] Trying to watch branch with a null event!'
                            );
                            return;
                        }
                        const branch = event.branch;
                        const info = infoForBranch(branch);
                        await this._deviceManager.joinChannel(device, info);
                        let currentBranch = this._branches.get(branch);
                        if (!currentBranch) {
                            this._branches.set(branch, event);
                        }
                        if (!event.temporary && event.siteId) {
                            this._branchSiteIds.set(
                                branchSiteIdKey(branch, device.id),
                                event.siteId
                            );
                            await this._store.logSite(
                                event.branch,
                                event.siteId,
                                'WATCH'
                            );
                        }
                        const repo = await this._getOrLoadRepo(
                            branch,
                            true,
                            event.temporary
                        );
                        const atoms = repo.getAtoms();

                        this._sendConnectedToBranch(device, branch);
                        conn.send(ADD_ATOMS, {
                            branch: branch,
                            atoms: atoms,
                        });
                    },
                    [GET_BRANCH]: async branch => {
                        const info = infoForBranch(branch);
                        const repo = await this._getOrLoadRepo(
                            branch,
                            true,
                            false
                        );
                        const atoms = repo.getAtoms();
                        conn.send(ADD_ATOMS, {
                            branch: branch,
                            atoms: atoms,
                        });
                        await this._tryUnloadBranch(info);
                    },
                    [ADD_ATOMS]: async event => {
                        if (!event || !event.branch) {
                            return;
                        }

                        const branchEvent = this._branches.get(event.branch);
                        const isTemp = branchEvent
                            ? branchEvent.temporary
                            : false;

                        const repo = await this._getOrLoadRepo(
                            event.branch,
                            false,
                            isTemp
                        );

                        let added: Atom<any>[];
                        let removed: Atom<any>[];

                        if (event.atoms) {
                            added = repo.add(...event.atoms);

                            if (!isTemp) {
                                await this._stage.addAtoms(event.branch, added);
                                await storeData(
                                    this._store,
                                    event.branch,
                                    null,
                                    added
                                );
                            }
                        }
                        if (event.removedAtoms) {
                            removed = repo.remove(...event.removedAtoms);

                            if (!isTemp) {
                                await this._stage.removeAtoms(
                                    event.branch,
                                    removed
                                );
                            }
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
                    },
                    [COMMIT]: async event => {
                        const repo = await this._getOrLoadRepo(
                            event.branch,
                            false,
                            false
                        );
                        if (!repo) {
                            return;
                        }

                        if (repo.hasChanges()) {
                            await this._commitToRepo(event, repo);
                            sendToDevices([device], COMMIT_CREATED, {
                                branch: event.branch,
                            });
                        }
                    },
                    [WATCH_COMMITS]: async branch => {
                        const info = infoForBranchCommits(branch);
                        await this._deviceManager.joinChannel(device, info);

                        const repo = await this._getOrLoadRepo(
                            branch,
                            false,
                            false
                        );
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
                    },
                    [CHECKOUT]: async event => {
                        const repo = await this._getOrLoadRepo(
                            event.branch,
                            true,
                            false
                        );

                        console.log(
                            `[CausalRepoServer] Checking out ${
                                event.commit
                            } on ${event.branch}`
                        );
                        const current = repo.currentCommit;
                        await repo.reset(event.commit);
                        await this._stage.clearStage(event.branch);
                        const after = repo.currentCommit;

                        this._sendDiff(current, after, event.branch);
                    },
                    [RESTORE]: async event => {
                        const repo = await this._getOrLoadRepo(
                            event.branch,
                            true,
                            false
                        );

                        console.log(
                            `[CausalRepoServer] Restoring ${event.commit} on ${
                                event.branch
                            }`
                        );

                        if (repo.hasChanges()) {
                            await this._commitToRepo(
                                {
                                    branch: event.branch,
                                    message: `Save ${
                                        event.branch
                                    } before restore`,
                                },
                                repo
                            );
                        }

                        const current = repo.currentCommit;
                        const oldCommit = await this._store.getObject(
                            event.commit
                        );
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
                        await storeData(this._store, event.branch, null, [
                            newCommit,
                        ]);
                        await repo.reset(newCommit);
                        const after = repo.currentCommit;

                        this._sendCommits(event.branch, [newCommit]);
                        this._sendDiff(current, after, event.branch);
                    },
                    [SEND_EVENT]: async event => {
                        const info = infoForBranch(event.branch);
                        const connectedDevices = this._deviceManager.getConnectedDevices(
                            info
                        );
                        const devices = connectedDevices.map(
                            d => [d, d.extra.device as DeviceInfo] as const
                        );

                        let finalAction:
                            | RemoteAction
                            | RemoteActionResult
                            | RemoteActionError;
                        if (
                            event.action.deviceId ||
                            event.action.sessionId ||
                            event.action.username ||
                            (typeof event.action.broadcast !== 'undefined' &&
                                event.action.broadcast !== null)
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

                        const dEvent =
                            finalAction.type === 'remote'
                                ? deviceEvent(
                                      conn.device,
                                      finalAction.event,
                                      finalAction.taskId
                                  )
                                : finalAction.type === 'remote_result'
                                ? deviceResult(
                                      conn.device,
                                      finalAction.result,
                                      finalAction.taskId
                                  )
                                : deviceError(
                                      conn.device,
                                      finalAction.error,
                                      finalAction.taskId
                                  );
                        sendToDevices(targetedDevices, RECEIVE_EVENT, {
                            branch: event.branch,
                            action: dEvent,
                        });
                    },
                    [UNWATCH_BRANCH]: async branch => {
                        const info = infoForBranch(branch);
                        const devices = this._deviceManager.getConnectedDevices(
                            info
                        );
                        if (devices.length <= 0) {
                            return;
                        }
                        await this._deviceManager.leaveChannel(device, info);

                        await this._logDisconnectedFromBranch(device, branch);
                        this._sendDisconnectedFromBranch(device, branch);
                        await this._tryUnloadBranch(info);
                    },
                    [WATCH_BRANCHES]: async () => {
                        const info = branchesInfo();
                        await this._deviceManager.joinChannel(device, info);

                        for (let branch of this._repos.keys()) {
                            conn.send(LOAD_BRANCH, loadBranchEvent(branch));
                        }
                    },
                    [WATCH_DEVICES]: async () => {
                        console.log(`[CausalRepoServer] Watch Devices`);
                        const info = devicesInfo();
                        await this._deviceManager.joinChannel(device, info);

                        const branches = this._repos.keys();
                        for (let branch of branches) {
                            const branchEvent = this._branches.get(branch);
                            if (!branchEvent) {
                                continue;
                            }
                            const branchInfo = infoForBranch(branch);
                            const devices = this._deviceManager.getConnectedDevices(
                                branchInfo
                            );
                            for (let device of devices) {
                                conn.send(DEVICE_CONNECTED_TO_BRANCH, {
                                    branch: branchEvent,
                                    device: device.extra.device,
                                });
                            }
                        }
                    },
                    [WATCH_BRANCH_DEVICES]: async branch => {
                        console.log(
                            `[CausalRepoServer] Watch Devices for branch: ${branch}`
                        );
                        const info = devicesBranchInfo(branch);
                        await this._deviceManager.joinChannel(device, info);

                        const branches = this._repos.keys();
                        const branchInfo = infoForBranch(branch);
                        const devices = this._deviceManager.getConnectedDevices(
                            branchInfo
                        );
                        const branchEvent = this._branches.get(branch);
                        if (!branchEvent) {
                            return;
                        }
                        for (let device of devices) {
                            conn.send(DEVICE_CONNECTED_TO_BRANCH, {
                                branch: branchEvent,
                                device: device.extra.device,
                            });
                        }
                    },
                    [BRANCH_INFO]: async branch => {
                        const branches = await this._store.getBranches(branch);
                        const exists = branches.some(b => b.name === branch);

                        conn.send(BRANCH_INFO, {
                            branch: branch,
                            exists: exists,
                        });
                    },
                    [BRANCHES]: async () => {
                        const branches = await this._store.getBranches(null);

                        conn.send(BRANCHES, {
                            branches: branches.map(b => b.name),
                        });
                    },
                    [BRANCHES_STATUS]: async () => {
                        const branches = await this._store.getBranches(null);
                        const sorted = orderBy(
                            branches,
                            [b => b.time || new Date(0, 1, 1)],
                            ['desc']
                        );

                        conn.send(BRANCHES_STATUS, {
                            branches: sorted.map(b => ({
                                branch: b.name,
                                lastUpdateTime: b.time || null,
                            })),
                        });
                    },
                    [DEVICES]: async branch => {
                        let devices: DeviceConnection<any>[];
                        if (typeof branch !== 'undefined' && branch !== null) {
                            const info = infoForBranch(branch);
                            devices = this._deviceManager.getConnectedDevices(
                                info
                            );
                        } else {
                            devices = this._deviceManager.connectedDevices;
                        }

                        conn.send(DEVICES, {
                            devices: devices.map(d => d.extra.device),
                        });
                    },
                    [UNWATCH_BRANCHES]: async () => {},
                    [UNWATCH_DEVICES]: async () => {},
                    [UNWATCH_BRANCH_DEVICES]: async branch => {
                        const info = devicesBranchInfo(branch);
                        await this._deviceManager.leaveChannel(device, info);
                    },
                    [UNWATCH_COMMITS]: async () => {},
                }).subscribe();

                conn.disconnect.subscribe(async () => {
                    var channels = this._deviceManager.getConnectedChannels(
                        device
                    );
                    this._deviceManager.disconnectDevice(device);

                    for (let channel of channels) {
                        await this._logDisconnectedFromBranch(
                            device,
                            channel.info.id
                        );
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
        console.log(
            `[CausalRepoServer] Device ${
                device.id
            } connected to branch: ${branch}`
        );
        const branchEvent = this._branches.get(branch);
        if (!branchEvent) {
            throw new Error(
                'Unable to send connected to branch event because the branch does not exist!'
            );
        }
        const event = {
            branch: branchEvent,
            device: device.extra.device,
        };
        let info = devicesInfo();
        let devices = this._deviceManager.getConnectedDevices(info);
        sendToDevices(devices, DEVICE_CONNECTED_TO_BRANCH, event);

        info = devicesBranchInfo(branch);
        devices = this._deviceManager.getConnectedDevices(info);
        sendToDevices(devices, DEVICE_CONNECTED_TO_BRANCH, event);
    }

    private _sendDisconnectedFromBranch(
        device: DeviceConnection<Connection>,
        branch: string
    ) {
        console.log(
            `[CausalRepoServer] Device ${
                device.id
            } disconnected from branch: ${branch}`
        );
        const event = {
            branch: branch,
            device: device.extra.device,
        };
        let info = devicesInfo();
        let devices = this._deviceManager.getConnectedDevices(info);
        sendToDevices(devices, DEVICE_DISCONNECTED_FROM_BRANCH, event);

        info = devicesBranchInfo(branch);
        devices = this._deviceManager.getConnectedDevices(info);
        sendToDevices(devices, DEVICE_DISCONNECTED_FROM_BRANCH, event);
    }

    private async _logDisconnectedFromBranch(
        device: DeviceConnection<Connection>,
        branch: string
    ) {
        const siteId = this._branchSiteIds.get(
            branchSiteIdKey(branch, device.id)
        );
        if (siteId) {
            this._store.logSite(branch, siteId, 'UNWATCH');
        }
        this._branchSiteIds.delete(branchSiteIdKey(branch, device.id));
    }

    private async _tryUnloadBranch(info: RealtimeChannelInfo) {
        const devices = this._deviceManager.getConnectedDevices(info);
        if (devices.length <= 0) {
            await this._unloadBranch(info.id);
            this._branches.delete(info.id);
        }
    }

    private async _unloadBranch(branch: string) {
        console.log(`[CausalRepoServer] Unloading branch: ${branch}`);
        const repo = await this._repoPromises.get(branch);
        this._repoPromises.delete(branch);
        if (repo && repo.hasChanges()) {
            console.log(
                `[CausalRepoServer] Committing '${branch}' before unloading...`
            );
            const c = await repo.commit(`Save ${branch} before unload`);

            if (c) {
                console.log(
                    `[CausalRepoServer] Committed '${branch}: ${c.hash}'!`
                );
                await this._stage.clearStage(branch);
            } else {
                console.log(
                    `[CausalRepoServer] No commit created due to no changes.`
                );
            }
        }
        this._repos.delete(branch);
        this._branchUnloaded(branch);
    }

    private async _getOrLoadRepo(
        branch: string,
        createBranch: boolean,
        temporary: boolean
    ) {
        let repo = this._repos.get(branch);

        if (!repo) {
            let promise: Promise<CausalRepo>;
            if (!temporary) {
                promise = this._loadRepo(branch, createBranch);
            } else {
                promise = this._createEmptyRepo(branch);
            }

            this._repoPromises.set(branch, promise);

            repo = await promise;

            this._repos.set(branch, repo);
            this._branchLoaded(branch);
        }

        return repo;
    }

    private async _createEmptyRepo(branch: string) {
        console.log(`[CausalRepoServer] Creating temp branch: ${branch}`);
        const emptyStore = new MemoryCausalRepoStore();
        const repo = new CausalRepo(emptyStore);
        await repo.checkout(branch, {
            createIfDoesntExist: {
                hash: null,
            },
        });

        return repo;
    }

    private async _loadRepo(
        branch: string,
        createBranch: boolean
    ): Promise<CausalRepo> {
        const startTime = process.hrtime();
        try {
            console.log(`[CausalRepoServer] Loading branch: ${branch}`);
            const repo = new CausalRepo(this._store);
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
            return repo;
        } finally {
            const [seconds, nanoseconds] = process.hrtime(startTime);
            console.log(
                `[CausalRepoServer] Loading took %d seconds and %d nanoseconds`,
                seconds,
                nanoseconds
            );
        }
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

function devicesBranchInfo(branch: string): RealtimeChannelInfo {
    return {
        id: `${branch}-devices`,
        type: 'aux-devices',
    };
}

function handleEvents(
    conn: GenericSession,
    handlers: CausalRepoMessageHandlerMethods
): Observable<any> {
    let observables = [] as Observable<readonly [string, any]>[];
    for (let key of Object.keys(handlers)) {
        const obs = conn
            .event<any>(key)
            .pipe(map(value => [key, value] as const));
        observables.push(obs);
    }

    return merge(...observables).pipe(
        concatMap(([event, value]) => {
            const callback = (<any>handlers)[event];
            return callback(value);
        })
    );
}

function branchSiteIdKey(branch: string, deviceId: string): string {
    return `${branch}-${deviceId}`;
}
