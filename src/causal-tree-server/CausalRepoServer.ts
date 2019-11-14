import { DeviceInfo, RemoteAction } from '@casual-simulation/causal-trees';
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

// onConnection
// - onJoin()
//   - onAtom()
//     - broadcast
//

// connection
//   - branch
//      - atom

/**
 * Defines a class that is able to serve
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

            conn.event<string>('join_or_create_branch').subscribe(
                async branch => {
                    const info = infoForBranch(branch);
                    await this._deviceManager.joinChannel(device, info);
                    const repo = await this._getOrLoadRepo(branch, true);
                    const atoms = repo.getAtoms();

                    conn.send('add_atoms', {
                        branch: branch,
                        atoms: atoms,
                    });
                }
            );

            conn.event<AddAtomsEvent>('add_atoms').subscribe(async event => {
                const repo = await this._getOrLoadRepo(event.branch, false);
                repo.add(...event.atoms);

                const info = infoForBranch(event.branch);
                const devices = this._deviceManager.getConnectedDevices(info);
                for (let device of devices) {
                    device.extra.send('add_atoms', {
                        branch: event.branch,
                        atoms: event.atoms,
                    });
                }
            });

            conn.event<string>('leave_branch').subscribe(async branch => {
                const info = infoForBranch(branch);
                await this._deviceManager.leaveChannel(device, info);
            });

            conn.disconnect.subscribe(() => {
                this._deviceManager.disconnectDevice(device);
            });
        });
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
        }

        return repo;
    }
}

export interface AddAtomsEvent {
    branch: string;
    atoms: Atom<any>[];
}

function infoForBranch(branch: any) {
    return {
        id: branch,
        type: 'aux-branch',
    };
}
