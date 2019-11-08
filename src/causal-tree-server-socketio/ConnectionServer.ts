import { Observable } from 'rxjs';

/**
 * Defines a connection server.
 * That is, a service which provides an observable list of connections.
 */
export interface ConnectionServer {
    /**
     * The observable list of connections.
     */
    connection: Observable<Connection>;
}

/**
 * Defines a connection to a device.
 */
export interface Connection {
    id: string;
    event<T>(event: string): Observable<T>;
    disconnect: Observable<any>;

    send(name: string, data: any): void;
}
