import * as Http from 'http';
import * as Https from 'https';
import express, { Request, Response } from 'express';
import * as bodyParser from 'body-parser';
import * as path from 'path';
import cors from 'cors';
import { Binary } from 'mongodb';
import { asyncMiddleware } from './utils';
import { Config, DRIVES_URL } from './config';
import {
    hasValue,
    GenericHttpHeaders,
    GenericHttpRequest,
} from '@casual-simulation/aux-common';
import { WebConfig } from '@casual-simulation/aux-common/common/WebConfig';
import compression from 'compression';
import { ServerBuilder } from '../shared/ServerBuilder';
import { getStatusCode } from '@casual-simulation/aux-common';
import { WebSocketServer } from 'ws';
import { WSWebsocketMessenger } from '../ws/WSWebsocketMessenger';
import { concatMap, interval } from 'rxjs';
import { constructServerBuilder } from 'aux-backend/shared/LoadServer';

/**
 * Defines a class that represents a fully featured SO4 server.
 */
export class Server {
    private _frontendApp: express.Express;
    private _backendApp: express.Express;
    private _frontendHttp: Http.Server;
    private _backendHttp: Http.Server;
    private _wsServer: WebSocketServer;
    private _config: Config;

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
        this._wsServer = new WebSocketServer({ noServer: true });
        this._config = config;
    }

    async configure() {
        if (
            this._config.collaboration.proxy &&
            this._config.collaboration.proxy.trust
        ) {
            this._frontendApp.set(
                'trust proxy',
                this._config.collaboration.proxy.trust
            );
        }

        await this._configureBackend();

        // TODO: Enable CSP when we know where it works and does not work
        // this._frontendApplyCSP();
        this._frontendApp.use(cors());
        this._frontendApp.use(compression());
        this._frontendApp.use(
            bodyParser.json({
                limit: '5mb',
            })
        );

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

        this._frontendApp.use(express.static(this._config.collaboration.dist));

        const driveMiddleware = [
            express.static(this._config.collaboration.drives),
            ...[...new Array(5)].map((_, i) =>
                express.static(
                    path.join(this._config.collaboration.drives, i.toString())
                )
            ),
        ];
        this._frontendApp.use(DRIVES_URL, driveMiddleware);

        this._frontendApp.get('/api/*', (req, res) => {
            res.sendStatus(404);
        });

        this._frontendApp.get('/terms', (req, res) => {
            res.sendFile(
                path.join(
                    this._config.collaboration.dist,
                    'terms-of-service.txt'
                )
            );
        });

        this._frontendApp.get('/privacy-policy', (req, res) => {
            res.sendFile(
                path.join(this._config.collaboration.dist, 'privacy-policy.txt')
            );
        });

        this._frontendApp.get('*', (req, res) => {
            res.sendFile(
                path.join(
                    this._config.collaboration.dist,
                    this._config.collaboration.player.index
                )
            );
        });
    }

    private async _configureBackend() {
        const app = this._backendApp;
        const options = this._config.backend.config;
        if (!options) {
            console.log('[Server] Skipping Backend.');
            return;
        }

        const builder = constructServerBuilder(options);

        const {
            server,
            filesController,
            mongoDatabase,
            websocketMessenger,
            websocketController,
        } = await builder.buildAsync();

        await builder.ensureInitialized();

        const allowedRecordsOrigins = new Set([
            ...builder.allowedApiOrigins,
            ...builder.allowedAccountOrigins,
        ]);

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

            const response = await server.handleHttpRequest({
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
                if (
                    typeof response.body === 'object' &&
                    Symbol.asyncIterator in response.body
                ) {
                    for await (let chunk of response.body) {
                        res.write(chunk);
                    }
                    res.end();
                } else {
                    res.send(response.body);
                }
            } else {
                res.send();
            }
        }

        app.use(express.static(dist));

        app.get(
            '/api/v2/records/file/list',
            express.text({
                type: 'application/json',
            }),
            asyncMiddleware(async (req, res) => {
                await handleRequest(req, res);
            })
        );

        if (mongoDatabase) {
            const filesCollection =
                mongoDatabase.collection<any>('recordsFilesData');

            app.use(
                '/api/v2/records/file/*',
                express.raw({
                    type: () => true,
                    limit: '1GB',
                })
            );

            app.post(
                '/api/v2/records/file/*',
                asyncMiddleware(async (req, res) => {
                    // TODO: Secure this endpoint
                    handleRecordsCorsHeaders(req, res);
                    // const recordName = req.headers['record-name'] as string;
                    const recordNameAndFileName = req.path.slice(
                        '/api/v2/records/file/'.length
                    );
                    const [recordName, fileName] =
                        recordNameAndFileName.split('/');

                    if (!recordName || !fileName) {
                        res.status(400).send();
                        return;
                    }

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
                '/api/v2/records/file/:recordName/*',
                asyncMiddleware(async (req, res) => {
                    // TODO: Secure this endpoint
                    handleRecordsCorsHeaders(req, res);
                    const recordNameAndFileName = req.path.slice(
                        '/api/v2/records/file/'.length
                    );
                    const [recordName, fileName] =
                        recordNameAndFileName.split('/');

                    const file = await filesCollection.findOne({
                        recordName,
                        fileName,
                    });

                    if (!file) {
                        res.status(404).send();
                        return;
                    }

                    if (file.body instanceof Binary) {
                        res.status(200)
                            .contentType(file.mimeType)
                            .send(file.body.buffer);
                    } else {
                        res.status(200)
                            .contentType(file.mimeType)
                            .send(file.body);
                    }
                })
            );

            app.get(
                '/api/v2/records/file/*',
                asyncMiddleware(async (req, res) => {
                    // TODO: Secure this endpoint
                    handleRecordsCorsHeaders(req, res);
                    const fileName = req.path.slice(
                        '/api/v2/records/file/'.length
                    );

                    const file = await filesCollection.findOne({
                        fileName,
                    });

                    if (!file) {
                        res.status(404).send();
                        return;
                    }

                    if (file.body instanceof Binary) {
                        res.status(200)
                            .contentType(file.mimeType)
                            .send(file.body.buffer);
                    } else {
                        res.status(200)
                            .contentType(file.mimeType)
                            .send(file.body);
                    }
                })
            );
        }

        app.use(
            '/api/*',
            express.text({
                type: 'application/json',
                limit: '5mb',
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

        if (websocketMessenger instanceof WSWebsocketMessenger) {
            this._wsServer.on('connection', (socket, req) => {
                const id = websocketMessenger.registerConnection(socket);
                const ip = req.socket.remoteAddress;
                const origin = req.headers.origin;
                console.log('[Server] Got connection:', id, ip);

                socket.on('close', async () => {
                    console.log('[Server] Connection closed:', id, ip);
                    await server.handleWebsocketRequest({
                        type: 'disconnect',
                        connectionId: id,
                        ipAddress: ip,
                        body: null,
                        origin: origin,
                    });
                    websocketMessenger.removeConnection(id);
                });

                socket.on('message', async (message, isBinary) => {
                    await server.handleWebsocketRequest({
                        type: 'message',
                        connectionId: id,
                        ipAddress: ip,
                        body: isBinary
                            ? new Uint8Array(message as any)
                            : message.toString('utf-8'),
                        origin: origin,
                    });
                });

                server.handleWebsocketRequest({
                    type: 'connect',
                    connectionId: id,
                    ipAddress: ip,
                    body: null,
                    origin: origin,
                });
            });
        } else {
            console.log('[Server] Websockets integration disabled.');
        }

        if (websocketController) {
            interval(30 * 1000)
                .pipe(
                    concatMap(
                        async () =>
                            await websocketController.savePermanentBranches()
                    )
                )
                .subscribe();
        }

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
    }

    start() {
        this._frontendHttp.listen(this._config.collaboration.httpPort, () =>
            console.log(
                `[Server] Frontend listening on port ${this._config.collaboration.httpPort}!`
            )
        );

        if (this._config.backend.config) {
            const server = this._backendHttp.listen(
                this._config.backend.httpPort,
                () =>
                    console.log(
                        `[Server] Backend listening on port ${this._config.backend.httpPort}!`
                    )
            );

            server.on('upgrade', (request, socket, head) => {
                socket.on('error', (err) => {
                    console.error('[Server] Error on websocket.', err);
                });

                this._wsServer.handleUpgrade(
                    request,
                    socket as any,
                    head,
                    (ws) => {
                        this._wsServer.emit('connection', ws, request);
                    }
                );
            });
        }
    }
}
