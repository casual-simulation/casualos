import {Express} from 'express';
import {
    ChannelClient,
    storeFactory
} from "@yeti-cgi/aux-common";
import { SocketIOChannelServer } from "./channels";
import { MongoDBConnector } from './channels/MongoDBConnector';
import { MongoClient } from 'mongodb';

export interface ChannelServerConfig {
    mongodb: {
        dbName: string;
    }
}

export class ChannelServer {

    _server: SocketIOChannelServer;
    _client: ChannelClient;
    _connector: MongoDBConnector;

    constructor(config: ChannelServerConfig, socket: SocketIO.Server, mongoClient: MongoClient) {
        this._connector = new MongoDBConnector(mongoClient, config.mongodb.dbName);
        this._client = new ChannelClient(this._connector, storeFactory);
        this._connector.init();
        this._server = new SocketIOChannelServer(socket, this._client);
    }
}