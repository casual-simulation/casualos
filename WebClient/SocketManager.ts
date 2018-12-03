import * as io from 'socket.io-client';
import {Observable, Subject} from 'rxjs';
import {appManager} from './AppManager';

import {ChannelClient, StoreFactory, ChannelConnection} from 'common/channels-core';
import {SocketIOConnector} from './channels';
import { reducer, FilesStateStore, FileEvent, FilesState } from 'common/FilesChannel';

const factory = new StoreFactory({
    files: () => new FilesStateStore({})
});

export class SocketManager {
    private _socket: SocketIOClient.Socket;
    private _connector: SocketIOConnector;
    private _client: ChannelClient;
    private _connection: ChannelConnection<FilesState>;
    private _events: Subject<FileEvent>;

    get events(): Observable<FileEvent> {
        return this._events;
    }

    get state(): FilesState {
        if (this._connection) {
            return this._connection.store.state();
        } else {
            return {};
        }
    }

    emit(event: FileEvent) {
        if (this._connection) {
            this._connection.emit(event);
        }
    }

    constructor() {
        this._events = new Subject<FileEvent>();
    }

    async init() {
        console.log('[SocketManager] Starting...');
        this._socket = io({
        });

        this._socket.on('connect', () => {
            console.log('[SocketManager] Connected.');
        });

        this._socket.on('disconnect', () => {
            console.log('[SocketManger] Disconnected.');
        })

        this._connector = new SocketIOConnector(this._socket);
        this._client = new ChannelClient(this._connector, factory);

        console.log('[SocketManager] Getting files channel...');
        this._connection = await this._client.getChannel<FilesState>({
            id: 'files',
            type: 'files',
            name: 'Files!'
        }).subscribe();
        console.log('[SocketManager] Connected to files channel.');

        this._connection.events.subscribe(this._events);
    }
}

export const socketManager = new SocketManager();