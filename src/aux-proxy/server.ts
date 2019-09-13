import { Config } from './config';
import express, { Handler } from 'express';
import * as bodyParser from 'body-parser';
import { verify } from 'jsonwebtoken';
import { randomBytes } from 'crypto';
import fs, { renameSync } from 'fs';
import { promisify } from 'util';
import { join } from 'path';
import sshpk from 'sshpk';

const appendFile = promisify(fs.appendFile);
const mkdir = promisify(fs.mkdir);
const truncate = promisify(fs.truncate);

export const asyncMiddleware: (fn: Handler) => Handler = (fn: Handler) => {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(er => {
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
        console.log('[Server] Listening on port ' + this._config.httpPort);
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

                let data: any;
                try {
                    data = verify(token, this._config.secret);
                } catch (ex) {
                    return res.sendStatus(403);
                }

                const publicKey = data.publicKey;

                if (!publicKey) {
                    return res.sendStatus(400);
                }

                const parsed = sshpk.parseKey(publicKey, 'pem');
                const ssh = parsed.toString('ssh');

                const username = randomBytes(16).toString('hex');

                let line = `${ssh} ${req.ip}`;
                const dir = join(this._config.homeDir, username, '.ssh');
                const path = join(dir, 'authorized_keys');

                console.log(
                    `[Server] User has valid public key. Adding to their ${path}...`
                );

                await mkdir(dir, {
                    recursive: true,
                });
                await appendFile(path, line);

                console.log('[Server] Added.');

                setTimeout(() => {
                    console.log(`[Server] Time is up. Truncating ${path}...`);
                    truncate(path, 0);
                }, this._config.loginTimeout * 1000);

                res.send({
                    username: username,
                    publicKey: publicKey,
                });
            })
        );
    }
}
