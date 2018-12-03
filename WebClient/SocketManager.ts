import * as io from 'socket.io-client';
import {appManager} from './AppManager';
import {Event} from './Core/Event';

export class SocketManager {
    private _socket: SocketIOClient.Socket;

    init() {
        this._socket = io({

        });

        this._socket.on('connect', () => {
            console.log('[SocketManager] Connected.');
        });

        this._socket.on('disconnect', () => {
            console.log('[SocketManger] Disconnected.');
        })

        this._socket.on('event', (event: Event) => {
            event.remote = true;
            appManager.events.next(event);
        });

        appManager.events.subscribe(event => {
            if (event.remote) {
                return;
            }
            if(event.type === 'commit_added') {
                this._socket.emit('event', event);
            }
        });
    }

}

export const socketManager = new SocketManager();