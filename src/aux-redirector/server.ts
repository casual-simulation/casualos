import { Config } from './config';
import express, { Handler } from 'express';
import * as bodyParser from 'body-parser';
import { Server as HttpServer, IncomingMessage } from 'http';

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
        this._app.all('/:dimension/:story', (req, res) => {
            const story: string = req.params.story;
            const dimension: string = req.params.dimension;
            const storyEncoded = encodeURIComponent(story);
            console.log('Redirecting to player:', story, dimension);

            if (dimension.startsWith('*')) {
                const dimensionEncoded = encodeURIComponent(dimension.slice(1));
                res.redirect(
                    `https://${this._config.target.domain}:${
                        this._config.target.port
                    }?auxStory=${storyEncoded}&sheetPortal=${dimensionEncoded}`
                );
            } else {
                const dimensionEncoded = encodeURIComponent(dimension);
                res.redirect(
                    `https://${this._config.target.domain}:${
                        this._config.target.port
                    }?auxStory=${storyEncoded}&pagePortal=${dimensionEncoded}`
                );
            }
        });
    }
}
