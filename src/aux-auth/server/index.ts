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
import { Magic } from '@magic-sdk/admin';
import pify from 'pify';
import {
    formatAuthToken,
    parseAuthToken,
} from '@casual-simulation/aux-common/runtime/Utils';
import { hasValue } from '@casual-simulation/aux-common/bots/BotCalculations';
import { Record } from '@casual-simulation/aux-common/bots/Bot';
import {
    RecordsController,
    Record as NewRecord,
    DataRecordsController,
    FileRecordsController,
    EventRecordsController,
    RecordKey,
} from '@casual-simulation/aux-records';
import { MongoDBRecordsStore } from './MongoDBRecordsStore';
import { MongoDBDataRecordsStore, DataRecord } from './MongoDBDataRecordsStore';
import { MongoDBFileRecordsStore } from './MongoDBFileRecordsStore';
import { MongoDBEventRecordsStore } from './MongoDBEventRecordsStore';
import { LivekitController } from '@casual-simulation/aux-records/LivekitController';
import { AuthController } from '@casual-simulation/aux-records/AuthController';
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
    let mongo: MongoClient = await connect('mongodb://127.0.0.1:27017', {
        useNewUrlParser: false,
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
    const tempRecords = [] as AppRecord[];

    const authStore = new MongoDBAuthStore(users, loginRequests, sessions);
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
        'http://localhost:3002/api/v2/records/file'
    );
    const fileController = new FileRecordsController(recordsManager, fileStore);

    const livekitController = new LivekitController(
        LIVEKIT_API_KEY,
        LIVEKIT_SECRET_KEY,
        LIVEKIT_ENDPOINT
    );

    const messenger = new ConsoleAuthMessenger();
    const authController = new AuthController(authStore, messenger);

    const dist = path.resolve(__dirname, '..', '..', 'web', 'dist');

    app.use(express.json());

    app.use(express.static(dist));

    app.post(
        '/api/v2/login',
        asyncMiddleware(async (req, res) => {
            const { address, addressType } = req.body;

            const requestResult = await authController.requestLogin({
                address,
                addressType,
                ipAddress: req.ip,
            });

            if (requestResult.success) {
                return res.status(200).send(requestResult);
            } else if (requestResult.success === false) {
                if (requestResult.errorCode === 'address_type_not_supported') {
                    return res.status(400).send(requestResult);
                } else if (requestResult.errorCode === 'invalid_address') {
                    return res.status(400).send(requestResult);
                }
            }

            return res.status(500).send(requestResult);
        })
    );

    app.post(
        '/api/v2/completeLogin',
        asyncMiddleware(async (req, res) => {
            const { userId, requestId, code } = req.body;

            const result = await authController.completeLogin({
                userId,
                requestId,
                code,
                ipAddress: req.ip,
            });

            if (result.success) {
                return res.status(200).send(result);
            } else if (result.success === false) {
                if (result.errorCode === 'invalid_code') {
                    return res.status(400).send(result);
                } else if (result.errorCode === 'invalid_request') {
                    return res.status(400).send(result);
                }
            }

            return res.status(500).send(result);
        })
    );

    app.options('/api/v2/records', (req, res) => {
        handleRecordsCorsHeaders(req, res);
        res.status(200).send();
    });

    app.post(
        '/api/v2/records/key',
        asyncMiddleware(async (req, res) => {
            handleRecordsCorsHeaders(req, res);
            const { recordName, policy } = req.body;
            const authorization = req.headers.authorization;

            const userId = await getUserId(authorization);
            const result = await recordsManager.createPublicRecordKey(
                recordName,
                policy,
                userId
            );

            return returnResponse(res, result);
        })
    );

    app.post(
        '/api/v2/records/data',
        asyncMiddleware(async (req, res) => {
            handleRecordsCorsHeaders(req, res);
            const { recordKey, address, data, updatePolicy, deletePolicy } =
                req.body;
            const authorization = req.headers.authorization;

            const userId = await getUserId(authorization);
            const result = await dataManager.recordData(
                recordKey as string,
                address as string,
                data,
                userId,
                updatePolicy,
                deletePolicy
            );

            return returnResponse(res, result);
        })
    );

    app.get(
        '/api/v2/records/data',
        asyncMiddleware(async (req, res) => {
            handleRecordsCorsHeaders(req, res);
            const { recordName, address } = req.query;

            const result = await dataManager.getData(
                recordName as string,
                address as string
            );

            return returnResponse(res, result);
        })
    );

    app.get(
        '/api/v2/records/data/list',
        asyncMiddleware(async (req, res) => {
            handleRecordsCorsHeaders(req, res);
            const { recordName, address } = req.query;

            const result = await dataManager.listData(
                recordName as string,
                address as string
            );

            return returnResponse(res, result);
        })
    );

    app.delete(
        '/api/v2/records/data',
        asyncMiddleware(async (req, res) => {
            handleRecordsCorsHeaders(req, res);
            const { recordKey, address } = req.body;
            const authorization = req.headers.authorization;

            const userId = await getUserId(authorization);

            const result = await dataManager.eraseData(
                recordKey as string,
                address as string,
                userId
            );

            return returnResponse(res, result);
        })
    );

    app.post(
        '/api/v2/records/manual/data',
        asyncMiddleware(async (req, res) => {
            handleRecordsCorsHeaders(req, res);
            const { recordKey, address, data, updatePolicy, deletePolicy } =
                req.body;
            const authorization = req.headers.authorization;

            const userId = await getUserId(authorization);
            const result = await manualDataManager.recordData(
                recordKey as string,
                address as string,
                data,
                userId,
                updatePolicy,
                deletePolicy
            );

            return returnResponse(res, result);
        })
    );

    app.get(
        '/api/v2/records/manual/data',
        asyncMiddleware(async (req, res) => {
            handleRecordsCorsHeaders(req, res);
            const { recordName, address } = req.query;

            const result = await manualDataManager.getData(
                recordName as string,
                address as string
            );

            res.status(200).send(result);
        })
    );

    app.delete(
        '/api/v2/records/manual/data',
        asyncMiddleware(async (req, res) => {
            handleRecordsCorsHeaders(req, res);
            const { recordKey, address } = req.body;
            const authorization = req.headers.authorization;

            const userId = await getUserId(authorization);

            const result = await manualDataManager.eraseData(
                recordKey as string,
                address as string,
                userId
            );

            return returnResponse(res, result);
        })
    );

    app.post(
        '/api/v2/records/file',
        asyncMiddleware(async (req, res) => {
            handleRecordsCorsHeaders(req, res);
            const {
                recordKey,
                fileSha256Hex,
                fileByteLength,
                fileMimeType,
                fileDescription,
            } = req.body;
            const authorization = req.headers.authorization;

            const userId = await getUserId(authorization);

            let headers: {
                [name: string]: string;
            } = {};
            for (let name in req.headers) {
                let values = req.headers[name];
                headers[name] = Array.isArray(values) ? values[0] : values;
            }

            const result = await fileController.recordFile(recordKey, userId, {
                fileSha256Hex,
                fileByteLength,
                fileMimeType,
                fileDescription,
                headers,
            });

            return returnResponse(res, result);
        })
    );

    app.delete(
        '/api/v2/records/file',
        asyncMiddleware(async (req, res) => {
            handleRecordsCorsHeaders(req, res);
            const { recordKey, fileUrl } = req.body;
            const authorization = req.headers.authorization;

            const userId = await getUserId(authorization);
            const url = new URL(fileUrl);
            const fileKey = url.pathname.slice('/api/v2/records/file/'.length);

            const result = await fileController.eraseFile(
                recordKey,
                fileKey,
                userId
            );

            return returnResponse(res, result);
        })
    );

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

    app.get(
        '/api/v2/records/events/count',
        asyncMiddleware(async (req, res) => {
            handleRecordsCorsHeaders(req, res);
            const { recordName, eventName } = req.query;

            const result = await eventManager.getCount(
                recordName as string,
                eventName as string
            );

            return returnResponse(res, result);
        })
    );

    app.post(
        '/api/v2/records/events/count',
        asyncMiddleware(async (req, res) => {
            handleRecordsCorsHeaders(req, res);
            const { recordKey, eventName, count } = req.body;
            const authorization = req.headers.authorization;

            const userId = await getUserId(authorization);
            const result = await eventManager.addCount(
                recordKey as string,
                eventName as string,
                count,
                userId
            );

            return returnResponse(res, result);
        })
    );

    app.post(
        '/api/v2/meet/token',
        asyncMiddleware(async (req, res) => {
            handleRecordsCorsHeaders(req, res);

            const { roomName, userName } = req.body;
            const result = await livekitController.issueToken(
                roomName,
                userName
            );
            return returnResponse(res, result);
        })
    );

    app.get('/api/:issuer/metadata', async (req, res) => {
        try {
            const issuer = req.params.issuer;
            const authorization = req.headers.authorization;
            const userId = await getUserId(authorization);

            if (userId !== issuer) {
                res.sendStatus(403);
            }

            const user = await users.findOne({ _id: issuer });

            if (!user) {
                res.sendStatus(404);
                return;
            }

            res.send({
                name: user.name,
                avatarUrl: user.avatarUrl,
                avatarPortraitUrl: user.avatarPortraitUrl,
                email: user.email,
                phoneNumber: user.phoneNumber,
            });
        } catch (err) {
            console.error(err);
            res.sendStatus(500);
        }
    });

    app.get('/api/emailRules', async (req, res) => {
        try {
            res.send([
                { type: 'deny', pattern: '^test@casualsimulation\\.org$' },
                { type: 'allow', pattern: '@casualsimulation\\.org$' },
            ] as EmailRule[]);
        } catch (err) {
            console.error(err);
            res.sendStatus(500);
        }
    });

    app.get('/api/smsRules', async (req, res) => {
        try {
            res.send([
                { type: 'deny', pattern: '^\\+1999' },
                { type: 'allow', pattern: '^\\+1' },
            ] as EmailRule[]);
        } catch (err) {
            console.error(err);
            res.sendStatus(500);
        }
    });

    app.put('/api/:token/metadata', async (req, res) => {
        const token = req.params.token;

        try {
            console.log('Body', req.body);
            const data: AppMetadata = req.body;

            const validationResult = await authController.validateSessionKey(
                token
            );
            if (validationResult.success) {
                const issuer = validationResult.userId;

                await users.updateOne(
                    { _id: issuer },
                    {
                        $set: {
                            _id: issuer,
                            name: data.name,
                            avatarUrl: data.avatarUrl,
                            avatarPortraitUrl: data.avatarPortraitUrl,
                            email: data.email,
                            phoneNumber: data.phoneNumber,
                        },
                    },
                    {
                        upsert: true,
                    }
                );

                res.status(200).send();
            } else if (validationResult.success === false) {
                if (validationResult.errorCode === 'invalid_key') {
                    res.status(400).send();
                } else if (validationResult.errorCode === 'session_expired') {
                    res.status(403).send();
                } else {
                    res.status(500).send();
                }
            }
        } catch (err) {
            console.error(err);
            res.sendStatus(500);
        }
    });

    const allowedRecordsOrigins = new Set([
        'http://player.localhost:3000',
        'http://localhost:3000',
    ]);

    app.all('/api/*', (req, res) => {
        res.sendStatus(404);
    });

    app.get('*', (req, res) => {
        res.sendFile(path.join(dist, 'index.html'));
    });

    app.listen(2998, () => {
        console.log('[AuxAuth] Listening on port 3002');
    });

    async function getUserId(authorization: string): Promise<string> {
        if (hasValue(authorization) && authorization.startsWith('Bearer ')) {
            const authToken = authorization.substring('Bearer '.length);
            const validationResult = await authController.validateSessionKey(
                authToken
            );
            if (validationResult.success) {
                return validationResult.userId;
            } else {
                console.log('Validation error', validationResult, authToken);
            }
        }
        return null;
    }

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
        if (
            result &&
            result.success === false &&
            result.errorCode === 'not_logged_in'
        ) {
            res.status(401).send(result);
        } else {
            res.status(200).send(result);
        }
    }
}

start();
