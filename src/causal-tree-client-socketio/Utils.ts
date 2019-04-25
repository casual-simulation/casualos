import { fromEventPattern, Observable } from 'rxjs';
import * as io from 'socket.io-client';

export function socketEvent<T>(
    socket: typeof io.Socket,
    eventName: string
): Observable<T> {
    return fromEventPattern<T>(
        handler => {
            socket.on(eventName, handler);
        },
        handler => {
            socket.off(eventName, handler);
        }
    );
}
