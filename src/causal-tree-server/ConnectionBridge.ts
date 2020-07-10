import { Connection } from './ConnectionServer';
import {
    ConnectionClient,
    ClientConnectionState,
} from '@casual-simulation/causal-trees/core2';
import { DeviceInfo } from '@casual-simulation/causal-trees';
import { Observable, Subject, never, of } from 'rxjs';
import { filter, map, tap } from 'rxjs/operators';

/**
 * Defines a class that is able to construct a client connection and server connection pair that issues events between themselves.
 * Basically an in-memory transport for events.
 */
export class ConnectionBridge {
    private _serverConnection: ServerConnection;
    private _clientConnection: ClientConnection;

    /**
     * Gets the connection that can be passed to the causal repo server.
     */
    get serverConnection(): Connection {
        return this._serverConnection;
    }

    /**
     * Gets the connection that can be passed to the causal repo client.
     */
    get clientConnection(): ClientConnection {
        return this._clientConnection;
    }

    constructor(device: DeviceInfo) {
        this._serverConnection = new ServerConnection(device);
        this._clientConnection = new ClientConnection(device);

        this._serverConnection.serverEvents
            .pipe(
                tap(e => {
                    // console.log('Sending Server Event: ' + JSON.stringify(e));
                    this._clientConnection.sendServerEvent(e.name, e.data);
                })
            )
            .subscribe();
        this._clientConnection.clientEvents
            .pipe(
                tap(e => {
                    // console.log('Sending Client Event: ' + JSON.stringify(e));
                    this._serverConnection.sendClientEvent(e.name, e.data);
                })
            )
            .subscribe();
    }
}

class ServerConnection implements Connection {
    private _serverEvents = new Subject<ConnectionEvent>();
    private _clientEvents = new Subject<ConnectionEvent>();

    get serverEvents(): Observable<ConnectionEvent> {
        return this._serverEvents;
    }

    device: DeviceInfo;

    constructor(device: DeviceInfo) {
        this.device = device;
    }

    event<T>(event: string): Observable<T> {
        // console.log(`[ServerConnection] Watch event ${event}`);
        return this._clientEvents.pipe(
            filter(e => e.name === event),
            map(e => e.data)
        );
    }

    sendClientEvent(name: string, data: any): void {
        this._clientEvents.next({
            name,
            data,
        });
    }

    get disconnect(): Observable<any> {
        return never();
    }

    send(name: string, data: any): void {
        this._serverEvents.next({
            name,
            data,
        });
    }
}

class ClientConnection implements ConnectionClient {
    private _serverEvents = new Subject<ConnectionEvent>();
    private _clientEvents = new Subject<ConnectionEvent>();
    private _info: DeviceInfo;

    get clientEvents(): Observable<ConnectionEvent> {
        return this._clientEvents;
    }

    /**
     * Gets an observable for the connection state.
     */
    get connectionState(): Observable<ClientConnectionState> {
        return of({
            connected: true,
            info: this._info,
        });
    }

    get isConnected(): boolean {
        return true;
    }

    constructor(info: DeviceInfo) {
        this._info = info;
    }

    /**
     * Gets an observable for events with the given name.
     * @param name The name of the events.
     */
    event<T>(name: string): Observable<T> {
        return this._serverEvents.pipe(
            filter(e => e.name === name),
            map(e => e.data)
        );
    }

    /**
     * Sends an event with the given name and data.
     * @param name The name of the event.
     * @param data The data to send.
     */
    send(name: string, data: any): void {
        this._clientEvents.next({
            name,
            data,
        });
    }

    sendServerEvent(name: string, data: any): void {
        this._serverEvents.next({
            name,
            data,
        });
    }

    /**
     * Tells the connection to disconnect.
     */
    disconnect(): void {}

    /**
     * Tells the connection to (re)connect.
     */
    connect(): void {}
}

interface ConnectionEvent {
    name: string;
    data: any;
}
