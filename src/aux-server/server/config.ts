import { WebConfig } from '../shared/WebConfig';
import { CassandraDBCausalReposConfig } from '@casual-simulation/causal-tree-store-cassandradb';
import redis from 'redis';

export const DRIVES_URL = '/drives';

/**
 * The server config.
 */
export interface Config {
    socket: SocketIO.ServerOptions;
    socketPort: number;
    httpPort: number;
    player: ClientConfig;
    mongodb: MongoDbConfig;

    /**
     * The config that should be used to setup a CassandraDB client.
     * If null, then CassandraDB will not be used.
     */
    cassandradb: CassandraDBConfig | null;
    redis: RedisConfig;
    trees: CausalTreeServerConfig;

    /**
     * The config that should be used for Causal Repos.
     */
    repos: CausalReposServerConfig;
    bots: BotsServerConfig;
    directory: DirectoryConfig;
    proxy: ProxyConfig;
    dist: string;
    drives: string;
    tls: TLSOptions;

    /**
     * The type of sandbox that should be used.
     */
    sandbox: SandboxType;
}

export type SandboxType = 'none' | 'deno';

export interface TLSOptions {
    key: string;
    cert: string;
}

export interface ClientConfig {
    index: string;
    web: WebConfig;
}

export interface MongoDbConfig {
    url: string;
    useNewUrlParser: boolean;
}

export type CassandraDBConfig =
    | StandardCassandraDBConfig
    | AwsCassandraDBConfig;

export interface StandardCassandraDBConfig extends CommonCassandraDBConfig {
    /**
     * The list of hosts that the cassandra client can contact
     * on initialization.
     */
    contactPoints: string[];

    /**
     * The data center that the server is being hosted in.
     * The client will prefer cassandra instances that are hosted in the same data center over others.
     */
    localDataCenter: string;

    /**
     * Whether the server must provide a valid TLS certificate.
     */
    requireTLS: boolean;

    /**
     * The path to the public key file (PEM format) that the server's certificate authority uses.
     */
    certificateAuthorityPublicKey?: string;
}

export interface AwsCassandraDBConfig extends CommonCassandraDBConfig {
    /**
     * The AWS region that should be connected to.
     */
    awsRegion: string;
}

export interface CommonCassandraDBConfig {
    /**
     * The number of miliseconds needed for a request to be logged as slow.
     */
    slowRequestTime: number;

    /**
     * The credentials that should be used to login to Cassandra.
     */
    credentials: {
        username: string;
        password: string;
    } | null;
}

export interface RedisConfig {
    options: redis.ClientOpts;
    defaultExpireSeconds: number;
}

export interface CausalTreeServerConfig {
    dbName: string;
}

export interface CausalReposServerConfig {
    /**
     * The config that should be used for MongoDB support of Causal Repos.
     * A config must be specified for MongoDB.
     */
    mongodb: MongoDBCaualReposConfig;

    /**
     * The config that should be used for CassandraDB support of Causal Repos.
     * If null is given, then CassandraDB support for Casual Repos will be disabled.
     */
    cassandra: CassandraDBCausalReposConfig | null;
}

export interface MongoDBCaualReposConfig {
    dbName: string;
}

/**
 * The config for where bots in the bots store should be kept.
 */
export interface BotsServerConfig {
    /**
     * The name of the database that the bots should be stored in.
     * Each story gets its own collection.
     */
    dbName: string;

    /**
     * The number of seconds that the bots should live for.
     * Negative numbers prevent bots from being collected.
     */
    timeToLive: number;
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
