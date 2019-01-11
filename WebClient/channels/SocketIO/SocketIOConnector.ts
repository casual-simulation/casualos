import * as io from 'socket.io-client';
import { Observable, fromEventPattern, merge } from 'rxjs';
import { Promise } from 'bluebird';
import { ChannelConnector, ChannelConnectionRequest, ChannelConnection, Event, ChannelInfo, BaseConnector } from '../../../common/channels-core';
import { StateStore } from '../../../common/channels-core/StateStore';
import { SocketManager } from 'WebClient/SocketManager';
import { map } from 'rxjs/operators';

export class SocketIOConnector extends BaseConnector {
    private _socket: typeof io.Socket;

    constructor(socket: typeof io.Socket) {
        super();
        this._socket = socket;
    }

    connectToChannel<T>(connection_request: ChannelConnectionRequest<T>): Promise<ChannelConnection<T>> {
        return new Promise<ChannelConnection<T>>((resolve, reject) => {
            let helper = this.newConnection(connection_request);

            let connected = socketEvent<void>(this._socket, 'connected').pipe(map(() => true));
            let disconnected = socketEvent<void>(this._socket, 'disconnected').pipe(map(() => false));
            let connectionStates = merge(connected, disconnected);
            helper.setConnectionStateObservable(connectionStates);

            this._socket.emit('join_server', connection_request.info, (err: any, info: ChannelInfo, state: T) => {
                if (err) {
                    reject(err);
                } else {
                    connection_request.store.init(state);
                    
                    let eventName = this._eventName(connection_request.info);
                    let socketEvents = socketEvent<Event>(this._socket, eventName);

                    helper.setServerEvents(<any>socketEvents);
                    helper.setEmitToServerFunction(event => {
                        this._socket.emit(this._eventName(info), event);
                    });
                    helper.onUnsubscribe.subscribe(() => {
                        this._socket.emit('leave_server', info.id, (err: any) => {
                        });
                    });
                    
                    resolve(helper.build());
                }
            });
        });
    }

    private _eventName(info: ChannelInfo) {
        return `new_event_${info.id}`;
    }
}

function socketEvent<T>(socket: typeof io.Socket, eventName: string): Observable<T> {
    return fromEventPattern<T>(handler => {
        socket.on(eventName, handler);
    }, handler => {
        socket.off(eventName, handler);
    });
}