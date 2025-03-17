import type { Config } from './config';
import type { Handler } from 'express';
import express from 'express';
import * as bodyParser from 'body-parser';
import { Server as HttpServer, IncomingMessage } from 'http';

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

    constructor(config: Config) {
        this._config = config;
        this._app = express();
        this._http = new HttpServer(this._app);
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
        this._app.all('/:dimension/:server', (req, res) => {
            const server: string = req.params.server;
            const dimension: string = req.params.dimension;
            const serverEncoded = encodeURIComponent(server);
            console.log('Redirecting to player:', server, dimension);

            if (dimension.startsWith('*')) {
                const dimensionEncoded = encodeURIComponent(dimension.slice(1));
                res.redirect(
                    `https://${this._config.target.domain}:${this._config.target.port}?server=${serverEncoded}&sheetPortal=${dimensionEncoded}`
                );
            } else {
                const dimensionEncoded = encodeURIComponent(dimension);
                res.redirect(
                    `https://${this._config.target.domain}:${this._config.target.port}?server=${serverEncoded}&pagePortal=${dimensionEncoded}`
                );
            }
        });
    }
}
