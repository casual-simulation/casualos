import {Express} from 'express';
import { StoreFactory, Event, ReducingStateStore, ChannelClient, MemoryConnector, ChannelConnector } from "common/channels-core";
import { SocketIOChannelServer } from "./channels";

import {filesReducer, FilesStateStore, storeFactory} from 'common';
import { MongoDBConnector } from './channels/MongoDBConnector';

export interface ChannelServerConfig {
    mongodb: {
        url: string;
        dbName: string;
    }
}

export class ChannelServer {

    _server: SocketIOChannelServer;
    _client: ChannelClient;
    _connector: MongoDBConnector;

    constructor(config: ChannelServerConfig) {
        this._connector = new MongoDBConnector(config.mongodb.url, config.mongodb.dbName);
        this._client = new ChannelClient(this._connector, storeFactory);
    }

    async configure(app: Express, socket: SocketIO.Server) {
        await this._connector.init();
        this._server = new SocketIOChannelServer(socket, this._client)
    }
}