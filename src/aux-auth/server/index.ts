import express, { Request, Response, NextFunction, Handler } from 'express';
import path from 'path';
import { AppMetadata, AppService } from '../shared/AuthMetadata';
import {
    Binary,
    Collection,
    Cursor,
    MongoClient,
    MongoClientOptions,
    ObjectId,
} from 'mongodb';
import pify from 'pify';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { hasValue } from '@casual-simulation/aux-common/bots/BotCalculations';
import {
    RecordsController,
    Record as NewRecord,
    DataRecordsController,
    FileRecordsController,
    EventRecordsController,
    RecordKey,
    getStatusCode,
    RecordsHttpServer,
    GenericHttpRequest,
    GenericHttpHeaders,
    SubscriptionController,
    tryParseJson,
    JsonParseResult,
    StripeInterface,
    tryParseSubscriptionConfig,
    RateLimitController,
    PolicyController,
} from '@casual-simulation/aux-records';
import { MongoDBRecordsStore } from '../mongo/MongoDBRecordsStore';
import {
    MongoDBDataRecordsStore,
    DataRecord,
} from '../mongo/MongoDBDataRecordsStore';
import { MongoDBFileRecordsStore } from '../mongo/MongoDBFileRecordsStore';
import { MongoDBEventRecordsStore } from '../mongo/MongoDBEventRecordsStore';
import { LivekitController } from '@casual-simulation/aux-records/LivekitController';
import { AuthController } from '@casual-simulation/aux-records/AuthController';
import { parseSessionKey } from '@casual-simulation/aux-records/AuthUtils';
import { TextItAuthMessenger } from '@casual-simulation/aux-records-aws';
import { AuthMessenger } from '@casual-simulation/aux-records/AuthMessenger';
import {
    MongoDBAuthSession,
    MongoDBAuthStore,
    MongoDBAuthUser,
    MongoDBLoginRequest,
} from '../mongo/MongoDBAuthStore';
import { ConsoleAuthMessenger } from '@casual-simulation/aux-records/ConsoleAuthMessenger';
import { StripeIntegration } from '../shared/StripeIntegration';
import {
    MongoDBRateLimiter,
    MongoDBRateLimitRecord,
} from '../mongo/MongoDBRateLimiter';
import * as dotenv from 'dotenv';
import Stripe from 'stripe';
import { MongoDBPolicyStore } from '../mongo/MongoDBPolicyStore';
import {
    BuilderOptions,
    ServerBuilder,
    optionsSchema,
} from 'shared/ServerBuilder';
import { listEnvironmentFiles, loadEnvFile } from '../shared/EnvUtils';
import { loadConfig } from '../shared/ConfigUtils';

declare const DEVELOPMENT: boolean;

const envFiles = listEnvironmentFiles(path.resolve(__dirname, '..'));

for (let file of envFiles) {
    if (!file.endsWith('.dev.env.json') || DEVELOPMENT) {
        loadEnvFile(file);
    }
}

if (envFiles.length < 0) {
    console.log('[AuxAuth] No environment files found.');
}

const options = loadConfig();

function getAllowedAPIOrigins(): string[] {
    const origins = process.env.ALLOWED_API_ORIGINS;
    if (origins) {
        const values = origins.split(' ');
        return values.filter((v) => !!v);
    }

    return [];
}

const asyncMiddleware: (fn: Handler) => Handler = (fn: Handler) => {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch((er) => {
            next(er);
        });
    };
};

async function start() {
    let app = express();

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
    const filesCollection = mongoDatabase.collection<any>('recordsFilesData');

    const dist = path.resolve(__dirname, '..', '..', 'web', 'dist');

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

    app.listen(2998, () => {
        console.log('[AuxAuth] Listening on port 2998');
    });

    function handleRecordsCorsHeaders(req: Request, res: Response) {
        if (allowedRecordsOrigins.has(req.headers.origin as string)) {
            res.setHeader('Access-Control-Allow-Origin', req.headers.origin);
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

start();
