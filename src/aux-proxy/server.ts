import { Config } from './config';
import express, { Handler } from 'express';
import * as bodyParser from 'body-parser';
import { promisify } from 'util';
import { verify } from 'jsonwebtoken';
import { WebSocketServer, requestUrl } from '@casual-simulation/tunnel';
import { Server as HttpServer, IncomingMessage } from 'http';
import { Socket } from 'net';
import HttpProxy from 'http-proxy';

export const asyncMiddleware: (fn: Handler) => Handler = (fn: Handler) => {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(er => {
            next(er);
        });
    };
};

export class Server {
    private _http: HttpServer;
    private _app: express.Express;
    private _config: Config;
    private _proxy: HttpProxy;

    private _hostMap: Map<string, number> = new Map();

    constructor(config: Config) {
        this._config = config;
        this._app = express();
        this._http = new HttpServer(this._app);
        this._proxy = HttpProxy.createProxyServer();
    }

    start() {
        this._app.listen(this._config.httpPort);
        console.log('[Server] Listening on port ' + this._config.httpPort);
    }

    async configure() {
        if (this._config.proxy && this._config.proxy.trust) {
            this._app.set('trust proxy', this._config.proxy.trust);
        }

        this._app.use(bodyParser.json());

        const server = new WebSocketServer(this._http, {
            autoUpgrade: false,
        });

        server.acceptTunnel = r => {
            if (r.direction === 'reverse') {
                const token = r.authorization;
                try {
                    const v = verify(token, this._config.secret);
                    return true;
                } catch (e) {
                    return false;
                    e;
                }
            } else if (r.direction === 'connect') {
                return true;
            } else {
                return false;
            }
        };

        server.tunnelAccepted.subscribe(r => {
            if (r.direction === 'reverse') {
                const decoded: { key: string } = <any>(
                    verify(r.authorization, this._config.secret)
                );

                const host = decoded.key.substring(0, 32);
                const external = `external-${host}`;
                this._hostMap.set(external, r.localPort);
            }
        });

        this._app.use('*', (req, res) => {
            const host = req.hostname;
            const mapped = this._hostMap.get(host);

            if (mapped) {
                this._proxy.web(req, res, {
                    target: `http://127.0.0.1:${mapped}`,
                });
            } else {
                res.sendStatus(404);
            }
        });

        this._http.on(
            'upgrade',
            (request: IncomingMessage, socket: Socket, head: Buffer) => {
                const url = requestUrl(request, 'https');

                const mapped = this._hostMap.get(url.host);
                if (mapped) {
                    console.log(
                        '[Server] Found host for request. Forwarding...'
                    );
                    this._proxy.ws(request, socket, head, {
                        target: `ws://127.0.0.1:${mapped}`,
                    });
                } else {
                    server.upgradeRequest(request, socket, head);
                }
            }
        );

        server.listen();
    }
}
