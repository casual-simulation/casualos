import express, { Response } from 'express';
import { BotStore } from '../storage/BotStore';
import { AddBotsRequest } from '../../shared/AddBotsRequest';
import { LookupBotsRequest } from '../../shared/LookupBotsRequest';
import { asyncMiddleware } from '../utils';

/**
 * Defines a class that is able to serve requests from a bot http client.
 */
export class BotHttpServer {
    private _app: express.Express;
    private _store: BotStore;

    get app() {
        return this._app;
    }

    constructor(store: BotStore) {
        this._app = express();
        this._store = store;
    }

    configure() {
        this._app.post(
            '/api/bots/upload',
            asyncMiddleware(async (req, res) => {
                // TODO: Add request validation
                const addBotsRequest = req.body as AddBotsRequest;
                await this._store.addBots(
                    addBotsRequest.namespace,
                    addBotsRequest.bots
                );
                res.sendStatus(200);
            })
        );

        this._app.post(
            '/api/bots',
            asyncMiddleware(async (req, res) => {
                // TODO: Add request validation
                const lookupBotsRequest = req.body as LookupBotsRequest;
                const bots = await this._store.findBots(
                    lookupBotsRequest.namespace,
                    lookupBotsRequest.tags
                );
                res.send(bots);
            })
        );
    }
}
