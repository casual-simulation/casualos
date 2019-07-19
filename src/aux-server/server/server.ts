import * as Http from 'http';
import express from 'express';
import * as bodyParser from 'body-parser';
import * as path from 'path';
import SocketIO from 'socket.io';
import pify from 'pify';
import { MongoClient } from 'mongodb';
import { asyncMiddleware } from './utils';
import { Config, ClientConfig, RedisConfig } from './config';
import { CausalTreeServerSocketIO } from '@casual-simulation/causal-tree-server-socketio';
import { MongoDBTreeStore } from '@casual-simulation/causal-tree-store-mongodb';
import {
    auxCausalTreeFactory,
    GLOBALS_FILE_ID,
    calculateFileValue,
} from '@casual-simulation/aux-common';
import { AppVersion, apiVersion } from '@casual-simulation/aux-common';
import uuid from 'uuid/v4';
import axios, { AxiosResponse } from 'axios';
import { RedisClient, createClient as createRedisClient } from 'redis';
import util from 'util';
import sharp from 'sharp';
import {
    parseCacheControlHeader,
    CacheControlHeaderValues,
    formatCacheControlHeader,
} from './CacheHelpers';
import { Request } from 'express';
import useragent from 'useragent';
import { CausalTreeStore } from '../../causal-trees';
import {
    ChannelManagerImpl,
    ChannelManager,
    DeviceManagerImpl,
    NullDeviceAuthenticator,
    NullChannelAuthorizer,
} from '@casual-simulation/causal-tree-server';
import { NodeSigningCryptoImpl } from '../../crypto-node';
import { AuxUser } from '@casual-simulation/aux-vm';
import {
    AuxChannelManagerImpl,
    AuxLoadedChannel,
    AuxUserAuthorizer,
    AuxUserAuthenticator,
    AdminModule,
} from '@casual-simulation/aux-vm-node';

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
    private _builder: ClientConfig;
    private _player: ClientConfig;
    private _config: Config;
    private _cacheExpireSeconds: number;
    private _store: CausalTreeStore;

    get app() {
        return this._app;
    }

    constructor(
        config: Config,
        builder: ClientConfig,
        player: ClientConfig,
        redisClient: RedisClient,
        store: CausalTreeStore,
        redisConfig: RedisConfig
    ) {
        this._app = express();
        this._config = config;
        this._builder = builder;
        this._player = player;
        this._redisClient = redisClient;
        this._store = store;
        this._hgetall = redisClient
            ? util.promisify(this._redisClient.hgetall).bind(this._redisClient)
            : null;
        this._cacheExpireSeconds = redisConfig
            ? redisConfig.defaultExpireSeconds
            : null;
    }

    configure() {
        this._app.use('/api/[\\*]/:channel/config', (req, res) => {
            res.send(this._builder.web);
        });

        this._app.get('/api/:channel/:context/config', (req, res) => {
            res.send(this._player.web);
        });

        this._app.get('/api/:channel/config', (req, res) => {
            res.send(this._player.web);
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
                            const optimized: Buffer = cached.optimizedData;
                            const optimizedContentType = cached.optimizedContentType.toString();

                            let [
                                retContentType,
                                retData,
                            ] = this._getDataForBrowser(
                                req,
                                contentType,
                                data,
                                optimizedContentType,
                                optimized
                            );
                            res.status(status);
                            res.contentType(retContentType);
                            res.send(retData);
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
                    let cacheControl = parseCacheControlHeader(
                        resp.headers['cache-control'] || ''
                    );

                    let optimizedData: Buffer = null;
                    let optimizedContentType: string = null;
                    if (
                        this._redisClient &&
                        this._shouldCache(contentType, cacheControl)
                    ) {
                        if (this._shouldOptimize(req, contentType)) {
                            console.log('[Server] Optimizing image...');
                            const beforeSize = data.length;
                            const beforeContentType = contentType;
                            [
                                optimizedContentType,
                                optimizedData,
                            ] = await this._optimizeImage(contentType, data);
                            const afterSize = optimizedData.length;

                            const sizeDifference = beforeSize - afterSize;
                            const percentageDifference =
                                1 - afterSize / beforeSize;

                            console.log('[Server] Optimization results:');
                            console.log(
                                `    ${beforeContentType}:`,
                                beforeSize
                            );
                            console.log(
                                `    ${optimizedContentType}:`,
                                afterSize
                            );
                            console.log('    Size Diff:', sizeDifference);
                            console.log(
                                '       % Diff:',
                                percentageDifference * 100
                            );
                        } else {
                            console.log('[Server] Skipping Optimization.');
                        }

                        let expire = this._cacheExpireSeconds;
                        if (cacheControl['s-maxage']) {
                            expire = cacheControl['s-maxage'];
                        } else if (cacheControl['max-age']) {
                            expire = cacheControl['max-age'];
                        }
                        console.log(
                            `[Server] Caching ${contentType} for ${expire} seconds.`
                        );
                        this._redisClient.hmset(url, {
                            contentType: contentType,
                            status: status,
                            data: <any>data,
                            optimizedData: <any>optimizedData,
                            optimizedContentType: optimizedContentType,
                        });

                        this._redisClient.EXPIRE(url, expire);
                        cacheControl = {
                            public: true,
                            'max-age': expire,
                        };
                    }

                    let cacheControlHeader = formatCacheControlHeader(
                        cacheControl
                    );
                    if (cacheControlHeader && cacheControlHeader.length > 0) {
                        res.setHeader('Cache-Control', cacheControlHeader);
                    }

                    let [retContentType, retData] = this._getDataForBrowser(
                        req,
                        contentType,
                        data,
                        optimizedContentType,
                        optimizedData
                    );
                    res.contentType(retContentType);
                    res.status(resp.status);
                    res.send(retData);
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

        this._app.use(
            '/[\\*]/:channel[.]aux',
            asyncMiddleware(async (req, res) => {
                const channel = `aux-${req.params.channel || 'default'}`;
                console.log('[Server] Getting .aux file for channel:', channel);
                const stored = await this._store.get(channel);
                if (stored) {
                    res.contentType('application/json');
                    res.send(stored);
                } else {
                    res.sendStatus(404);
                }
            })
        );

        this._app.use(
            '/:context/:channel?[.]aux',
            asyncMiddleware(async (req, res) => {
                const channel = `aux-${req.params.channel || 'default'}`;
                console.log('[Server] Getting .aux file for channel:', channel);
                const stored = await this._store.get(channel);
                if (stored) {
                    res.contentType('application/json');
                    res.send(stored);
                } else {
                    res.sendStatus(404);
                }
            })
        );

        this._app.use('/[\\*]/:channel', (req, res) => {
            res.sendFile(path.join(this._config.dist, this._builder.index));
        });

        this._app.use('/:context/:channel?', (req, res) => {
            res.sendFile(path.join(this._config.dist, this._player.index));
        });

        this._app.use('*', (req, res) => {
            res.sendFile(path.join(this._config.dist, this._builder.index));
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

    private _getDataForBrowser(
        req: Request,
        originalContentType: string,
        originalData: Buffer,
        optimizedContentType: string,
        optimizedData: Buffer
    ): [string, Buffer] {
        const ua = useragent.is(req.header('user-agent'));
        if (ua.safari || ua.mobile_safari) {
            console.log(
                "[Server] Returning original data because safari doesn't support WebP"
            );
            return [originalContentType, originalData];
        } else {
            return [
                optimizedContentType || originalContentType,
                optimizedData || originalData,
            ];
        }
    }

    private _shouldOptimize(req: Request, contentType: string) {
        if (contentType === 'image/webp') {
            return false;
        }
        return imageMimeTypes.indexOf(contentType) >= 0;
    }

    private _shouldCache(
        contentType: string,
        cacheControl: CacheControlHeaderValues
    ) {
        const isImage = imageMimeTypes.indexOf(contentType) >= 0;
        return (
            isImage && !cacheControl['no-cache'] && !cacheControl['no-store']
        );
    }
}

/**
 * Defines a class that represents a fully featured SO4 server.
 */
export class Server {
    private _app: express.Express;
    private _http: Http.Server;
    private _socket: SocketIO.Server;
    private _treeServer: CausalTreeServerSocketIO;
    private _config: Config;
    private _client: ClientServer;
    private _mongoClient: MongoClient;
    private _userCount: number;
    private _redisClient: RedisClient;
    private _store: CausalTreeStore;
    private _channelManager: ChannelManager;

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
        this._userCount = 0;
    }

    async configure() {
        this._mongoClient = await connect(this._config.mongodb.url);
        this._store = new MongoDBTreeStore(
            this._mongoClient,
            this._config.trees.dbName
        );
        this._client = new ClientServer(
            this._config,
            this._config.builder,
            this._config.player,
            this._redisClient,
            this._store,
            this._config.redis
        );

        this._configureSocketServices();
        this._app.use(bodyParser.json());
        this._client.configure();

        this._app.use((req, res, next) => {
            res.setHeader('Referrer-Policy', 'same-origin');
            next();
        });

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

        this._app.use(this._client.app);

        // this._clients.forEach(c => {
        //     c.configure();

        //     c.config.domains.forEach(d => {
        //         this._app.use(vhost(d, c.app));
        //     });
        // });
    }

    start() {
        this._http.listen(this._config.httpPort, () =>
            console.log(`Server listening on port ${this._config.httpPort}!`)
        );
    }

    private async _configureSocketServices() {
        await this._store.init();
        const serverUser: AuxUser = {
            id: 'server',
            isGuest: false,
            name: 'Server',
            username: 'Server',
            token: 'abc',
        };
        const authorizer = new AuxUserAuthorizer();
        this._channelManager = new AuxChannelManagerImpl(
            serverUser,
            this._store,
            auxCausalTreeFactory(),
            new NodeSigningCryptoImpl('ECDSA-SHA256-NISTP256'),
            authorizer,
            [new AdminModule()]
        );

        const adminChannel = <AuxLoadedChannel>(
            await this._channelManager.loadChannel({
                id: 'aux-admin',
                type: 'aux',
            })
        );

        const authenticator = new AuxUserAuthenticator(adminChannel);

        this._treeServer = new CausalTreeServerSocketIO(
            this._socket,
            new DeviceManagerImpl(),
            this._channelManager,
            authenticator,
            authorizer
        );
        // this._auxServer = new AuxSimulationServer(
        //     adminUser,
        //     this._channelManager
        // );

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
