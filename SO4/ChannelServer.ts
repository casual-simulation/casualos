import {Express} from 'express';
import { StoreFactory, Event, ReducingStateStore, ChannelClient, MemoryConnector, ChannelConnector } from "common/channels-core";
import { SocketIOChannelServer } from "./channels";

import {reducer, FilesStateStore} from 'common/FilesChannel';

export interface ChannelServerConfig {

}

export const storeFactory = new StoreFactory({
    files: () => new FilesStateStore({})
});

export class ChannelServer {

    _server: SocketIOChannelServer;
    _client: ChannelClient;
    _connector: ChannelConnector;

    constructor(config: ChannelServerConfig) {
        this._connector = new MemoryConnector();
        this._client = new ChannelClient(this._connector, storeFactory);
    }

    configure(app: Express, socket: SocketIO.Server) {
        this._server = new SocketIOChannelServer(socket, this._client)
    }
}