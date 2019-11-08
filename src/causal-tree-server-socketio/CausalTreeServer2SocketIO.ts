import { DeviceInfo, RemoteAction } from '@casual-simulation/causal-trees';
import { Socket, Server } from 'socket.io';
import { DeviceManager } from '@casual-simulation/causal-tree-server/DeviceManager';
import { DeviceManagerImpl } from '@casual-simulation/causal-tree-server/DeviceManagerImpl';
import { DeviceConnection } from '@casual-simulation/causal-tree-server';
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
export class CausalTreeServer2SocketIO {
    private _connectionServer: ConnectionServer;
    private _deviceManager: DeviceManager;
    private _store: CausalRepoStore;

    constructor(server: ConnectionServer, store: CausalRepoStore) {
        this._connectionServer = server;
        this._store = store;
        this._deviceManager = new DeviceManagerImpl();
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

            conn.event<string>('join_branch').subscribe(async branch => {
                const info = {
                    id: branch,
                    type: 'aux-branch',
                };
                await this._deviceManager.joinChannel(device, info);
            });

            conn.disconnect.subscribe(() => {
                this._deviceManager.disconnectDevice(device);
            });
        });
    }
}
