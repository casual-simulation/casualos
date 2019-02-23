import io from 'socket.io-client';
import {Observable, Subject, BehaviorSubject, Observer} from 'rxjs';
import {filter, switchMap} from 'rxjs/operators';
import {appManager} from './AppManager';

import {
    ChannelClient, 
    StoreFactory, 
    ChannelConnection, 
    ChannelInfo,
    FileEvent,
    FilesState,
    storeFactory,
    channelTypes,
} from '@yeti-cgi/aux-common';
import {SocketIOConnector} from './channels';

export class SocketManager {
    private _socket: SocketIOClient.Socket;
    private _connector: SocketIOConnector;
    private _client: ChannelClient;
    private _filesChannel: BehaviorSubject<ChannelConnection<FilesState>> = new BehaviorSubject<ChannelConnection<FilesState>>(null);
    
    // Whether this manager has forced the user to be offline or not.
    private _forcedOffline: boolean = false;

    /**
     * Gets whether the socket manager is forcing the user to be offline or not.
     */
    public get forcedOffline() {
        return this._forcedOffline;
    }

    public get filesChannelObservable() {
        return this._filesChannel;
    }

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

    async getFilesChannel(id?: string): Promise<ChannelConnection<FilesState>> {
        const channelId = id ? `files-${id}` : 'files';
        console.log(`[SocketManager] Getting ${channelId} channel...`);
        const files = await this._client.getChannel<FilesState>({
            id: channelId,
            type: channelTypes.files,
            name: 'Files!'
        }).subscribe();
        console.log('[SocketManager] Connected to files channel.');

        this._filesChannel.next(files);
        return files;
    }

    /**
     * Toggles whether the socket manager should be forcing the user's
     * connection to the server to be offline.
     */
    toggleForceOffline() {
        if (!this._forcedOffline) {
            this._socket.disconnect();
        } else {
            this._socket.connect();
        }
        this._forcedOffline = !this._forcedOffline;
    }
}
