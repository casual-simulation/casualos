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

    constructor() {
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
    }

    async getFilesChannel(): Promise<ChannelConnection<FilesState>> {
        console.log('[SocketManager] Getting files channel...');
        const files = await this._client.getChannel<FilesState>({
            id: 'files',
            type: channelTypes.files,
            name: 'Files!'
        }).subscribe();
        console.log('[SocketManager] Connected to files channel.');

        return files;
    }

    async getUIChannel(): Promise<ChannelConnection<UIState>> {
        console.log('[SocketManager] Getting UI channel...');

        const ui = await this._client.getChannel<UIState>({
            id: `${appManager.user.username}-ui`,
            type: channelTypes.ui,
            name: `${appManager.user.username}'s UI`
        }).subscribe();

        console.log('[SocketManager] Connected to UI channel.');
        return ui;
    }
}
