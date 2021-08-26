import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import { AppMetadata, AppService } from '../shared/AuthMetadata';
import { Collection, MongoClient, MongoClientOptions, ObjectId } from 'mongodb';
import { Magic } from '@magic-sdk/admin';
import pify from 'pify';
import {
    formatAuthToken,
    parseAuthToken,
} from '@casual-simulation/aux-common/runtime/Utils';

declare var MAGIC_SECRET_KEY: string;

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

async function start() {
    let app = express();
    let mongo: MongoClient = await connect('mongodb://127.0.0.1:27017', {
        useNewUrlParser: false,
    });
    const magic = new Magic(MAGIC_SECRET_KEY, {});

    const db = mongo.db('aux-auth');
    const users = db.collection<AppMetadata>('users');
    const services = db.collection<AppService>('services');
    const permanentRecords = db.collection<AppRecord>('permanentRecords');
    const tempRecords = [] as AppRecord[];

    const dist = path.resolve(__dirname, '..', '..', 'web', 'dist');

    app.use(express.json());

    app.use(express.static(dist));

    app.get('/api/:issuer/metadata', async (req, res) => {
        try {
            const issuer = req.params.issuer;
            const user = await users.findOne({ _id: issuer });

            if (!user) {
                res.sendStatus(404);
                return;
            }
            res.send({
                name: user.name,
                avatarUrl: user.avatarUrl,
                avatarPortraitUrl: user.avatarPortraitUrl,
            });
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
            const issuer = magic.token.getIssuer(token);

            await users.updateOne(
                { _id: issuer },
                {
                    $set: {
                        _id: issuer,
                        name: data.name,
                        avatarUrl: data.avatarUrl,
                        avatarPortraitUrl: data.avatarPortraitUrl,
                    },
                },
                {
                    upsert: true,
                }
            );

            res.status(200).send();
        } catch (err) {
            console.error(err);
            res.sendStatus(500);
        }
    });

    app.get('/api/:issuer/services/:service', async (req, res) => {
        try {
            const issuer = req.params.issuer;
            const service = req.params.service;
            const data = await services.findOne({ userId: issuer, service });

            if (!data) {
                res.sendStatus(404);
                return;
            }
            res.send({
                userId: data.userId,
                service: data.service,
            });
        } catch (err) {
            console.error(err);
            res.sendStatus(500);
        }
    });

    app.put('/api/:token/services', async (req, res) => {
        const token = req.params.token;

        try {
            console.log('Body', req.body);
            const { service, token: serviceToken } = req.body;
            const issuer = magic.token.getIssuer(token);

            magic.token.validate(serviceToken, service);

            await services.updateOne(
                { userId: issuer, service },
                {
                    $set: {
                        userId: issuer,
                        service: service,
                    },
                },
                {
                    upsert: true,
                }
            );

            res.status(200).send();
        } catch (err) {
            console.error(err);
            res.sendStatus(500);
        }
    });

    const allowedRecordsOrigins = new Set([
        'http://player.localhost:3000',
        'http://localhost:3000',
    ]);

    app.options('/api/records', (req, res) => {
        handleRecordsCorsHeaders(req, res);
        res.status(200).send();
    });

    app.post('/api/records', async (req, res) => {
        try {
            handleRecordsCorsHeaders(req, res);
            console.log('secret key', MAGIC_SECRET_KEY);
            console.log('Body', req.body);
            const { token: authToken, address, space, record } = req.body;
            const [token, bundle] = parseAuthToken(authToken);

            magic.token.validate(token, bundle);
            const issuer = magic.token.getIssuer(token);

            let appRecord: AppRecord = {
                issuer: issuer,
                address: address,
                record,
                creationDate: Date.now(),
                visibility: space.endsWith('restricted')
                    ? 'restricted'
                    : 'global',
                authorizedUsers: [formatAuthToken(issuer, bundle)],
            };

            if (
                space === 'permanentGlobal' ||
                space === 'permanentRestricted'
            ) {
                if (hasRecordWithAddress(permanentRecords, issuer, address)) {
                    res.status(409).send();
                    return;
                }
                await saveRecord(permanentRecords, appRecord);
            } else {
                if (
                    tempRecords.find(
                        (r) => r.issuer === issuer && r.address === address
                    )
                ) {
                    res.status(409).send();
                    return;
                }
                tempRecords.push(appRecord);
            }

            res.status(200).send({
                address: address,
                space: space,
                issuer: issuer,
            });
        } catch (err) {
            console.error(err);
            res.sendStatus(500);
        }
    });

    app.get('*', (req, res) => {
        res.sendFile(path.join(dist, 'index.html'));
    });

    app.listen(3002, () => {
        console.log('[AuxAuth] Listening on port 3002');
    });

    async function saveRecord(
        collection: Collection<AppRecord>,
        record: AppRecord
    ) {
        await collection.insertOne({
            ...record,
            _id: new ObjectId(),
        });
    }

    async function hasRecordWithAddress(
        collection: Collection<AppRecord>,
        issuer: string,
        address: string
    ) {
        const count = await collection.count({
            issuer,
            address,
        });

        return count > 0;
    }

    function handleRecordsCorsHeaders(req: Request, res: Response) {
        if (allowedRecordsOrigins.has(req.headers.origin as string)) {
            res.setHeader('Access-Control-Allow-Origin', req.headers.origin);
            res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        }
    }
}

start();
