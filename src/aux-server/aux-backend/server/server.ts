import * as Http from 'http';
import * as Https from 'https';
import express, { Request, Response, NextFunction } from 'express';
import * as bodyParser from 'body-parser';
import * as path from 'path';
import * as url from 'url';
import cors from 'cors';
import pify from 'pify';
import { Binary, MongoClient, MongoClientOptions } from 'mongodb';
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
import { WebhooksModule2, FilesModule2 } from './modules';
import { DirectoryService } from './directory/DirectoryService';
import { MongoDBDirectoryStore } from './directory/MongoDBDirectoryStore';
import { DirectoryStore } from './directory/DirectoryStore';
import { DirectoryClient } from './directory/DirectoryClient';
import { WebSocketClient, requestUrl } from '@casual-simulation/tunnel';
import { RedisStageStore } from './redis/RedisStageStore';
import {
    MemoryStageStore,
    CausalRepoClient,
    CausalRepoStore,
    CausalRepoStageStore,
    UpdatesStore,
} from '@casual-simulation/causal-trees/core2';
import { SetupChannelModule2 } from './modules/SetupChannelModule2';
import { map, first } from 'rxjs/operators';
import { pickBy, sortBy } from 'lodash';
import { BotHttpServer } from './servers/BotHttpServer';
import { MongoDBBotStore } from './mongodb/MongoDBBotStore';
import mime from 'mime';
import { GpioModule2 } from './modules/GpioModule2';
import { SerialModule } from './modules/SerialModule';
import { MongoDBStageStore } from './mongodb/MongoDBStageStore';
import { WebConfig } from '../../shared/WebConfig';
import compression from 'compression';
import { RedisUpdatesStore } from '@casual-simulation/casual-apiary-redis';
import { ServerBuilder } from '../shared/ServerBuilder';
import {
    GenericHttpHeaders,
    GenericHttpRequest,
    getStatusCode,
} from '@casual-simulation/aux-records';

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
    private _redisClient: RedisClient | null;
    private _hgetall: any;
    private _player: ClientConfig;
    private _config: Config;
    private _cacheExpireSeconds: number | null;

    get app() {
        return this._app;
    }

    constructor(
        config: Config,
        player: ClientConfig,
        redisClient: RedisClient | null,
        redisConfig: RedisConfig | null
    ) {
        this._app = express();
        this._config = config;
        this._player = player;
        this._redisClient = redisClient;
        this._hgetall = this._redisClient
            ? util.promisify(this._redisClient.hgetall).bind(this._redisClient)
            : null;
        this._cacheExpireSeconds = redisConfig
            ? redisConfig.defaultExpireSeconds
            : null;
    }

    configure() {
        this._app.use(express.static(this._config.collaboration.dist));

        const driveMiddleware = [
            express.static(this._config.collaboration.drives),
            ...[...new Array(5)].map((_, i) =>
                express.static(
                    path.join(this._config.collaboration.drives, i.toString())
                )
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

                    let optimizedData: Buffer | null = null;
                    let optimizedContentType: string | null = null;
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

                        this._redisClient.EXPIRE(url, expire as number);
                        cacheControl = {
                            public: true,
                            'max-age': expire as number,
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
            res.sendFile(
                path.join(
                    this._config.collaboration.dist,
                    'terms-of-service.txt'
                )
            );
        });

        this._app.get('/privacy-policy', (req, res) => {
            res.sendFile(
                path.join(this._config.collaboration.dist, 'privacy-policy.txt')
            );
        });

        this._app.get('*', (req, res) => {
            res.sendFile(
                path.join(this._config.collaboration.dist, this._player.index)
            );
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
        optimizedContentType: string | null,
        optimizedData: Buffer | null
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
    private _frontendApp: express.Express;
    private _backendApp: express.Express;
    private _frontendHttp: Http.Server;
    private _backendHttp: Http.Server;
    private _config: Config;
    private _client: ClientServer;
    private _mongoClient: MongoClient;
    private _redisClient: RedisClient | null;
    private _directory: DirectoryService;
    private _directoryStore: DirectoryStore;
    private _directoryClient: DirectoryClient;
    private _webhooksClient: CausalRepoClient;
    private _botServer: BotHttpServer;

    constructor(config: Config) {
        this._config = config;
        this._frontendApp = express();
        this._backendApp = express();
        if (this._config.collaboration.tls) {
            this._frontendHttp = <any>Https.createServer(
                {
                    cert: this._config.collaboration.tls.cert,
                    key: this._config.collaboration.tls.key,
                },
                this._frontendApp
            );
            this._backendHttp = <any>Https.createServer(
                {
                    cert: this._config.collaboration.tls.cert,
                    key: this._config.collaboration.tls.key,
                },
                this._backendApp
            );
        } else {
            this._frontendHttp = new Http.Server(this._frontendApp);
            this._backendHttp = new Http.Server(this._backendApp);
        }
        this._config = config;
        this._redisClient = this._config.collaboration.redis
            ? createRedisClient({
                  ...this._config.collaboration.redis.options,
                  return_buffers: true,
              })
            : null;
    }

    async configure() {
        await this._configureBackend();

        if (
            this._config.collaboration.proxy &&
            this._config.collaboration.proxy.trust
        ) {
            this._frontendApp.set(
                'trust proxy',
                this._config.collaboration.proxy.trust
            );
        }

        // TODO: Enable CSP when we know where it works and does not work
        // this._applyCSP();

        this._frontendApp.use(cors());

        this._frontendApp.use(compression());

        this._mongoClient = await connect(
            this._config.collaboration.mongodb.url,
            {
                useNewUrlParser:
                    this._config.collaboration.mongodb.useNewUrlParser,
                useUnifiedTopology:
                    !!this._config.collaboration.mongodb.useUnifiedTopology,
            } as MongoClientOptions
        );

        if (this._config.collaboration.sandbox === 'deno') {
            console.log('[Server] Using Deno Sandboxing');
        } else {
            console.log('[Server] Skipping Sandboxing');
        }

        await this._configureCausalRepoServices();
        this._frontendApp.use(bodyParser.json());

        this._client = new ClientServer(
            this._config,
            this._config.collaboration.player,
            this._redisClient,
            this._config.collaboration.redis
        );
        this._client.configure();

        this._configureBotHttpServer();

        this._frontendApp.use((req, res, next) => {
            res.setHeader('Referrer-Policy', 'same-origin');
            res.setHeader('Access-Control-Allow-Credentials', 'true');
            next();
        });

        const player = this._config.collaboration.player;
        this._frontendApp.get(
            '/api/config',
            asyncMiddleware(async (req, res) => {
                const config: WebConfig = {
                    ...player.web,
                    version: 2,
                };
                res.send(config);
            })
        );

        this._frontendApp.get('/api/manifest', (req, res) => {
            res.sendFile(
                path.join(this._config.collaboration.dist, player.manifest)
            );
        });

        this._frontendApp.post(
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
            this._config.collaboration.directory.dbName
        );
        await this._directoryStore.init();

        await this._serveDirectory();
        await this._startDirectoryClient();

        this._frontendApp.all(
            '/webhook/*',
            asyncMiddleware(async (req, res) => {
                await this._handleWebhook(req, res);
            })
        );
        this._frontendApp.all(
            '/webhook',
            asyncMiddleware(async (req, res) => {
                await this._handleWebhook(req, res);
            })
        );
        this._frontendApp.get(
            '/',
            dataPortalMiddleware(
                asyncMiddleware(async (req, res) => {
                    await this._handleDataPortal(req, res);
                })
            )
        );

        if (this._botServer) {
            this._frontendApp.use(this._botServer.app);
        }

        this._frontendApp.use(this._client.app);
    }

    private async _configureBackend() {
        const app = this._backendApp;
        const options = this._config.backend.config;
        if (!options) {
            console.log('[Server] Skipping Backend.');
            return;
        }

        const allowedRecordsOrigins = new Set([
            'http://localhost:3000',
            'http://localhost:3002',
            'http://player.localhost:3000',
            'https://localhost:3000',
            'https://localhost:3002',
            'https://player.localhost:3000',
            'https://casualos.com',
            'https://casualos.me',
            'https://ab1.link',
            'https://publicos.com',
            'https://alpha.casualos.com',
            'https://static.casualos.com',
            'https://stable.casualos.com',
            ...getAllowedAPIOrigins(),
        ]);

        const builder = new ServerBuilder(options)
            .useAllowedAccountOrigins(allowedRecordsOrigins)
            .useAllowedApiOrigins(allowedRecordsOrigins);

        if (options.prisma && options.mongodb) {
            builder.usePrismaWithMongoDBFileStore();
        } else {
            builder.useMongoDB();
        }

        if (options.textIt && options.textIt.apiKey && options.textIt.flowId) {
            builder.useTextItAuthMessenger();
        } else {
            builder.useConsoleAuthMessenger();
        }

        if (
            options.stripe &&
            options.stripe.secretKey &&
            options.stripe.publishableKey
        ) {
            builder.useStripeSubscriptions();
        }

        if (
            options.rateLimit &&
            options.rateLimit.windowMs &&
            options.rateLimit.maxHits
        ) {
            if (options.redis) {
                builder.useRedisRateLimit();
            } else {
                builder.useMongoDBRateLimit();
            }
        }

        const { server, filesController, mongoDatabase } =
            await builder.buildAsync();
        const filesCollection =
            mongoDatabase.collection<any>('recordsFilesData');

        const dist = this._config.backend.dist;

        async function handleRequest(req: Request, res: Response) {
            const query: GenericHttpRequest['query'] = {};
            for (let key in req.query) {
                const value = req.query[key];
                if (typeof value === 'string') {
                    query[key] = value;
                } else if (Array.isArray(value)) {
                    query[key] = value[0] as string;
                }
            }

            const headers: GenericHttpHeaders = {};
            for (let key in req.headers) {
                const value = req.headers[key];
                if (!value) continue;
                if (typeof value === 'string') {
                    headers[key] = value;
                } else {
                    headers[key] = value[0];
                }
            }

            const response = await server.handleRequest({
                method: req.method as any,
                path: req.path,
                body: req.body,
                ipAddress: req.ip,
                pathParams: req.params,
                query,
                headers,
            });

            for (let key in response.headers) {
                const value = response.headers[key];
                if (hasValue(value)) {
                    res.setHeader(key, value);
                }
            }

            res.status(response.statusCode);

            if (response.body) {
                res.send(response.body);
            } else {
                res.send();
            }
        }

        app.use(express.static(dist));

        app.use(
            '/api/v2/records/file/*',
            express.raw({
                type: () => true,
            })
        );

        app.post(
            '/api/v2/records/file/*',
            asyncMiddleware(async (req, res) => {
                handleRecordsCorsHeaders(req, res);
                const recordName = req.headers['record-name'] as string;

                if (!recordName) {
                    res.status(400).send();
                    return;
                }

                const fileName = req.path.slice('/api/v2/records/file/'.length);
                const mimeType = req.headers['content-type'] as string;

                await filesCollection.insertOne({
                    recordName,
                    fileName,
                    mimeType,
                    body: req.body,
                });

                const result = await filesController.markFileAsUploaded(
                    recordName,
                    fileName
                );

                return returnResponse(res, result);
            })
        );

        app.get(
            '/api/v2/records/file/*',
            asyncMiddleware(async (req, res) => {
                handleRecordsCorsHeaders(req, res);
                const fileName = req.path.slice('/api/v2/records/file/'.length);

                const file = await filesCollection.findOne({
                    fileName,
                });

                if (!file) {
                    res.status(404).send();
                    return;
                }

                if (file.body instanceof Binary) {
                    res.status(200).send(file.body.buffer);
                } else {
                    res.status(200).send(file.body);
                }
            })
        );

        app.use(
            '/api/*',
            express.text({
                type: 'application/json',
            })
        );

        app.get('/api/:userId/metadata', async (req, res) => {
            await handleRequest(req, res);
        });

        app.put('/api/:userId/metadata', async (req, res) => {
            await handleRequest(req, res);
        });

        app.get('/api/:userId/subscription', async (req, res) => {
            await handleRequest(req, res);
        });

        app.post('/api/:userId/subscription/manage', async (req, res) => {
            await handleRequest(req, res);
        });

        app.all(
            '/api/*',
            asyncMiddleware(async (req, res) => {
                await handleRequest(req, res);
            })
        );

        app.get('*', (req, res) => {
            res.sendFile(path.join(dist, 'index.html'));
        });

        app.all('*', (req, res) => {
            res.sendStatus(404);
        });

        function handleRecordsCorsHeaders(req: Request, res: Response) {
            if (allowedRecordsOrigins.has(req.headers.origin as string)) {
                res.setHeader(
                    'Access-Control-Allow-Origin',
                    req.headers.origin as string
                );
                res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
                res.setHeader(
                    'Access-Control-Allow-Headers',
                    'Content-Type, Authorization'
                );
            }
        }

        function returnResponse(res: Response, result: any) {
            const statusCode = getStatusCode(result);
            return res.status(statusCode).send(result);
        }

        function getAllowedAPIOrigins(): string[] {
            const origins = process.env.ALLOWED_API_ORIGINS;
            if (origins) {
                const values = origins.split(' ');
                return values.filter((v) => !!v);
            }

            return [];
        }
    }

    private _configureBotHttpServer() {
        if (!this._config.collaboration.bots) {
            return;
        }
        const db = this._mongoClient.db(this._config.collaboration.bots.dbName);
        const botStore = new MongoDBBotStore(
            this._config.collaboration.bots,
            db
        );
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
            this._config.collaboration.sandbox === 'deno'
                ? new DenoSimulationImpl(
                      user,
                      id,
                      new DenoVM(user, {
                          config: {
                              version: null,
                              versionHash: null,
                              debug: this._config.collaboration.debug,
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
        if (!this._config.collaboration.directory.server) {
            console.log(
                '[Server] Disabling Directory Server because no config is available for it.'
            );
            return;
        }

        console.log('[Server] Starting Directory Server.');

        this._directory = new DirectoryService(
            this._directoryStore,
            this._config.collaboration.directory.server
        );
        this._frontendApp.get(
            '/directory/api',
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
        this._frontendApp.put(
            '/directory/api',
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
        if (!this._config.collaboration.directory.client) {
            console.log(
                '[Server] Disabling Directory Client because no config is available for it.'
            );
            return;
        }

        console.log(
            `[Server] Configuring Directory Client for ${this._config.collaboration.directory.client.upstream}`
        );

        const tunnelClient = this._config.collaboration.directory.client.tunnel
            ? new WebSocketClient(
                  this._config.collaboration.directory.client.tunnel
              )
            : null;

        if (!tunnelClient) {
            console.log(
                '[Server] Disabling tunneling because there is no config available for it.'
            );
        }

        this._directoryClient = new DirectoryClient(
            this._directoryStore,
            tunnelClient,
            this._config.collaboration.directory.client,
            this._config.collaboration.httpPort
        );
    }

    start() {
        this._frontendHttp.listen(this._config.collaboration.httpPort, () =>
            console.log(
                `[Server] Frontend listening on port ${this._config.collaboration.httpPort}!`
            )
        );

        if (this._config.backend.config) {
            this._backendHttp.listen(this._config.backend.httpPort, () =>
                console.log(
                    `[Server] Backend listening on port ${this._config.backend.httpPort}!`
                )
            );
        }

        if (this._directoryClient) {
            console.log(`[Server] Starting Directory Client`);
            this._directoryClient.init();
        }
    }

    private async _configureCausalRepoServices() {
        const [store, stageStore, updatesStore] = await this._setupRepoStore();
        const websocketServer = new WebSocketConnectionServer(
            this._frontendHttp,
            this._config.collaboration.socket
        );
        const serverUser = getServerUser();
        const serverDevice = deviceInfoFromUser(serverUser);

        if (this._config.collaboration.executeLoadedInstances) {
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
        const setupChannel = this._createSetupChannelModule();
        const webhooks = this._createWebhooksClient();
        const gpioModules = this._config.collaboration.gpio
            ? [new GpioModule2(), new SerialModule()]
            : [];
        const manager = new AuxCausalRepoManager(
            serverUser,
            client,
            [
                new AdminModule2(),
                new FilesModule2(this._config.collaboration.drives),
                new WebhooksModule2(),
                ...gpioModules,
                setupChannel.module,
            ],
            this._config.collaboration.sandbox === 'deno'
                ? (user, client, branch) =>
                      new DenoSimulationImpl(
                          user,
                          branch,
                          new DenoVM(user, {
                              config: {
                                  version: null,
                                  versionHash: null,
                                  debug: this._config.collaboration.debug,
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
                setupChannel.connection,
                webhooks.connection,
            ],
            manager,
            webhooksClient: webhooks.client,
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
        const db = this._mongoClient.db(
            this._config.collaboration.repos.mongodb.dbName
        );
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
        let stageStore: CausalRepoStageStore | null = null;
        if (
            this._config.collaboration.repos.mongodb &&
            this._config.collaboration.repos.mongodb.stage === true
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
        if (this._config.collaboration.repos.redis) {
            let store = (updatesStore = new RedisUpdatesStore(
                this._config.collaboration.repos.redis.namespace,
                createRedisClient({
                    ...this._config.collaboration.redis?.options,
                })
            ));
            store.maxBranchSizeInBytes =
                this._config.collaboration.repos.redis.maxBranchSizeInBytes;
        } else if (this._config.collaboration.repos.mongodb) {
            const updates = db.collection('updates');
            let store = (updatesStore = new MongoDBUpdatesStore(updates));
            await store.init();
        } else {
            throw new Error('No updates store configured!');
        }

        return [store, stageStore, updatesStore];
    }
}

const SERVER_USER_IDS = [
    'server',
    'server-checkout',
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
