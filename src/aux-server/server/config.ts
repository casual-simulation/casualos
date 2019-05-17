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
