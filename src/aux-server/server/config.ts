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
    proxy: ProxyConfig;
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
    server: DirectoryServerConfig;
    client: DirectoryClientConfig;

    dbName: string;
}

export interface DirectoryServerConfig {
    /**
     * The secret that should be used for signing/verifying tokens.
     */
    secret: string;

    /**
     * The URL that webhooks should be sent to.
     */
    webhook: string;
}

export interface DirectoryClientConfig {
    /**
     * The base address of the directory that this AUXPlayer should upload its data to.
     */
    upstream: string;

    /**
     * The base address of the tunnel server that the AUXPlayer should connect to.
     */
    tunnel: string;
}

/**
 * The proxy config.
 */
export interface ProxyConfig {
    /**
     * The IP Address range of proxies that should be trusted.
     */
    trust: string;
}
