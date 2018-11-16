import * as Http from 'http';
import * as express from 'express';
import * as SocketIO from 'socket.io';
import { RealtimeServer, Config as RealtimeConfig } from './RealtimeRepo/realtime-server';

/**
 * The server config.
 */
export interface Config {
    socket: SocketIO.ServerOptions,
    socketPort: number,
    httpPort: number,
    client: {
        dist: string;
    },
    git: RealtimeConfig
};

/**
 * Defines a class that represents a fully featured SO4 server.
 */
export class Server {

    _app: express.Express;
    _http: Http.Server;
    _socket: SocketIO.Server;
    _repoServer: RealtimeServer;
    _config: Config;

    constructor(config: Config) {
        this._config = config;
        this._app = express();
        this._http = new Http.Server(this._app);
        this._socket = SocketIO(this._http, config.socket);
        this._repoServer = new RealtimeServer(config.git);
    }

    configure() {
        this._repoServer.configure(this._app, this._socket);
        this._app.use('/', express.static(this._config.client.dist));
    }

    start() {
        this._socket.attach(this._config.socketPort);
        this._app.listen(this._config.httpPort, () => console.log(`Example app listening on port ${this._config.httpPort}!`));
    }
};