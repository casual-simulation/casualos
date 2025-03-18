import type { Config } from './config';
import type { Handler } from 'express';
import express from 'express';
import * as bodyParser from 'body-parser';
import { promisify } from 'util';
import { verify } from 'jsonwebtoken';
import { WebSocketServer, requestUrl } from '@casual-simulation/tunnel';
import type { IncomingMessage } from 'http';
import { Server as HttpServer } from 'http';
import type { Socket } from 'net';
import HttpProxy from 'http-proxy';

export const asyncMiddleware: (fn: Handler) => Handler = (fn: Handler) => {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch((er) => {
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
        this._proxy = HttpProxy.createProxyServer({
            ws: true,
        });
    }

    start() {
        this._http.listen(this._config.httpPort);
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

        server.acceptTunnel = (r) => {
            if (r.direction === 'reverse') {
                const token = r.authorization;
                try {
                    console.log('Verifying token');
                    const v = verify(token, this._config.secret);
                    return true;
                } catch (e) {
                    return false;
                }
            } else if (r.direction === 'connect') {
                return true;
            } else {
                return false;
            }
        };

        server.tunnelAccepted.subscribe((r) => {
            if (r.direction === 'reverse') {
                console.log('Reverse tunnel accepted!');
                const decoded: { key: string } = <any>(
                    verify(r.authorization, this._config.secret)
                );

                const host = decoded.key.substring(0, 32);
                const external = `external-${host}`;
                console.log('Creating host record for: ', external);
                this._hostMap.set(external, r.localPort);
            }
        });

        server.tunnelDropped.subscribe((r) => {
            if (r.direction === 'reverse') {
                console.log('Reverse tunnel closed!');
                const decoded: { key: string } = <any>(
                    verify(r.authorization, this._config.secret)
                );

                const host = decoded.key.substring(0, 32);
                const external = `external-${host}`;
                this._hostMap.delete(external);
            }
        });

        this._http.on(
            'upgrade',
            (request: IncomingMessage, socket: Socket, head: Buffer) => {
                const url = requestUrl(request, 'https');
                const domains = url.hostname.split('.');
                const first = domains[0];
                const mapped = this._hostMap.get(first);
                if (mapped) {
                    const targetUrl = new URL(
                        request.url,
                        `ws://127.0.0.1:${mapped}`
                    );
                    const target = targetUrl.href;
                    console.log(
                        `[Server] Found host for ${first}. Forwarding to ${target}`
                    );
                    this._proxy.ws(request, socket, head, {
                        target: target,
                        ignorePath: true,
                        prependPath: true,
                    });
                } else {
                    console.log(
                        `[Server] Host not found for ${first}, trying to setup tunnel...`
                    );
                    server.upgradeRequest(request, socket, head);
                }
            }
        );

        this._app.use('*', (req, res) => {
            const domains = req.hostname.split('.');
            const host = domains[0];
            const mapped = this._hostMap.get(host);

            if (mapped) {
                const targetUrl = new URL(
                    req.originalUrl,
                    `http://127.0.0.1:${mapped}`
                );
                const target = targetUrl.href;
                console.log(`Forwarding ${host} to ${target}`);
                this._proxy.web(req, res, {
                    // forward
                    target: target,
                    ignorePath: true,
                    prependPath: true,
                });
            } else {
                console.log(`Didnt find host ${host}`);
                res.sendStatus(404);
            }
        });

        server.listen();
    }
}
