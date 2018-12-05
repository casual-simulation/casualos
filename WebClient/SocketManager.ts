import * as io from 'socket.io-client';
import {Observable, Subject, BehaviorSubject, Observer} from 'rxjs';
import {filter, switchMap} from 'rxjs/operators';
import {appManager} from './AppManager';

import {ChannelClient, StoreFactory, ChannelConnection, ChannelInfo} from 'common/channels-core';
import {SocketIOConnector} from './channels';
import {
    FileEvent,
    FilesState,
    UIEvent,
    UIState,
    storeFactory,
    channelTypes,
} from 'common';

export class SocketManager {
    private _socket: SocketIOClient.Socket;
    private _connector: SocketIOConnector;
    private _client: ChannelClient;
    private _files: ChannelConnection<FilesState>;
    private _ui: ChannelConnection<UIState>;

    get files(): ChannelConnection<FilesState> {
        return this._files;
    }

    get ui(): ChannelConnection<UIState> {
        return this._ui;
    }

    constructor() {
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
        this._client = new ChannelClient(this._connector, storeFactory);

        console.log('[SocketManager] Getting files channel...');
        this._files = await this._client.getChannel<FilesState>({
            id: 'files',
            type: channelTypes.files,
            name: 'Files!'
        }).subscribe();
        console.log('[SocketManager] Connected to files channel.');

        console.log('[SocketManager] Getting UI channel...');

        this._ui = await this._client.getChannel<UIState>({
            id: `${appManager.user.username}-ui`,
            type: channelTypes.ui,
            name: `${appManager.user.username}'s UI`
        }).subscribe();

        // const uiChannels = appManager.userObservable
        //     .pipe(
        //         filter(u => u !== null),
        //         switchMap(user => this.getChannel<UIState>({
        //             id: `${user.username}-ui`,
        //             type: channelTypes.ui,
        //             name: `${user.username}'s UI`
        //         }))
        //     );
        
        // uiChannels.subscribe(this._ui);

        console.log('[SocketManager] Connected to UI channel.');
    }

    getChannel<T>(info: ChannelInfo): Observable<ChannelConnection<T>> {
        return Observable.create((observer: Observer<ChannelConnection<T>>) => {
            let connection: ChannelConnection<T>;
            const channel = this._client.getChannel<T>(info);
            channel.subscribe()
                .then(c => {
                    connection = c;
                    observer.next(connection);
                }).catch(ex => {
                    observer.error(ex);
                });

            return () => {
                if (connection) {
                    connection.unsubscribe();
                }
            };
        });
    }
}

export const socketManager = new SocketManager();