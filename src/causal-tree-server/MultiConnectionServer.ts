import { ConnectionServer, Connection } from './ConnectionServer';
import { Subject, never, Observable, merge } from 'rxjs';

export class MultiConnectionServer implements ConnectionServer {
    private _connections: Observable<Connection>;

    get connection() {
        return this._connections;
    }

    constructor(servers: ConnectionServer[]) {
        this._connections = merge(...servers.map(s => s.connection));
    }
}
