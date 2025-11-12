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
import * as Http from 'http';
import * as Https from 'https';
import type { Request, Response } from 'express';
import express from 'express';
import * as bodyParser from 'body-parser';
import cors from 'cors';
import { Binary } from 'mongodb';
import { asyncMiddleware } from './utils';
import path from 'node:path';
import fs from 'node:fs/promises';
import type {
    GenericHttpHeaders,
    GenericHttpRequest,
    RequestScope,
} from '@casual-simulation/aux-common';
import { hasValue } from '@casual-simulation/aux-common';
import type { WebConfig } from '@casual-simulation/aux-common/common/WebConfig';
import compression from 'compression';
import { getStatusCode } from '@casual-simulation/aux-common';
import { WebSocketServer } from 'ws';
import { WSWebsocketMessenger } from '../ws/WSWebsocketMessenger';
import { concatMap, interval } from 'rxjs';
import { constructServerBuilder } from '../shared/LoadServer';
import { RedisWSWebsocketMessenger } from '../redis/RedisWSWebsocketMessenger';
import type {
    RecordsServer,
    ServerConfig,
} from '@casual-simulation/aux-records';
import type { ViewParams } from '@casual-simulation/aux-records/ViewTemplateRenderer';
import { renderToStringAsync } from 'preact-render-to-string';

const isProduction = process.env.NODE_ENV === 'production';

/**
 * Defines a class that represents a fully featured SO4 server.
 */
export class Server {
    private _frontendApp: express.Express;
    private _backendApp: express.Express;
    private _frontendHttp: Http.Server;
    private _backendHttp: Http.Server;
    private _wsServer: WebSocketServer;
    private _config: ServerConfig;
    private _server: RecordsServer;

    constructor(config: ServerConfig) {
        this._config = config;
        this._frontendApp = express();
        this._backendApp = express();
        if (this._config.server.tls) {
            this._frontendHttp = <any>Https.createServer(
                {
                    cert: this._config.server.tls.cert,
                    key: this._config.server.tls.key,
                },
                this._frontendApp
            );
            this._backendHttp = <any>Https.createServer(
                {
                    cert: this._config.server.tls.cert,
                    key: this._config.server.tls.key,
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
        if (!this._config.server.enabled) {
            console.warn('[Server] CasualOS app is disabled.');
            return;
        }
        console.log('[Server] Configuring CasualOS app...');
        if (this._config.server.proxy?.trust) {
            this._frontendApp.set(
                'trust proxy',
                this._config.server.proxy.trust
            );
        }

        await this._configureBackend();

        const frontend = this._frontendApp;

        // TODO: Enable CSP when we know where it works and does not work
        // this._frontendApplyCSP();
        frontend.use(cors());
        frontend.use(compression());
        frontend.use(
            bodyParser.json({
                limit: '5mb',
            })
        );

        frontend.use((req, res, next) => {
            res.setHeader('Referrer-Policy', 'same-origin');
            res.setHeader('Access-Control-Allow-Credentials', 'true');
            next();
        });

        const webConfig = this._config.server.webConfig;
        frontend.get(
            '/api/config',
            asyncMiddleware(async (req, res) => {
                const config: WebConfig = {
                    ...(webConfig as WebConfig),
                    version: 2,
                };
                res.send(config);
            })
        );

        if (this._config.server.drives) {
            const driveMiddleware = this._config.server.drives.dirs.map((dir) =>
                express.static(dir)
            );

            frontend.use(this._config.server.drives.path, driveMiddleware);
        }
        const scope: RequestScope = 'player';

        frontend.get('/api/*', (req, res) => {
            res.sendStatus(404);
        });

        const dist = path.resolve(
            __dirname,
            '..',
            '..',
            '..',
            'aux-web',
            'dist'
        );

        frontend.get('/terms', (req, res) => {
            res.sendFile(path.join(dist, 'terms-of-service.txt'));
        });

        frontend.get('/privacy-policy', (req, res) => {
            res.sendFile(path.join(dist, 'privacy-policy.txt'));
        });

        if (isProduction) {
            frontend.use(express.static(dist));
        }

        frontend.all('*', async (req, res) => {
            await this._handleRequest(req, res, scope);
        });
    }

    private async _handleRequest(
        req: Request,
        res: Response,
        scope: RequestScope
    ) {
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

        const response = await this._server.handleHttpRequest({
            method: req.method as any,
            path: req.path,
            body: req.body,
            ipAddress: req.ip,
            pathParams: req.params,
            query,
            headers,
            scope,
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

    private async _renderTemplate(
        template: string,
        args: ViewParams
    ): Promise<string> {
        for (let key in args) {
            const value = args[key];
            if (value) {
                const rendered = await renderToStringAsync(value);
                template = template.replace(`<!--ssr-${key}-->`, rendered);
            }
        }
        return template;
    }

    private async _configureBackend() {
        const backend = this._backendApp;
        const frontend = this._frontendApp;
        const builder = constructServerBuilder(this._config);

        let viewMap: Map<string, (() => Promise<string>) | string> = new Map();
        if (!isProduction) {
            console.log('[Server] Using Vite view rendering.');
            const frontendSourcePath = path.resolve(
                __dirname,
                '../../../aux-web/aux-player'
            );
            const frontendConfigPath = path.resolve(
                frontendSourcePath,
                'vite.config.mts'
            );
            const frontendIndex = path.resolve(
                frontendSourcePath,
                'index.html'
            );
            const backendSourcePath = path.resolve(
                __dirname,
                '../../../aux-web/aux-auth'
            );
            const backendConfigPath = path.resolve(
                backendSourcePath,
                'vite.config.mts'
            );
            const backendIndex = path.resolve(backendSourcePath, 'index.html');
            const backendIframe = path.resolve(
                backendSourcePath,
                'iframe.html'
            );
            const playerVmIframe = path.resolve(
                frontendSourcePath,
                'aux-vm-iframe.html'
            );
            const playerVmIframeDom = path.resolve(
                frontendSourcePath,
                'aux-vm-iframe-dom.html'
            );

            const { createServer } = await import('vite');
            const playerVite = await createServer({
                configFile: frontendConfigPath,
                server: { middlewareMode: true },
                appType: 'custom',
                root: frontendSourcePath,
            });
            process.on('exit', () => {
                playerVite.close();
            });
            const authVite = await createServer({
                configFile: backendConfigPath,
                server: { middlewareMode: true },
                appType: 'custom',
                root: backendSourcePath,
            });
            process.on('exit', () => {
                authVite.close();
            });

            frontend.use(playerVite.middlewares);
            backend.use(authVite.middlewares);

            viewMap.set('playerIndex', () =>
                fs.readFile(frontendIndex, 'utf-8')
            );
            viewMap.set('playerVmIframe', () =>
                fs.readFile(playerVmIframe, 'utf-8')
            );
            viewMap.set('playerVmIframeDom', () =>
                fs.readFile(playerVmIframeDom, 'utf-8')
            );
            viewMap.set('authIndex', () => fs.readFile(backendIndex, 'utf-8'));
            viewMap.set('authIframe', () =>
                fs.readFile(backendIframe, 'utf-8')
            );
        } else {
            console.log('[Server] Using production view rendering.');
            const dist = path.resolve(
                __dirname,
                '..',
                '..',
                '..',
                'aux-web',
                'dist'
            );
            const authDist = path.resolve(
                __dirname,
                '..',
                '..',
                '..',
                'aux-web',
                'aux-auth',
                'dist'
            );
            const frontendIndex = await fs.readFile(
                path.resolve(dist, 'index.html'),
                'utf-8'
            );
            const backendIndex = await fs.readFile(
                path.resolve(authDist, 'index.html'),
                'utf-8'
            );
            const backendIframe = await fs.readFile(
                path.resolve(authDist, 'iframe.html'),
                'utf-8'
            );
            const playerVmIframe = await fs.readFile(
                path.resolve(dist, 'aux-vm-iframe.html'),
                'utf-8'
            );
            const playerVmIframeDom = await fs.readFile(
                path.resolve(dist, 'aux-vm-iframe-dom.html'),
                'utf-8'
            );
            viewMap.set('playerIndex', frontendIndex);
            viewMap.set('playerVmIframe', playerVmIframe);
            viewMap.set('playerVmIframeDom', playerVmIframeDom);
            viewMap.set('authIndex', backendIndex);
            viewMap.set('authIframe', backendIframe);
        }

        builder.useViewTemplateRenderer({
            render: async (name: string, args: ViewParams) => {
                const fileReader = viewMap.get(name);
                if (fileReader) {
                    const template =
                        typeof fileReader === 'string'
                            ? fileReader
                            : await fileReader();
                    return await this._renderTemplate(template, args);
                }
                return null;
            },
        });

        const {
            server,
            filesController,
            mongoDatabase,
            websocketMessenger,
            websocketController,
        } = await builder.buildAsync();
        this._server = server;

        await builder.ensureInitialized();

        const allowedRecordsOrigins = new Set([
            ...builder.allowedApiOrigins,
            ...builder.allowedAccountOrigins,
        ]);
        const scope: RequestScope = 'auth';

        backend.get(
            '/api/v2/records/file/list',
            express.text({
                type: 'application/json',
            }),
            asyncMiddleware(async (req, res) => {
                await this._handleRequest(req, res, scope);
            })
        );

        if (mongoDatabase) {
            const filesCollection =
                mongoDatabase.collection<any>('recordsFilesData');

            backend.use(
                '/api/v2/records/file/*',
                express.raw({
                    type: () => true,
                    limit: '1GB',
                })
            );

            backend.post(
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

            backend.get(
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

            backend.get(
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

        backend.use(
            '/api/*',
            express.text({
                type: 'application/json',
                limit: '5mb',
            })
        );

        backend.get('/api/:userId/metadata', async (req, res) => {
            await this._handleRequest(req, res, scope);
        });

        backend.put('/api/:userId/metadata', async (req, res) => {
            await this._handleRequest(req, res, scope);
        });

        backend.get('/api/:userId/subscription', async (req, res) => {
            await this._handleRequest(req, res, scope);
        });

        backend.post('/api/:userId/subscription/manage', async (req, res) => {
            await this._handleRequest(req, res, scope);
        });

        backend.all(
            '/api/*',
            asyncMiddleware(async (req, res) => {
                await this._handleRequest(req, res, scope);
            })
        );

        backend.all('*', async (req, res) => {
            await this._handleRequest(req, res, scope);
        });

        if (
            websocketMessenger instanceof WSWebsocketMessenger ||
            websocketMessenger instanceof RedisWSWebsocketMessenger
        ) {
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
        this._frontendHttp.listen(this._config.server.frontendPort, () =>
            console.log(
                `[Server] Frontend listening on port ${this._config.server.frontendPort}!`
            )
        );

        const server = this._backendHttp.listen(
            this._config.server.backendPort,
            () =>
                console.log(
                    `[Server] Backend listening on port ${this._config.server.backendPort}!`
                )
        );

        server.on('upgrade', (request, socket, head) => {
            socket.on('error', (err) => {
                console.error('[Server] Error on websocket.', err);
            });

            this._wsServer.handleUpgrade(request, socket as any, head, (ws) => {
                this._wsServer.emit('connection', ws, request);
            });
        });
    }
}
