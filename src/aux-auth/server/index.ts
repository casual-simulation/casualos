import express, { Response, NextFunction } from 'express';
import path from 'path';
import { AppMetadata } from 'shared/AuthMetadata';
import { MongoClient, MongoClientOptions } from 'mongodb';
import { Magic } from '@magic-sdk/admin';
import pify from 'pify';

declare var MAGIC_SECRET_KEY: string;

const connect = pify(MongoClient.connect);

async function start() {
    let app = express();
    let mongo: MongoClient = await connect('mongodb://127.0.0.1:27017', {
        useNewUrlParser: false,
    });
    const magic = new Magic(MAGIC_SECRET_KEY);

    const db = mongo.db('aux-auth');
    const users = db.collection<AppMetadata>('users');

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

    app.get('*', (req, res) => {
        res.sendFile(path.join(dist, 'index.html'));
    });

    app.listen(3002, () => {
        console.log('[AuxAuth] Listening on port 3002');
    });
}

start();
