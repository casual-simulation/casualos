import * as io from 'socket.io-client';
import { Observable, fromEventPattern, merge } from 'rxjs';
import { ChannelConnector, ChannelConnectionRequest, ChannelConnection, Event, ChannelInfo, BaseConnector } from '../../../common/channels-core';
import { StateStore } from '../../../common/channels-core/StateStore';
import { SocketManager } from 'WebClient/SocketManager';
import { map, startWith } from 'rxjs/operators';
import { socketEvent } from './Utils';

export class SocketIOConnector extends BaseConnector {
    private _socket: typeof io.Socket;

    constructor(socket: typeof io.Socket) {
        super();
        this._socket = socket;
    }

    connectToChannel<T>(connection_request: ChannelConnectionRequest<T>): Promise<ChannelConnection<T>> {
        let helper = this.newConnection(connection_request);

        let connected = socketEvent<void>(this._socket, 'connect').pipe(map(() => true));
        let disconnected = socketEvent<void>(this._socket, 'disconnect').pipe(map(() => false));
        let connectionStates = merge(connected, disconnected).pipe(startWith(this._socket.connected));
        helper.setConnectionStateObservable(connectionStates);
        helper.setGetRemoteServerStateFunction(() => {
            return new Promise<T>((resolve, reject) => {
                this._socket.emit('join_server', connection_request.info, (err: any, info: ChannelInfo, state: T) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(state);
                    }
                });
            });
        });
        if (typeof localStorage !== 'undefined') {
            helper.setSaveStateFunction((key, state) => {
                localStorage.setItem(key, JSON.stringify(state));
            });
            helper.setGetStateFunction((key) => {
                const val = localStorage.getItem(key);
                if (val !== null) {
                    return JSON.parse(val);
                } else {
                    return undefined;
                }
            });
        }
        
        let eventName = this._eventName(connection_request.info);
        let socketEvents = socketEvent<Event>(this._socket, eventName);
        helper.setServerEvents(<any>socketEvents);
        helper.setEmitToServerFunction(event => {
            return new Promise((resolve, reject) => {
                try {
                    this._socket.emit(this._eventName(connection_request.info), event, () => {
                        resolve(null);
                    });
                } catch(ex) {
                    reject(ex);
                }
            });
        });
        helper.onUnsubscribe.subscribe(() => {
            this._socket.emit('leave_server', connection_request.info.id, (err: any) => {});
        });

        return Promise.resolve(helper.build());
    }

    private _eventName(info: ChannelInfo) {
        return `new_event_${info.id}`;
    }
}
