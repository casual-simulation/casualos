import { ConnectionServer, Connection } from './ConnectionServer';
import { Observable, of } from 'rxjs';

/**
 * Defines a connection server which always resolves with the given set of connections.
 */
export class FixedConnectionServer implements ConnectionServer {
    private _connections: Connection[];

    get connection(): Observable<Connection> {
        return of(...this._connections);
    }

    constructor(connections: Connection[]) {
        this._connections = connections;
    }
}
