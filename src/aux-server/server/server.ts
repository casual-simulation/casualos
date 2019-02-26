import * as Http from 'http';
import express from 'express';
import * as bodyParser from 'body-parser';
import * as path from 'path';
import SocketIO from 'socket.io';
import { ChannelServer, ChannelServerConfig } from './ChannelServer';
import { asyncMiddleware } from './utils';
import { Config, ClientConfig } from './config';
import vhost from 'vhost';

export class ClientServer {
    private _app: express.Express;
    private _config: ClientConfig;

    get app() {
        return this._app;
    }

    get config() {
        return this._config;
    }

    constructor(config: ClientConfig) {
        this._app = express();
        this._config = config;
    }

    configure() {
        this._app.post('/api/users', asyncMiddleware(async (req, res) => {
            const json = req.body;

            let username;

            if (json.email.indexOf('@') >= 0) {
                username = json.email.split('@')[0];
            } else {
                username = json.email;
            }

            // TODO: Do something like actual user login
            res.send({
                email: json.email,
                username: username,
                name: username
            });
        }));

        this._app.use(express.static(this._config.dist));

        this._app.use('*', (req, res) => {
            res.sendFile(path.join(this._config.dist, this._config.index));
        });
    }
}

/**
 * Defines a class that represents a fully featured SO4 server.
 */
export class Server {

    _app: express.Express;
    _http: Http.Server;
    _socket: SocketIO.Server;
    _channelServer: ChannelServer;
    _config: Config;
    _clients: ClientServer[];

    constructor(config: Config) {
        this._config = config;
        this._app = express();
        this._http = new Http.Server(this._app);
        this._config = config;
        this._socket = SocketIO(this._http, config.socket);
        this._clients = this._config.clients.map(c => new ClientServer(c));

        this._channelServer = new ChannelServer(config.channels);
    }

    async configure() {
        this._app.use(bodyParser.json());
        await this._channelServer.configure(this._app, this._socket);

        this._clients.forEach(c => {
            c.configure();

            c.config.domains.forEach(d => {
                this._app.use(vhost(d, c.app));
            });
        });
    }

    start() {
        this._http.listen(this._config.httpPort, () => console.log(`Server listening on port ${this._config.httpPort}!`));
    }
};