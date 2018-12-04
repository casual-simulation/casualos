import * as Http from 'http';
import * as express from 'express';
import * as bodyParser from 'body-parser';
import * as SocketIO from 'socket.io';
import { SocketIOChannelServer } from './channels';
import { ChannelClient } from 'common/channels-core';
import { ChannelServer, ChannelServerConfig } from './ChannelServer';
import { Config as GitConfig, RealtimeServer } from './RealtimeRepo/realtime-server';

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
    channels: ChannelServerConfig,
    git: GitConfig
};

/**
 * Defines a class that represents a fully featured SO4 server.
 */
export class Server {

    _app: express.Express;
    _http: Http.Server;
    _socket: SocketIO.Server;
    _channelServer: ChannelServer;
    _realtimeServer: RealtimeServer;
    _config: Config;

    constructor(config: Config) {
        this._config = config;
        this._app = express();
        this._http = new Http.Server(this._app);
        this._socket = SocketIO(this._http, config.socket);

        this._channelServer = new ChannelServer(config.channels);
        this._realtimeServer = new RealtimeServer(config.git);
    }

    async configure() {
        this._app.use(bodyParser.json());
        await this._channelServer.configure(this._app, this._socket);
        this._realtimeServer.configure(this._app, this._socket);

        this._app.use('/', express.static(this._config.client.dist));
    }

    start() {
        this._http.listen(this._config.httpPort, () => console.log(`Example app listening on port ${this._config.httpPort}!`));
    }
};