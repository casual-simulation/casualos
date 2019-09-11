import { Config } from './config';
import express, { Handler } from 'express';
import * as bodyParser from 'body-parser';
import { verify } from 'jsonwebtoken';
import { randomBytes } from 'crypto';
import fs, { renameSync } from 'fs';
import { promisify } from 'util';
import { restElement } from '@babel/types';

const appendFile = promisify(fs.appendFile);
const mkdir = promisify(fs.mkdir);
const truncate = promisify(fs.truncate);

export const asyncMiddleware: (fn: Handler) => Handler = (fn: Handler) => {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(er => {
            const err: AxiosError = er;
            if (err.response && err.response.data) {
                console.error(
                    'An Axios request failed.',
                    err,
                    err.response.data
                );
            }

            next(er);
        });
    };
};

export class Server {
    private _app: express.Express;
    private _config: Config;

    constructor(config: Config) {
        this._config = config;
        this._app = express();
    }

    start() {
        this._app.listen(this._config.httpPort);
    }

    async configure() {
        if (this._config.proxy && this._config.proxy.trust) {
            this._app.set('trust proxy', this._config.proxy.trust);
        }

        this._app.use(bodyParser.json());

        this._app.post(
            '/session',
            asyncMiddleware(async (req, res) => {
                const token = req.body.token;

                if (!token) {
                    return res.sendStatus(400);
                }

                try {
                    const data: any = verify(token, this._config.secret);
                    const publicKey = data.publicKey;

                    if (!publicKey) {
                        return res.sendStatus(400);
                    }

                    const username = randomBytes(16).toString('hex');

                    let line = `${publicKey} ${req.ip}`;
                    const dir = `/home/${username}/.ssh/`;
                    const path = `${dir}/authorized_keys`;

                    console.log(
                        `[Server] User has valid public key. Adding to their ${path}...`
                    );

                    await mkdir(path, {
                        recursive: true,
                    });
                    await appendFile(path, line);

                    console.log('[Server] Added.');

                    setTimeout(() => {
                        console.log(
                            `[Server] Time is up. Truncating ${path}...`
                        );
                        truncate(path, 0);
                    }, this._config.loginTimeout * 1000);

                    res.send({
                        username: username,
                        publicKey: publicKey,
                    });
                } catch (ex) {
                    return res.sendStatus(403);
                }
            })
        );
    }
}
