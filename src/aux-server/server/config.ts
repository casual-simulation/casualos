import { WebConfig } from '../shared/WebConfig';
import redis from 'redis';

/**
 * The server config.
 */
export interface Config {
    socket: SocketIO.ServerOptions;
    socketPort: number;
    httpPort: number;
    builder: ClientConfig;
    player: ClientConfig;
    mongodb: MongoDbConfig;
    redis: RedisConfig;
    trees: CausalTreeServerConfig;
    directory: DirectoryConfig;
    dist: string;
}

export interface ClientConfig {
    index: string;
    web: WebConfig;
}

export interface MongoDbConfig {
    url: string;
}

export interface RedisConfig {
    options: redis.ClientOpts;
    defaultExpireSeconds: number;
}

export interface CausalTreeServerConfig {
    dbName: string;
}

export interface DirectoryConfig {
    /**
     * The secret that should be used for signing/verifying tokens.
     */
    secret: string;

    /**
     * The URL that webhooks should be sent to.
     */
    webhook: string;

    /**
     * The name of the Mongo DB that the directory should store data in.
     */
    dbName: string;
}
