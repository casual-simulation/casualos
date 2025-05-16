/* CasualOS is a set of web-based tools designed to facilitate the creation of real-time, multi-user, context-aware interactive experiences.
 *
 * Copyright (c) 2019-2025 Casual Simulation, Inc.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */
import type { Config } from './config';
import type { Handler } from 'express';
import express from 'express';
import * as bodyParser from 'body-parser';
import { Server as HttpServer } from 'http';

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
