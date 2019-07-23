import { Socket } from 'socket.io';
import { Observable, fromEventPattern } from 'rxjs';

export function socketEvent<T>(
    socket: Socket,
    eventName: string,
    selector: (...args: any[]) => T
): Observable<T> {
    return fromEventPattern<T>(
        handler => {
            socket.on(eventName, handler);
        },
        handler => {
            socket.off(eventName, handler);
        },
        selector
    );
}
