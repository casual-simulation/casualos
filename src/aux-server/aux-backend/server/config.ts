import { WebConfig } from '../../shared/WebConfig';
import redis from 'redis';
import type WebSocket from 'ws';
import { BuilderOptions } from '../shared/ServerBuilder';

export const DRIVES_URL = '/drives';

/**
 * The server config.
 */
export interface Config {
    /**
     * The config for the collaboration features of the server.
     */
    collaboration: {
        socket: WebSocket.ServerOptions;
        httpPort: number;
        player: ClientConfig;
        mongodb: MongoDbConfig;

        redis: RedisConfig | null;
        trees: CausalTreeServerConfig;

        /**
         * The config that should be used for Causal Repos.
         */
        repos: CausalReposServerConfig;
        bots: BotsServerConfig;
        directory: DirectoryConfig;
        proxy: ProxyConfig | null;
        dist: string;
        drives: string;
        tls: TLSOptions | null;

        /**
         * The type of sandbox that should be used.
         */
        sandbox: SandboxType;

        /**
         * Whether to let the server instantate server-side runtimes for instances that get loaded.
         */
        executeLoadedInstances: boolean;

        /**
         * Whether to enable GPIO support.
         */
        gpio: boolean;

        /**
         * Whether to enable debug logging.
         */
        debug: boolean;
    };

    /**
     * The options for the backend API.
     */
    backend: BuilderOptions;
}

export type SandboxType = 'none' | 'deno';

export interface TLSOptions {
    key: string;
    cert: string;
}

export interface ClientConfig {
    index: string;
    manifest: string;
    web: WebConfig;
}

export interface MongoDbConfig {
    url: string;
    useNewUrlParser: boolean;
    useUnifiedTopology?: boolean;
}

export interface RedisConfig {
    options: redis.ClientOpts;
    defaultExpireSeconds: number;
}

export interface CausalTreeServerConfig {
    dbName: string;
}

export interface CausalReposServerConfig {
    redis: RedisCausalReposConfig | null;

    /**
     * The config that should be used for MongoDB support of Causal Repos.
     * A config must be specified for MongoDB.
     */
    mongodb: MongoDBCaualReposConfig;
}

export interface MongoDBCaualReposConfig {
    dbName: string;

    /**
     * Whether to store the atom stage in MongoDB.
     */
    stage: boolean;
}

export interface RedisCausalReposConfig {
    namespace: string;
    maxBranchSizeInBytes: number;
}

/**
 * The config for where bots in the bots store should be kept.
 */
export interface BotsServerConfig {
    /**
     * The name of the database that the bots should be stored in.
     * Each instance gets its own collection.
     */
    dbName: string;

    /**
     * The number of seconds that the bots should live for.
     * Negative numbers prevent bots from being collected.
     */
    timeToLive: number;
}

export interface DirectoryConfig {
    server: DirectoryServerConfig | null;
    client: DirectoryClientConfig | null;

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
    webhook: string | null;
}

export interface DirectoryClientConfig {
    /**
     * The base address of the directory that this AUXPlayer should upload its data to.
     */
    upstream: string;

    /**
     * The base address of the tunnel server that the AUXPlayer should connect to.
     */
    tunnel: string | null;

    /**
     * The local IP Address that the directory client should use.
     * If not provided, then the client will determine the local IP from the attached network interfaces.
     */
    ipAddress?: string;
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
