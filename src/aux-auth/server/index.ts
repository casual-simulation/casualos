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
import { hasValue } from '@casual-simulation/aux-common/bots/BotCalculations';
import { Record } from '@casual-simulation/aux-common/bots/Bot';
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
} from '@casual-simulation/aux-records';
import { MongoDBRecordsStore } from './MongoDBRecordsStore';
import { MongoDBDataRecordsStore, DataRecord } from './MongoDBDataRecordsStore';
import { MongoDBFileRecordsStore } from './MongoDBFileRecordsStore';
import { MongoDBEventRecordsStore } from './MongoDBEventRecordsStore';
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
} from './MongoDBAuthStore';
import { ConsoleAuthMessenger } from '@casual-simulation/aux-records/ConsoleAuthMessenger';

// declare var MAGIC_SECRET_KEY: string;

const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY ?? 'APIu7LWFmsZckWx';
const LIVEKIT_SECRET_KEY =
    process.env.LIVEKIT_SECRET_KEY ??
    'YOaoO1yUQgugMgn77dSYiVLzqdmiITNUgs3TNeZAufZ';
const LIVEKIT_ENDPOINT = process.env.LIVEKIT_ENDPOINT ?? 'ws://localhost:7880';
const MONGO_URL = process.env.MONGO_URL ?? 'mongodb://127.0.0.1:27017';
const MONGO_USE_NEW_URL_PARSER =
    process.env.MONGO_USE_NEW_URL_PARSER ?? 'false';

function getAuthMessenger(): AuthMessenger {
    const API_KEY = process.env.TEXT_IT_API_KEY;
    const FLOW_ID = process.env.TEXT_IT_FLOW_ID;

    if (API_KEY && FLOW_ID) {
        console.log('[AuxAuth] Using TextIt Auth Messenger.');
        return new TextItAuthMessenger(API_KEY, FLOW_ID);
    } else {
        console.log('[AuxAuth] Using Console Auth Messenger.');
        return new ConsoleAuthMessenger();
    }
}

function getAllowedAPIOrigins(): string[] {
    const origins = process.env.ALLOWED_API_ORIGINS;
    if (origins) {
        const values = origins.split(' ');
        return values.filter((v) => !!v);
    }

    return [];
}

const connect = pify(MongoClient.connect);

type RecordVisibility = 'global' | 'restricted';

interface AppRecord {
    _id?: string;
    issuer: string;
    address: string;
    visibility: RecordVisibility;
    creationDate: number;
    authorizedUsers: string[];
    record: any;
}

export interface EmailRule {
    type: 'allow' | 'deny';
    pattern: string;
}

// see https://stackoverflow.com/a/6969486/1832856
function escapeRegExp(str: string) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
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
    let mongo: MongoClient = await connect(MONGO_URL, {
        useNewUrlParser: MONGO_USE_NEW_URL_PARSER,
    });
    // const magic = new Magic(MAGIC_SECRET_KEY, {});
    let cursors = new Map<string, Cursor<AppRecord>>();

    const db = mongo.db('aux-auth');
    const users = db.collection<MongoDBAuthUser>('users');
    const loginRequests = db.collection<MongoDBLoginRequest>('loginRequests');
    const sessions = db.collection<MongoDBAuthSession>('sessions');
    const permanentRecords = db.collection<AppRecord>('permanentRecords');
    const recordsCollection = db.collection<NewRecord>('records');
    const recordsKeysCollection = db.collection<RecordKey>('recordsKeys');
    const recordsDataCollection = db.collection<DataRecord>('recordsData');
    const manualRecordsDataCollection =
        db.collection<DataRecord>('manualRecordsData');
    const recordsFilesCollection = db.collection<any>('recordsFilesInfo');
    const filesCollection = db.collection<any>('recordsFilesData');
    const recordsEventsCollection = db.collection<any>('recordsEvents');
    const emailRules = db.collection<any>('emailRules');
    const smsRules = db.collection<any>('smsRules');
    const tempRecords = [] as AppRecord[];

    const authStore = new MongoDBAuthStore(
        users,
        loginRequests,
        sessions,
        emailRules,
        smsRules
    );
    const recordsStore = new MongoDBRecordsStore(
        recordsCollection,
        recordsKeysCollection
    );
    const recordsManager = new RecordsController(recordsStore);
    const dataStore = new MongoDBDataRecordsStore(recordsDataCollection);
    const dataManager = new DataRecordsController(recordsManager, dataStore);
    const eventStore = new MongoDBEventRecordsStore(recordsEventsCollection);
    const eventManager = new EventRecordsController(recordsManager, eventStore);

    const manualDataStore = new MongoDBDataRecordsStore(
        manualRecordsDataCollection
    );
    const manualDataManager = new DataRecordsController(
        recordsManager,
        manualDataStore
    );

    const fileStore = new MongoDBFileRecordsStore(
        recordsFilesCollection,
        'http://localhost:2998/api/v2/records/file'
    );
    const fileController = new FileRecordsController(recordsManager, fileStore);

    const livekitController = new LivekitController(
        LIVEKIT_API_KEY,
        LIVEKIT_SECRET_KEY,
        LIVEKIT_ENDPOINT
    );

    const messenger = getAuthMessenger();
    const authController = new AuthController(authStore, messenger);

    const dist = path.resolve(__dirname, '..', '..', 'web', 'dist');

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

    const server = new RecordsHttpServer(
        allowedRecordsOrigins,
        allowedRecordsOrigins,
        authController,
        livekitController,
        recordsManager,
        eventManager,
        dataManager,
        manualDataManager,
        fileController
    );

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
            res.setHeader(key, response.headers[key]);
        }

        res.status(response.statusCode);

        if (response.body) {
            res.send(response.body);
        }
    }

    app.use(express.json());

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

            const result = await fileController.markFileAsUploaded(
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

            res.setHeader('record-name', file.recordName);
            res.setHeader('content-type', file.mimeType);
            if (file.body instanceof Binary) {
                res.status(200).send(file.body.buffer);
            } else {
                res.status(200).send(file.body);
            }
        })
    );

    app.get('/api/:userId/metadata', async (req, res) => {
        await handleRequest(req, res);
    });

    app.put('/api/:userId/metadata', async (req, res) => {
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
