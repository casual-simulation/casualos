import { ChannelServerConfig } from "./ChannelServer";

/**
 * The server config.
 */
export interface Config {
    socket: SocketIO.ServerOptions,
    socketPort: number,
    httpPort: number,
    clients: ClientConfig[],
    channels: ChannelServerConfig,
    mongodb: MongoDbConfig;
    trees: CausalTreeServerConfig;
};

export interface ClientConfig {
    dist: string;
    index: string;
    domains: string[];
}

export interface MongoDbConfig {
    url: string;
}

export interface CausalTreeServerConfig {
    dbName: string;
}
