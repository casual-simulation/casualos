import * as Http from 'http';
import * as Https from 'https';
import express, { Response, NextFunction } from 'express';
import * as bodyParser from 'body-parser';
import * as path from 'path';
import * as url from 'url';
import cors from 'cors';
import pify from 'pify';
import { MongoClient, MongoClientOptions } from 'mongodb';
import {
    Client as CassandraClient,
    tracker as CassandraTracker,
    DseClientOptions,
    ExecutionProfile,
    types,
} from 'cassandra-driver';
import { asyncMiddleware } from './utils';
import { Config, ClientConfig, RedisConfig, DRIVES_URL } from './config';
import { WebSocketConnectionServer } from '@casual-simulation/causal-tree-server-websocket';
import {
    MongoDBRepoStore,
    MongoDBUpdatesStore,
} from '@casual-simulation/causal-tree-store-mongodb';
import {
    ON_WEBHOOK_ACTION_NAME,
    merge,
    hasValue,
    DATA_PORTAL,
    createBot,
    calculateBotValue,
    isFormula,
} from '@casual-simulation/aux-common';
import { v4 as uuid } from 'uuid';
import axios from 'axios';
import { RedisClient, createClient as createRedisClient } from 'redis';
import util from 'util';
import {
    parseCacheControlHeader,
    CacheControlHeaderValues,
    formatCacheControlHeader,
} from './CacheHelpers';
import { Request } from 'express';
import useragent from 'useragent';
import {
    DeviceInfo,
    USERNAME_CLAIM,
    DEVICE_ID_CLAIM,
    SESSION_ID_CLAIM,
    deviceInfoFromUser,
    sitelog,
} from '@casual-simulation/causal-trees';
import {
    CausalRepoServer,
    MultiConnectionServer,
    ConnectionBridge,
    FixedConnectionServer,
} from '@casual-simulation/causal-tree-server';
import { AuxUser, Simulation } from '@casual-simulation/aux-vm';
import {
    AuxCausalRepoManager,
    AdminModule2,
    nodeSimulationForBranch,
} from '@casual-simulation/aux-vm-node';
import { DenoSimulationImpl, DenoVM } from '@casual-simulation/aux-vm-deno';
import {
    WebhooksModule2,
    FilesModule2,
    CheckoutModule2,
    BackupModule2,
} from './modules';
import { DirectoryService } from './directory/DirectoryService';
import { MongoDBDirectoryStore } from './directory/MongoDBDirectoryStore';
import { DirectoryStore } from './directory/DirectoryStore';
import { DirectoryClient } from './directory/DirectoryClient';
import { WebSocketClient, requestUrl } from '@casual-simulation/tunnel';
import Stripe from 'stripe';
import { RedisStageStore } from './redis/RedisStageStore';
import {
    MemoryStageStore,
    CausalRepoClient,
    CausalRepoStore,
    CombinedCausalRepoStore,
    CausalRepoStageStore,
    UpdatesStore,
} from '@casual-simulation/causal-trees/core2';
import { SetupChannelModule2 } from './modules/SetupChannelModule2';
import { map, first } from 'rxjs/operators';
import { pickBy, sortBy } from 'lodash';
import { BotHttpServer } from './servers/BotHttpServer';
import { MongoDBBotStore } from './mongodb/MongoDBBotStore';
import {
    CassandraDBObjectStore,
    AWS_KEYSPACES_REGIONS,
} from '@casual-simulation/causal-tree-store-cassandradb';
import { EventEmitter } from 'events';
import { readFileSync } from 'fs';
import AmazonRootCA1 from '@casual-simulation/causal-tree-store-cassandradb/certificates/AmazonRootCA1.pem';
import mime from 'mime';
import { GpioModule2 } from './modules/GpioModule2';
import { SerialModule } from './modules/SerialModule';
import { MongoDBStageStore } from './mongodb/MongoDBStageStore';
import { WebConfig } from 'shared/WebConfig';
import compression from 'compression';

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
    private _player: ClientConfig;
    private _config: Config;
    private _cacheExpireSeconds: number;

    get app() {
        return this._app;
    }

    constructor(
        config: Config,
        player: ClientConfig,
        redisClient: RedisClient,
        redisConfig: RedisConfig
    ) {
        this._app = express();
        this._config = config;
        this._player = player;
        this._redisClient = redisClient;
        this._hgetall = redisClient
            ? util.promisify(this._redisClient.hgetall).bind(this._redisClient)
            : null;
        this._cacheExpireSeconds = redisConfig
            ? redisConfig.defaultExpireSeconds
            : null;
    }

    configure() {
        this._app.get(
            '/api/config',
            asyncMiddleware(async (req, res) => {
                const config: WebConfig = {
                    ...this._player.web,
                    version: 2,
                };
                res.send(config);
            })
        );

        this._app.get('/api/manifest', (req, res) => {
            res.sendFile(path.join(this._config.dist, this._player.manifest));
        });

        this._app.use(express.static(this._config.dist));

        const driveMiddleware = [
            express.static(this._config.drives),
            ...[...new Array(5)].map((_, i) =>
                express.static(path.join(this._config.drives, i.toString()))
            ),
        ];
        this._app.use(DRIVES_URL, driveMiddleware);

        this._app.use(
            '/proxy',
            asyncMiddleware(async (req, res) => {
                const url = req.query.url as string;
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
                            const optimizedContentType =
                                cached.optimizedContentType;

                            let [retContentType, retData] =
                                this._getDataForBrowser(
                                    req,
                                    contentType,
                                    data,
                                    optimizedContentType
                                        ? optimizedContentType.toString()
                                        : null,
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
                        if (this._shouldOptimize(contentType)) {
                            console.log('[Server] Optimizing image...');
                            const beforeSize = data.length;
                            const beforeContentType = contentType;
                            [optimizedContentType, optimizedData] =
                                await this._optimizeImage(contentType, data);
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
                        this._redisClient.hmset(
                            url,
                            pickBy(
                                {
                                    contentType: contentType,
                                    status: status,
                                    data: <any>data,
                                    optimizedData: <any>optimizedData,
                                    optimizedContentType: optimizedContentType,
                                },
                                (val) => !!val
                            )
                        );

                        this._redisClient.EXPIRE(url, expire);
                        cacheControl = {
                            public: true,
                            'max-age': expire,
                        };
                    }

                    let cacheControlHeader =
                        formatCacheControlHeader(cacheControl);
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
                    console.log(`[Server] Proxying to ${url} failed.`);
                    if (ex.response) {
                        res.sendStatus(ex.response.status);
                    } else {
                        res.sendStatus(500);
                    }
                }
            })
        );

        // Removed the direct aux view for now
        /*
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
            '/:dimension/:channel?[.]aux',
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
        */

        this._app.get('/api/*', (req, res) => {
            res.sendStatus(404);
        });

        this._app.get('/terms', (req, res) => {
            res.sendFile(path.join(this._config.dist, 'terms-of-service.txt'));
        });

        this._app.get('/privacy-policy', (req, res) => {
            res.sendFile(path.join(this._config.dist, 'privacy-policy.txt'));
        });

        this._app.get('*', (req, res) => {
            res.sendFile(path.join(this._config.dist, this._player.index));
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
        const optimized = data;
        return [contentType, optimized];
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

    private _shouldOptimize(contentType: string) {
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
    private _config: Config;
    private _client: ClientServer;
    private _mongoClient: MongoClient;
    private _cassandraClient: CassandraClient;
    private _redisClient: RedisClient;
    private _directory: DirectoryService;
    private _directoryStore: DirectoryStore;
    private _directoryClient: DirectoryClient;
    private _webhooksClient: CausalRepoClient;
    private _botServer: BotHttpServer;

    constructor(config: Config) {
        this._config = config;
        this._app = express();
        if (this._config.tls) {
            this._http = <any>Https.createServer(
                {
                    cert: this._config.tls.cert,
                    key: this._config.tls.key,
                },
                this._app
            );
        } else {
            this._http = new Http.Server(this._app);
        }
        this._config = config;
        this._redisClient = config.redis
            ? createRedisClient({
                  ...config.redis.options,
                  return_buffers: true,
              })
            : null;
    }

    async configure() {
        if (this._config.proxy && this._config.proxy.trust) {
            this._app.set('trust proxy', this._config.proxy.trust);
        }

        // TODO: Enable CSP when we know where it works and does not work
        // this._applyCSP();

        this._app.use(cors());

        this._app.use(compression());

        this._mongoClient = await connect(this._config.mongodb.url, {
            useNewUrlParser: this._config.mongodb.useNewUrlParser,
            useUnifiedTopology: !!this._config.mongodb.useUnifiedTopology,
        } as MongoClientOptions);
        if (this._config.cassandradb) {
            console.log('[Server] Using CassandraDB');
            const requestTracker = new CassandraTracker.RequestLogger({
                slowThreshold: this._config.cassandradb.slowRequestTime,
            });
            const requestEmitter = <EventEmitter>(<any>requestTracker).emitter;
            requestEmitter.on('slow', (message) => {
                console.log(`[Cassandra] ${message}`);
            });

            let options = {} as DseClientOptions;
            if ('awsRegion' in this._config.cassandradb) {
                const config = this._config.cassandradb;
                const region = AWS_KEYSPACES_REGIONS.find(
                    (r) => r.region === config.awsRegion
                );
                if (!region) {
                    throw new Error(
                        'Unable to find Cassandra endpoint information for the given region.'
                    );
                }
                options.contactPoints = [region.endpoint];
                options.localDataCenter = region.region;
                options.protocolOptions = {
                    port: region.port,
                };
                options.sslOptions = {
                    host: region.endpoint,
                    port: region.port,
                    servername: region.endpoint,
                    rejectUnauthorized: true,
                    ca: [AmazonRootCA1],
                };
            } else {
                options.contactPoints = this._config.cassandradb.contactPoints;
                options.localDataCenter =
                    this._config.cassandradb.localDataCenter;
                if (this._config.cassandradb.requireTLS) {
                    options.sslOptions = {
                        rejectUnauthorized: this._config.cassandradb.requireTLS,
                    };
                    if (
                        this._config.cassandradb.certificateAuthorityPublicKey
                    ) {
                        options.sslOptions.ca = [
                            readFileSync(
                                this._config.cassandradb
                                    .certificateAuthorityPublicKey
                            ),
                        ];
                    }
                }
            }
            if (this._config.cassandradb.credentials) {
                options.credentials = this._config.cassandradb.credentials;
            }
            const readProfile = new ExecutionProfile('read', {
                consistency: types.consistencies.localOne,
            });
            const writeProfile = new ExecutionProfile('write', {
                consistency: types.consistencies.localQuorum,
            });
            const defaultProfile = new ExecutionProfile('default', {
                consistency: types.consistencies.localQuorum,
            });
            options.profiles = [readProfile, writeProfile, defaultProfile];
            this._cassandraClient = new CassandraClient(options);

            //     {
            //     contactPoints: this._config.cassandradb.contactPoints,
            //     localDataCenter: this._config.cassandradb.localDataCenter,
            //     requestTracker,
            //     sslOptions,
            // });

            this._cassandraClient.on(
                'log',
                (level, loggerName, message, furtherInfo) => {
                    if (level === 'warning') {
                        console.warn(`[Cassandra-${loggerName}]: ${message}`);
                    } else if (level === 'error') {
                        console.error(`[Cassandra-${loggerName}]: ${message}`);
                    } else if (level === 'info') {
                        console.log(`[Cassandra-${loggerName}]: ${message}`);
                    }
                }
            );

            await this._cassandraClient.connect();
        } else {
            console.log('[Server] Skipping CassandraDB');
            this._config.cassandradb = null;
        }

        if (this._config.sandbox === 'deno') {
            console.log('[Server] Using Deno Sandboxing');
        } else {
            console.log('[Server] Skipping Sandboxing');
        }

        await this._configureCausalRepoServices();
        this._app.use(bodyParser.json());

        this._client = new ClientServer(
            this._config,
            this._config.player,
            this._redisClient,
            this._config.redis
        );
        this._client.configure();

        this._configureBotHttpServer();

        this._app.use((req, res, next) => {
            res.setHeader('Referrer-Policy', 'same-origin');
            res.setHeader('Access-Control-Allow-Credentials', 'true');
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

        this._directoryStore = new MongoDBDirectoryStore(
            this._mongoClient,
            this._config.directory.dbName
        );
        await this._directoryStore.init();

        await this._serveDirectory();
        await this._startDirectoryClient();

        this._app.all(
            '/webhook/*',
            asyncMiddleware(async (req, res) => {
                await this._handleWebhook(req, res);
            })
        );
        this._app.all(
            '/webhook',
            asyncMiddleware(async (req, res) => {
                await this._handleWebhook(req, res);
            })
        );
        this._app.get(
            '/',
            dataPortalMiddleware(
                asyncMiddleware(async (req, res) => {
                    await this._handleDataPortal(req, res);
                })
            )
        );

        if (this._botServer) {
            this._app.use(this._botServer.app);
        }

        this._app.use(this._client.app);
    }

    private _configureBotHttpServer() {
        if (!this._config.bots) {
            return;
        }
        const db = this._mongoClient.db(this._config.bots.dbName);
        const botStore = new MongoDBBotStore(this._config.bots, db);
        this._botServer = new BotHttpServer(botStore);
        this._botServer.configure();
    }

    private async _handleDataPortal(req: Request, res: Response) {
        const id = (req.query.inst ?? req.query.server) as string;
        if (!id) {
            res.sendStatus(400);
            return;
        }

        const portal = req.query[DATA_PORTAL] as string;
        if (!portal) {
            res.sendStatus(400);
            return;
        }

        const exists = await this._webhooksClient
            .branchInfo(id)
            .pipe(
                first(),
                map((info) => info.exists)
            )
            .toPromise();

        if (!exists) {
            res.sendStatus(404);
            return;
        }

        const user = getWebhooksUser();
        const simulation =
            this._config.sandbox === 'deno'
                ? new DenoSimulationImpl(
                      user,
                      id,
                      new DenoVM(user, {
                          config: {
                              version: null,
                              versionHash: null,
                              debug: this._config.debug,
                          },
                          partitions: DenoSimulationImpl.createPartitions(
                              id,
                              user,
                              'http://localhost:3000'
                          ),
                      })
                  )
                : nodeSimulationForBranch(user, this._webhooksClient, id);
        try {
            await simulation.init();

            // Wait for full sync
            await simulation.connection.syncStateChanged
                .pipe(first((synced) => synced))
                .toPromise();

            const bot = simulation.helper.botsState[portal];
            if (!!bot) {
                res.send(createBot(bot.id, bot.tags));
                return;
            }

            const bots = sortBy(
                simulation.index.findBotsWithTag(portal),
                (b) => b.id
            );
            const values = bots.map((b) => {
                if (isFormula(b.tags[portal])) {
                    return calculateBotValue(null, b, portal);
                } else {
                    return b.tags[portal];
                }
            });
            const portalContentType = mime.getType(portal);
            const contentType = (req.query[`${DATA_PORTAL}ContentType`] ||
                portalContentType ||
                'application/json') as string;

            if (hasValue(contentType)) {
                res.set('Content-Type', contentType);
            }

            if (hasValue(portalContentType)) {
                res.send(values[0] || '');
            } else {
                res.send(values);
            }
        } finally {
            simulation.unsubscribe();
        }
    }

    private async _handleWebhook(req: Request, res: Response) {
        const id = (req.query.inst ?? req.query.server) as string;
        if (!id) {
            res.sendStatus(400);
            return;
        }

        let handled = await this._handleV2Webhook(req, res, id);
        if (handled) {
            return;
        }

        res.sendStatus(404);
    }

    private async _handleV2Webhook(
        req: Request,
        res: Response,
        id: string
    ): Promise<boolean> {
        const exists = await this._webhooksClient
            .branchInfo(id)
            .pipe(
                first(),
                map((info) => info.exists)
            )
            .toPromise();

        if (!exists) {
            return false;
        }

        const user = getWebhooksUser();
        const simulation = nodeSimulationForBranch(
            user,
            this._webhooksClient,
            id
        );
        try {
            await simulation.init();
            return await this._sendWebhook(req, res, simulation);
        } finally {
            simulation.unsubscribe();
        }
    }

    private async _sendWebhook(
        req: Request,
        res: Response,
        simulation: Simulation
    ) {
        const fullUrl = requestUrl(req, req.protocol);
        const result = await simulation.helper.shout(
            ON_WEBHOOK_ACTION_NAME,
            null,
            {
                method: req.method,
                url: fullUrl,
                data: req.body,
                headers: req.headers,
            }
        );

        if (result.results.length > 0) {
            let firstValue = result.results.find((r) => hasValue(r));
            if (firstValue) {
                if (typeof firstValue === 'object') {
                    if (typeof firstValue.headers === 'object') {
                        res.set(firstValue.headers);
                    }

                    if (typeof firstValue.status === 'number') {
                        res.status(firstValue.status);
                    }

                    res.send(firstValue.data);
                } else {
                    res.send(firstValue);
                }
            } else {
                res.sendStatus(204);
            }
            return true;
        } else {
            return false;
        }
    }

    private async _serveDirectory() {
        if (!this._config.directory.server) {
            console.log(
                '[Server] Disabling Directory Server because no config is available for it.'
            );
            return;
        }

        console.log('[Server] Starting Directory Server.');

        this._directory = new DirectoryService(
            this._directoryStore,
            this._config.directory.server
        );
        this._app.get(
            '/api/directory',
            asyncMiddleware(async (req, res) => {
                const ip = req.ip;
                const result = await this._directory.findEntries(ip);
                if (result.type === 'query_results') {
                    return res.send(
                        result.entries.map((e) => ({
                            publicName: e.publicName,
                            url: url.format({
                                protocol: req.protocol,
                                hostname: `${e.subhost}.${req.hostname}`,
                            }),
                        }))
                    );
                } else if (result.type === 'not_authorized') {
                    return res.sendStatus(403);
                } else {
                    return res.sendStatus(500);
                }
            })
        );
        this._app.put(
            '/api/directory',
            asyncMiddleware(async (req, res) => {
                const ip = req.ip;
                const result = await this._directory.update({
                    key: req.body.key,
                    password: req.body.password,
                    publicName: req.body.publicName,
                    privateIpAddress: req.body.privateIpAddress,
                    publicIpAddress: ip,
                });
                if (result.type === 'entry_updated') {
                    return res.send({
                        token: result.token,
                    });
                } else if (result.type === 'not_authorized') {
                    return res.sendStatus(403);
                } else if (result.type === 'bad_request') {
                    res.status(400);
                    res.send({
                        errors: result.errors,
                    });
                } else {
                    return res.sendStatus(500);
                }
            })
        );
    }

    private async _startDirectoryClient() {
        if (!this._config.directory.client) {
            console.log(
                '[Server] Disabling Directory Client because no config is available for it.'
            );
            return;
        }

        console.log(
            `[Server] Configuring Directory Client for ${this._config.directory.client.upstream}`
        );

        const tunnelClient = this._config.directory.client.tunnel
            ? new WebSocketClient(this._config.directory.client.tunnel)
            : null;

        if (!tunnelClient) {
            console.log(
                '[Server] Disabling tunneling because there is no config available for it.'
            );
        }

        this._directoryClient = new DirectoryClient(
            this._directoryStore,
            tunnelClient,
            this._config.directory.client,
            this._config.httpPort
        );
    }

    start() {
        this._http.listen(this._config.httpPort, () =>
            console.log(
                `[Server] Server listening on port ${this._config.httpPort}!`
            )
        );

        if (this._directoryClient) {
            console.log(`[Server] Starting Directory Client`);
            this._directoryClient.init();
        }
    }

    private async _configureCausalRepoServices() {
        const [store, stageStore, updatesStore] = await this._setupRepoStore();
        const websocketServer = new WebSocketConnectionServer(
            this._http,
            this._config.socket
        );
        const serverUser = getServerUser();
        const serverDevice = deviceInfoFromUser(serverUser);

        if (this._config.executeLoadedInstances) {
            const { connections, manager, webhooksClient } =
                this._createRepoManager(serverDevice, serverUser);
            const fixedServer = new FixedConnectionServer(connections);
            const multiServer = new MultiConnectionServer([
                websocketServer,
                fixedServer,
            ]);

            const repoServer = new CausalRepoServer(
                multiServer,
                store,
                stageStore,
                updatesStore
            );
            repoServer.defaultDeviceSelector = {
                username: serverDevice.claims[USERNAME_CLAIM],
                deviceId: serverDevice.claims[DEVICE_ID_CLAIM],
                sessionId: serverDevice.claims[SESSION_ID_CLAIM],
            };

            this._webhooksClient = webhooksClient;

            repoServer.init();

            // Wait for async operations from the repoServer to finish
            // before starting the repo manager
            setImmediate(() => {
                manager.init();
            });
        } else {
            const webhooks = this._createWebhooksClient();
            const fixedServer = new FixedConnectionServer([
                webhooks.connection,
            ]);
            const multiServer = new MultiConnectionServer([
                websocketServer,
                fixedServer,
            ]);

            const repoServer = new CausalRepoServer(
                multiServer,
                store,
                stageStore,
                updatesStore
            );
            repoServer.defaultDeviceSelector = {
                username: serverDevice.claims[USERNAME_CLAIM],
                deviceId: serverDevice.claims[DEVICE_ID_CLAIM],
                sessionId: serverDevice.claims[SESSION_ID_CLAIM],
            };

            this._webhooksClient = webhooks.client;

            repoServer.init();
        }
    }

    private _createRepoManager(serverDevice: DeviceInfo, serverUser: AuxUser) {
        const bridge = new ConnectionBridge(serverDevice);
        const client = new CausalRepoClient(bridge.clientConnection);
        const checkout = this._createCheckoutModule();
        const backup = this._createBackupModule();
        const setupChannel = this._createSetupChannelModule();
        const webhooks = this._createWebhooksClient();
        const gpioModules = this._config.gpio
            ? [new GpioModule2(), new SerialModule()]
            : [];
        const manager = new AuxCausalRepoManager(
            serverUser,
            client,
            [
                new AdminModule2(),
                new FilesModule2(this._config.drives),
                new WebhooksModule2(),
                ...gpioModules,
                checkout.module,
                backup.module,
                setupChannel.module,
            ],
            this._config.sandbox === 'deno'
                ? (user, client, branch) =>
                      new DenoSimulationImpl(
                          user,
                          branch,
                          new DenoVM(user, {
                              config: {
                                  version: null,
                                  versionHash: null,
                                  debug: this._config.debug,
                              },
                              partitions: DenoSimulationImpl.createPartitions(
                                  branch,
                                  user,
                                  'http://localhost:3000'
                              ),
                          })
                      )
                : (user, client, branch) =>
                      nodeSimulationForBranch(user, client, branch),
            SERVER_USER_IDS
        );
        return {
            connections: [
                bridge.serverConnection,
                checkout.connection,
                backup.connection,
                setupChannel.connection,
                webhooks.connection,
            ],
            manager,
            webhooksClient: webhooks.client,
        };
    }

    private _createCheckoutModule() {
        // TODO: Allow generating device info from users
        const checkoutUser = getCheckoutUser();
        const checkoutDevice = deviceInfoFromUser(checkoutUser);
        const bridge = new ConnectionBridge(checkoutDevice);
        const client = new CausalRepoClient(bridge.clientConnection);
        const module = new CheckoutModule2(
            (key) => new Stripe(key),
            checkoutUser,
            client
        );

        return {
            connection: bridge.serverConnection,
            module,
        };
    }

    private _createBackupModule() {
        const backupUser = getBackupUser();
        const backupDevice = deviceInfoFromUser(backupUser);
        const bridge = new ConnectionBridge(backupDevice);
        const client = new CausalRepoClient(bridge.clientConnection);
        const module = new BackupModule2(backupUser, client);
        return {
            connection: bridge.serverConnection,
            module,
        };
    }

    private _createSetupChannelModule() {
        const setupChannelUser = getSetupChannelUser();
        const setupChannelDevice = deviceInfoFromUser(setupChannelUser);
        const bridge = new ConnectionBridge(setupChannelDevice);
        const client = new CausalRepoClient(bridge.clientConnection);
        const module = new SetupChannelModule2(setupChannelUser, client);
        return {
            connection: bridge.serverConnection,
            module,
        };
    }

    private _createWebhooksClient() {
        const webhooksUser = getWebhooksUser();
        const webhooksDevice = deviceInfoFromUser(webhooksUser);
        const bridge = new ConnectionBridge(webhooksDevice);
        const client = new CausalRepoClient(bridge.clientConnection);
        return {
            connection: bridge.serverConnection,
            client,
        };
    }

    private async _setupRepoStore(): Promise<
        [CausalRepoStore, CausalRepoStageStore, UpdatesStore]
    > {
        const db = this._mongoClient.db(this._config.repos.mongodb.dbName);
        const objectsCollection = db.collection('objects');
        const headsCollection = db.collection('heads');
        const indexesCollection = db.collection('indexes');
        const reflogCollection = db.collection('reflog');
        const sitelogCollection = db.collection('sitelog');
        const branchSettingsCollection = db.collection('branchSettings');
        const mongoStore = new MongoDBRepoStore(
            objectsCollection,
            headsCollection,
            indexesCollection,
            reflogCollection,
            sitelogCollection,
            branchSettingsCollection
        );
        await mongoStore.init();

        let store: CausalRepoStore = mongoStore;
        if (this._config.repos.cassandra && this._cassandraClient) {
            console.log('[Server] Using Cassandra Support for Causal Repos');
            const cassandraStore = new CassandraDBObjectStore(
                this._config.repos.cassandra,
                this._cassandraClient
            );
            await cassandraStore.init();
            store = new CombinedCausalRepoStore(mongoStore, cassandraStore);
        }

        let stageStore: CausalRepoStageStore;
        if (
            this._config.repos.mongodb &&
            this._config.repos.mongodb.stage === true
        ) {
            console.log(
                '[Server] Using MongoDB Stage support for Causal Repos.'
            );
            const stageCollection = db.collection('stage');
            const mongoStage = (stageStore = new MongoDBStageStore(
                stageCollection
            ));
            await mongoStage.init();
        }
        if (!stageStore) {
            if (this._redisClient) {
                console.log(
                    '[Server] Using Redis Stage support for Causal Repos.'
                );
                stageStore = new RedisStageStore(this._redisClient);
            } else {
                console.log(
                    '[Server] Using Memory Stage support for Causal Repos.'
                );
                stageStore = new MemoryStageStore();
            }
        }

        let updatesStore: UpdatesStore;
        if (this._config.repos.mongodb) {
            const updates = db.collection('updates');
            let store = (updatesStore = new MongoDBUpdatesStore(updates));
            await store.init();
        }

        return [store, stageStore, updatesStore];
    }
}

const SERVER_USER_IDS = [
    'server',
    'server-checkout',
    'server-backup',
    'server-setup-channel',
    'server-webhooks',
];

function getServerUser(): AuxUser {
    return {
        id: 'server',
        name: 'Server',
        username: 'Server',
        token: 'server-tokenbc',
    };
}

function getCheckoutUser(): AuxUser {
    return {
        id: 'server-checkout',
        name: 'Server',
        username: 'Server',
        token: 'server-checkout-token',
    };
}

function getBackupUser(): AuxUser {
    return {
        id: 'server-backup',
        name: 'Server',
        username: 'Server',
        token: 'server-backup-token',
    };
}

function getSetupChannelUser(): AuxUser {
    return {
        id: 'server-setup-channel',
        name: 'Server',
        username: 'Server',
        token: 'server-setup-channel-token',
    };
}

function getWebhooksUser(): AuxUser {
    return {
        id: 'server-webhooks',
        name: 'Server',
        username: 'Server',
        token: 'server-webhooks-token',
    };
}

/**
 * Middleware that calls the given function if the request is for the data portal
 * and skips it if the request is not.
 * @param func
 */
function dataPortalMiddleware(func: express.Handler) {
    return function (req: Request, res: Response, next: NextFunction) {
        if (
            hasValue(req.query.inst ?? req.query.server) &&
            hasValue(req.query[DATA_PORTAL])
        ) {
            return func(req, res, next);
        } else {
            return next();
        }
    };
}
