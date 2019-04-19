import * as Http from 'http';
import express from 'express';
import * as bodyParser from 'body-parser';
import * as path from 'path';
import SocketIO from 'socket.io';
import vhost from 'vhost';
import pify from 'pify';
import { MongoClient } from 'mongodb';
import { asyncMiddleware } from './utils';
import { Config, ClientConfig, RedisConfig } from './config';
import { CausalTreeServer } from './causal-trees/CausalTreeServer';
import { MongoDBTreeStore } from './causal-trees/MongoDBTreeStore';
import { auxCausalTreeFactory } from '@casual-simulation/aux-common/aux-format';
import { AppVersion, apiVersion } from '@casual-simulation/aux-common';
import uuid from 'uuid/v4';
import axios from 'axios';
import { RedisClient, createClient as createRedisClient } from 'redis';
import util from 'util';
import sharp from 'sharp';

const connect = pify(MongoClient.connect);

const imageMimeTypes = [
    'image/png',
    'image/bmp',
    'image/gif',
    'image/jpeg',
    'image/vnd.microsoft.icon',
    'image/tiff',
    'image/webp',
];

export class ClientServer {
    private _app: express.Express;
    private _redisClient: RedisClient;
    private _hgetall: any;
    private _config: ClientConfig;
    private _cacheExpireSeconds: number;

    get app() {
        return this._app;
    }

    get config() {
        return this._config;
    }

    constructor(
        config: ClientConfig,
        redisClient: RedisClient,
        redisConfig: RedisConfig
    ) {
        this._app = express();
        this._config = config;
        this._redisClient = redisClient;
        this._hgetall = redisClient
            ? util.promisify(this._redisClient.hgetall).bind(this._redisClient)
            : null;
        this._cacheExpireSeconds = redisConfig
            ? redisConfig.defaultExpireSeconds
            : null;
    }

    configure() {
        this._app.post(
            '/api/users',
            asyncMiddleware(async (req, res) => {
                const json = req.body;

                let username;

                if (json.email.indexOf('@') >= 0) {
                    username = json.email.split('@')[0];
                } else {
                    username = json.email;
                }

                // TODO: Do something like actual user login
                res.send({
                    id: uuid(),
                    email: json.email,
                    username: username,
                    name: username,
                });
            })
        );

        this._app.get('/api/config', (req, res) => {
            res.send(this._config.web);
        });

        this._app.use(express.static(this._config.dist));

        this._app.use(
            '/proxy',
            asyncMiddleware(async (req, res) => {
                const url = req.query.url;
                try {
                    if (this._hgetall) {
                        const cached = await this._hgetall(url);
                        if (cached) {
                            console.log(
                                '[Server] Returning cached request:',
                                url
                            );
                            const contentType = cached.contentType.toString();
                            const status = parseInt(cached.status.toString());
                            const data: Buffer = cached.data;
                            res.status(status);
                            res.contentType(contentType);
                            res.send(data);

                            return;
                        }
                    }

                    console.log('[Server] Proxying request:', url);
                    const resp = await axios.get(url, {
                        responseType: 'arraybuffer',
                    });
                    const status = resp.status;
                    let contentType = resp.headers['content-type'];
                    let data: Buffer = resp.data;

                    if (this._redisClient && this._shouldCache(contentType)) {
                        if (this._shouldOptimise(contentType)) {
                            console.log('[Server] Optimizing image...');
                            const beforeSize = data.length;
                            const beforeContentType = contentType;
                            [contentType, data] = await this._optimizeImage(
                                contentType,
                                data
                            );
                            const afterSize = data.length;

                            const sizeDifference = beforeSize - afterSize;
                            const percentageDifference =
                                1 - afterSize / beforeSize;

                            console.log('[Server] Optimization results:');
                            console.log(
                                `    ${beforeContentType}:`,
                                beforeSize
                            );
                            console.log(`    ${contentType}:`, afterSize);
                            console.log('    Size Diff:', sizeDifference);
                            console.log(
                                '       % Diff:',
                                percentageDifference * 100
                            );
                        } else {
                            console.log('[Server] Skipping Optimization.');
                        }

                        console.log('[Server] Caching', contentType);
                        this._redisClient.hmset(url, {
                            contentType: contentType,
                            status: status,
                            data: <any>data,
                        });
                        this._redisClient.EXPIRE(url, this._cacheExpireSeconds);
                    }

                    res.contentType(contentType);
                    res.status(resp.status);
                    res.send(data);
                } catch (ex) {
                    console.error(ex);
                    if (ex.response) {
                        res.sendStatus(ex.response.status);
                    } else {
                        res.sendStatus(500);
                    }
                }
            })
        );

        this._app.use('*', (req, res) => {
            res.sendFile(path.join(this._config.dist, this._config.index));
        });
    }

    /**
     * Optimizes the given image.
     * @param contentType The MIME type of the image.
     * @param data The data for the image.
     */
    private async _optimizeImage(
        contentType: string,
        data: Buffer
    ): Promise<[string, Buffer]> {
        const optimized = await sharp(data)
            .webp()
            .toBuffer();
        return ['image/webp', optimized];
    }

    private _shouldOptimise(contentType: string) {
        if (contentType === 'image/webp') {
            return false;
        }
        return imageMimeTypes.indexOf(contentType) >= 0;
    }

    private _shouldCache(contentType: string) {
        return imageMimeTypes.indexOf(contentType) >= 0;
    }
}

/**
 * Defines a class that represents a fully featured SO4 server.
 */
export class Server {
    private _app: express.Express;
    private _http: Http.Server;
    private _socket: SocketIO.Server;
    private _treeServer: CausalTreeServer;
    private _config: Config;
    private _clients: ClientServer[];
    private _mongoClient: MongoClient;
    private _userCount: number;
    private _redisClient: RedisClient;

    constructor(config: Config) {
        this._config = config;
        this._app = express();
        this._http = new Http.Server(this._app);
        this._config = config;
        this._socket = SocketIO(this._http, config.socket);
        this._redisClient = config.redis
            ? createRedisClient({
                  ...config.redis.options,
                  return_buffers: true,
              })
            : null;
        this._clients = this._config.clients.map(
            c => new ClientServer(c, this._redisClient, config.redis)
        );
        this._userCount = 0;
    }

    async configure() {
        this._mongoClient = await connect(this._config.mongodb.url);

        this._configureSocketServices();
        this._app.use(bodyParser.json());

        this._clients.forEach(c => {
            c.configure();

            c.config.domains.forEach(d => {
                this._app.use(vhost(d, c.app));
            });
        });
    }

    start() {
        this._http.listen(this._config.httpPort, () =>
            console.log(`Server listening on port ${this._config.httpPort}!`)
        );
    }

    private async _configureSocketServices() {
        const store = new MongoDBTreeStore(
            this._mongoClient,
            this._config.trees.dbName
        );
        await store.init();
        this._treeServer = new CausalTreeServer(
            this._socket,
            store,
            auxCausalTreeFactory()
        );

        this._socket.on('connection', socket => {
            this._userCount += 1;
            console.log(
                '[Server] A user connected! There are now',
                this._userCount,
                'users connected.'
            );

            socket.on('version', (callback: (version: AppVersion) => void) => {
                callback({
                    gitTag: GIT_TAG,
                    gitHash: GIT_HASH,
                    apiVersion: apiVersion,
                });
            });

            socket.on('disconnect', () => {
                this._userCount -= 1;
                console.log(
                    '[Server] A user disconnected! There are now',
                    this._userCount,
                    'users connected.'
                );
            });
        });
    }
}
