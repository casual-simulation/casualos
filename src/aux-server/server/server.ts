import * as Http from 'http';
import * as Https from 'https';
import express, { Response } from 'express';
import * as bodyParser from 'body-parser';
import * as path from 'path';
import SocketIO from 'socket.io';
import * as url from 'url';
import cors from 'cors';
import pify from 'pify';
import { MongoClient } from 'mongodb';
import { asyncMiddleware } from './utils';
import { Config, ClientConfig, RedisConfig, DRIVES_URL } from './config';
import {
    CausalTreeServerSocketIO,
    SocketIOConnectionServer,
} from '@casual-simulation/causal-tree-server-socketio';
import {
    MongoDBTreeStore,
    MongoDBRepoStore,
} from '@casual-simulation/causal-tree-store-mongodb';
import {
    auxCausalTreeFactory,
    getChannelBotById,
    getChannelConnectedDevices,
    getConnectedDevices,
    ON_WEBHOOK_ACTION_NAME,
    merge,
} from '@casual-simulation/aux-common';
import { AppVersion, apiVersion } from '@casual-simulation/aux-common';
import uuid from 'uuid/v4';
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
    CausalTreeStore,
    RealtimeChannelInfo,
    DeviceInfo,
    USERNAME_CLAIM,
    DEVICE_ID_CLAIM,
    SESSION_ID_CLAIM,
    SERVER_ROLE,
    deviceInfoFromUser,
} from '@casual-simulation/causal-trees';
import {
    DeviceManagerImpl,
    NullDeviceAuthenticator,
    NullChannelAuthorizer,
    ChannelManager,
    CausalRepoServer,
    MultiConnectionServer,
    ConnectionBridge,
    FixedConnectionServer,
} from '@casual-simulation/causal-tree-server';
import { NodeSigningCryptoImpl } from '../../crypto-node';
import { AuxUser, getTreeName, Simulation } from '@casual-simulation/aux-vm';
import {
    AuxChannelManagerImpl,
    AuxLoadedChannel,
    AdminModule,
    AuxChannelManager,
    AuxCausalRepoManager,
    AdminModule2,
    nodeSimulationForBranch,
} from '@casual-simulation/aux-vm-node';
import {
    BackupModule,
    WebhooksModule2,
    FilesModule2,
    CheckoutModule2,
    BackupModule2,
} from './modules';
import { DirectoryService } from './directory/DirectoryService';
import { MongoDBDirectoryStore } from './directory/MongoDBDirectoryStore';
import { DirectoryStore } from './directory/DirectoryStore';
import { DirectoryClient } from './directory/DirectoryClient';
import { DirectoryClientSettings } from './directory/DirectoryClientSettings';
import { WebSocketClient, requestUrl } from '@casual-simulation/tunnel';
import { CheckoutModule } from './modules/CheckoutModule';
import { WebhooksModule } from './modules/WebhooksModule';
import Stripe from 'stripe';
import csp from 'helmet-csp';
import { CspOptions } from 'helmet-csp/dist/lib/types';
import { FilesModule } from './modules/FilesModule';
import { SetupChannelModule } from './modules/SetupChannelModule';
import { WebConfig } from '../shared/WebConfig';
import { RedisStageStore } from './redis/RedisStageStore';
import {
    MemoryStageStore,
    CausalRepoClient,
} from '@casual-simulation/causal-trees/core2';
import { SetupChannelModule2 } from './modules/SetupChannelModule2';
import { map, first } from 'rxjs/operators';
import { pickBy } from 'lodash';

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
    private _channelManager: ChannelManager;

    get app() {
        return this._app;
    }

    constructor(
        config: Config,
        player: ClientConfig,
        redisClient: RedisClient,
        channelManager: ChannelManager,
        redisConfig: RedisConfig
    ) {
        this._app = express();
        this._config = config;
        this._player = player;
        this._redisClient = redisClient;
        this._channelManager = channelManager;
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
                res.send({
                    ...this._player.web,
                    version: 2,
                });
            })
        );

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
                            const optimizedContentType =
                                cached.optimizedContentType;

                            let [
                                retContentType,
                                retData,
                            ] = this._getDataForBrowser(
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
                                val => !!val
                            )
                        );

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
    private _channelManager: AuxChannelManager;
    private _adminChannel: AuxLoadedChannel;
    private _directory: DirectoryService;
    private _directoryStore: DirectoryStore;
    private _directoryClient: DirectoryClient;
    private _webhooksClient: CausalRepoClient;

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
        if (this._config.proxy && this._config.proxy.trust) {
            this._app.set('trust proxy', this._config.proxy.trust);
        }

        // TODO: Enable CSP when we know where it works and does not work
        // this._applyCSP();

        this._app.use(cors());

        this._mongoClient = await connect(this._config.mongodb.url);
        this._store = new MongoDBTreeStore(
            this._mongoClient,
            this._config.trees.dbName
        );

        await this._configureCausalTreeServices();
        await this._configureCausalRepoServices();
        this._app.use(bodyParser.json());

        this._client = new ClientServer(
            this._config,
            this._config.player,
            this._redisClient,
            this._channelManager,
            this._config.redis
        );
        this._client.configure();

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

        this._app.use(this._client.app);

        this._app.all(
            '/webhook/*',
            asyncMiddleware(async (req, res) => {
                await this._handleWebhook(req, res);
            })
        );
    }

    private _applyCSP() {
        const normalCspOptions: CspOptions = {
            directives: {
                defaultSrc: ["'self'"],
                scriptSrc: ["'self'", 'blob:', "'unsafe-eval'"],
                styleSrc: ['*', "'unsafe-inline'"],
                objectSrc: ['*'],
                fontSrc: ['*'],
                imgSrc: ['*', 'data:', 'blob:'],
                mediaSrc: ['*'],
                frameSrc: ['*'],
                connectSrc: ['*'],
                workerSrc: ["'self'", 'blob:'],
                upgradeInsecureRequests: true,
                sandbox: false,
            },
        };
        const normalCSP = csp(normalCspOptions);
        const kindleCSP = csp(
            merge(normalCspOptions, {
                directives: {
                    // BUG: the 'self' directive doesn't work for scripts loaded
                    // from a sandboxed iframe on the Kindle Silk Browser
                    scriptSrc: ['*', 'blob:', "'unsafe-eval'"],
                },
            })
        );
        this._app.use((req, res, next) => {
            const agent = useragent.parse(req.headers['user-agent']);
            if (agent.device.family === 'Kindle') {
                kindleCSP(req, res, next);
            } else {
                normalCSP(req, res, next);
            }
        });
    }

    private async _handleWebhook(req: Request, res: Response) {
        const id = req.query.auxUniverse;
        if (!id) {
            res.sendStatus(400);
            return;
        }
        let handled = await this._handleV1Webhook(req, res, id);

        if (handled) {
            res.sendStatus(204);
            return;
        }

        handled = await this._handleV2Webhook(req, res, id);
        if (handled) {
            res.sendStatus(204);
            return;
        }

        res.sendStatus(404);
    }

    private async _handleV1Webhook(
        req: Request,
        res: Response,
        id: string
    ): Promise<boolean> {
        const info: RealtimeChannelInfo = {
            id: `aux-${id}`,
            type: 'aux',
        };
        const hasChannel = await this._channelManager.hasChannel(info);

        if (!hasChannel) {
            return false;
        }

        const channel = await this._channelManager.loadChannel(info);
        try {
            await this._sendWebhook(req, channel.simulation);
        } finally {
            channel.subscription.unsubscribe();
        }

        return true;
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
                map(info => info.exists)
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
            await this._sendWebhook(req, simulation);
        } finally {
            simulation.unsubscribe();
        }

        return true;
    }

    private async _sendWebhook(req: Request, simulation: Simulation) {
        const fullUrl = requestUrl(req, req.protocol);
        await simulation.helper.action(ON_WEBHOOK_ACTION_NAME, null, {
            method: req.method,
            url: fullUrl,
            data: req.body,
            headers: req.headers,
        });
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
                        result.entries.map(e => ({
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
            `[Server] Configuring Directory Client for ${
                this._config.directory.client.upstream
            }`
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
            console.log(`Server listening on port ${this._config.httpPort}!`)
        );

        if (this._directoryClient) {
            console.log(`[Server] Starting Directory Client`);
            this._directoryClient.init();
        }
    }

    private async _configureCausalTreeServices() {
        await this._store.init();
        const serverUser: AuxUser = getServerUser();
        const serverDevice: DeviceInfo = deviceInfoFromUser(serverUser);

        const checkout = new CheckoutModule(key => new Stripe(key));
        const webhook = new WebhooksModule();
        const setupChannel = new SetupChannelModule();
        this._channelManager = new AuxChannelManagerImpl(
            serverUser,
            serverDevice,
            this._store,
            auxCausalTreeFactory(),
            new NodeSigningCryptoImpl('ECDSA-SHA256-NISTP256'),
            [
                new AdminModule(),
                new BackupModule(this._store),
                new FilesModule(this._config.drives),
                checkout,
                webhook,
                setupChannel,
            ]
        );
        this._channelManager.automaticallyCreateTrees = false;

        checkout.setChannelManager(this._channelManager);
        webhook.setChannelManager(this._channelManager);
        setupChannel.setChannelManager(this._channelManager);

        const authenticator = new NullDeviceAuthenticator();
        const authorizer = new NullChannelAuthorizer();

        this._treeServer = new CausalTreeServerSocketIO(
            serverDevice,
            this._socket,
            new DeviceManagerImpl(),
            this._channelManager,
            authenticator,
            authorizer
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

            socket.on('disconnect', reason => {
                this._userCount -= 1;
                console.log(
                    `[Server] A user disconnected! Reason: ${reason}. There are now`,
                    this._userCount,
                    'users connected.'
                );
            });
        });
    }

    private async _configureCausalRepoServices() {
        const store = await this._setupRepoStore();
        const socketIOServer = new SocketIOConnectionServer(this._socket);
        const serverUser = getServerUser();
        const serverDevice = deviceInfoFromUser(serverUser);

        const {
            connections,
            manager,
            webhooksClient,
        } = this._createRepoManager(serverDevice, serverUser);
        const fixedServer = new FixedConnectionServer(connections);
        const multiServer = new MultiConnectionServer([
            socketIOServer,
            fixedServer,
        ]);

        const stageStore = this._redisClient
            ? new RedisStageStore(this._redisClient)
            : new MemoryStageStore();
        const repoServer = new CausalRepoServer(multiServer, store, stageStore);
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
    }

    private _createRepoManager(serverDevice: DeviceInfo, serverUser: AuxUser) {
        const bridge = new ConnectionBridge(serverDevice);
        const client = new CausalRepoClient(bridge.clientConnection);
        const checkout = this._createCheckoutModule();
        const backup = this._createBackupModule();
        const setupChannel = this._createSetupChannelModule();
        const webhooks = this._createWebhooksClient();
        const manager = new AuxCausalRepoManager(serverUser, client, [
            new AdminModule2(),
            new FilesModule2(this._config.drives),
            new WebhooksModule2(),
            checkout.module,
            backup.module,
            setupChannel.module,
        ]);
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
            key => new Stripe(key),
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

    private async _setupRepoStore() {
        const db = this._mongoClient.db(this._config.repos.dbName);
        const objectsCollection = db.collection('objects');
        const headsCollection = db.collection('heads');
        const store = new MongoDBRepoStore(objectsCollection, headsCollection);
        await store.init();
        return store;
    }
}

function getServerUser(): AuxUser {
    return {
        id: 'server',
        isGuest: false,
        name: 'Server',
        username: 'Server',
        token: 'server-tokenbc',
    };
}

function getCheckoutUser(): AuxUser {
    return {
        id: 'server-checkout',
        isGuest: false,
        name: 'Server',
        username: 'Server',
        token: 'server-checkout-token',
    };
}

function getBackupUser(): AuxUser {
    return {
        id: 'server-backup',
        isGuest: false,
        name: 'Server',
        username: 'Server',
        token: 'server-backup-token',
    };
}

function getSetupChannelUser(): AuxUser {
    return {
        id: 'server-setup-channel',
        isGuest: false,
        name: 'Server',
        username: 'Server',
        token: 'server-setup-channel-token',
    };
}

function getWebhooksUser(): AuxUser {
    return {
        id: 'server-webhooks',
        isGuest: false,
        name: 'Server',
        username: 'Server',
        token: 'server-webhooks-token',
    };
}
