import * as Http from 'http';
import express from 'express';
import * as bodyParser from 'body-parser';
import SocketIO from 'socket.io';
import { SocketIOChannelServer } from './channels';
import { ChannelClient } from 'common/channels-core';
import { ChannelServer, ChannelServerConfig } from './ChannelServer';
import { asyncMiddleware } from './utils';

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
    channels: ChannelServerConfig
};

/**
 * Defines a class that represents a fully featured SO4 server.
 */
export class Server {

    _app: express.Express;
    _http: Http.Server;
    _socket: SocketIO.Server;
    _channelServer: ChannelServer;
    _config: Config;

    constructor(config: Config) {
        this._config = config;
        this._app = express();
        this._http = new Http.Server(this._app);
        this._socket = SocketIO(this._http, config.socket);

        this._channelServer = new ChannelServer(config.channels);
    }

    async configure() {
        this._app.use(bodyParser.json());
        await this._channelServer.configure(this._app, this._socket);

        this._app.use('/', express.static(this._config.client.dist));

        this._app.post('/api/users', asyncMiddleware(async (req, res) => {
            const json = req.body;
            const username = json.email.split('@')[0];

            // TODO: Do something like actual user login
            res.send({
                email: json.email,
                username: username,
                name: username
            });
        }));
    }

    start() {
        this._http.listen(this._config.httpPort, () => console.log(`Example app listening on port ${this._config.httpPort}!`));
    }
};