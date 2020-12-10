import * as path from 'path';
import * as process from 'process';
import {
    Config,
    CassandraDBConfig,
    CommonCassandraDBConfig,
    MongoDBCaualReposConfig,
    MongoDbConfig,
} from './config';
import { CassandraDBCausalReposConfig } from '@casual-simulation/causal-tree-store-cassandradb';
import playerConfig from './player.config';

const redisHost = process.env.REDIS_HOST;
const redisPort = parseInt(process.env.REDIS_PORT);
const httpPort = parseInt(process.env.NODE_PORT) || 3000;

const directoryTokenSecret = process.env.DIRECTORY_TOKEN_SECRET;
const directoryWebhook = process.env.DIRECTORY_WEBHOOK;
const directoryUpstream = process.env.UPSTREAM_DIRECTORY;
const localIpAddress = process.env.LOCAL_IP_ADDRESS;
const tunnel = process.env.PROXY_TUNNEL;
const trustProxy = process.env.PROXY_IP_RANGE;

const cassandraAwsRegion = process.env.CASSANDRA_AWS_REGION;
const cassandraContactPoints = process.env.CASSANDRA_CONTACT_POINTS;
const cassandraLocalDataCenter = process.env.CASSANDRA_LOCAL_DATACENTER;
const cassandraKeyspace = process.env.CASSANDRA_KEYSPACE;
const cassandraCreateKeyspace = process.env.CASSANDRA_CREATE_KEYSPACE;
const cassandraCertificateAuthority =
    process.env.CASSANDRA_CERTIFICATE_AUTHORITY;
const cassandraUsername = process.env.CASSANDRA_USERNAME;
const cassandraPassword = process.env.CASSANDRA_PASSWORD;

let cassandradb: CassandraDBConfig = null;
let cassandraReposConfig: CassandraDBCausalReposConfig = null;

let cassandraCredentials: CommonCassandraDBConfig['credentials'] = cassandraUsername
    ? {
          username: cassandraUsername,
          password: cassandraPassword,
      }
    : null;

if (cassandraAwsRegion) {
    cassandradb = {
        awsRegion: cassandraAwsRegion,
        slowRequestTime: 1000,
        credentials: cassandraCredentials,
    };
} else if (cassandraContactPoints && cassandraLocalDataCenter) {
    cassandradb = {
        contactPoints: cassandraContactPoints.split(','),
        localDataCenter: cassandraLocalDataCenter,
        slowRequestTime: 1000,
        requireTLS: true,
        certificateAuthorityPublicKey: cassandraCertificateAuthority,
        credentials: cassandraCredentials,
    };
    console.log(
        `[Config] Enabling CassandraDB with:\n\tcontactPoints: ${cassandraContactPoints}\n\tlocalDataCenter: ${cassandraLocalDataCenter}`
    );
} else {
    console.log('[Config] Disabling CassandraDB.');
}

if (
    cassandraAwsRegion ||
    (cassandraContactPoints && cassandraLocalDataCenter)
) {
    if (cassandraKeyspace) {
        cassandraReposConfig = {
            keyspace: cassandraKeyspace,
            replication:
                cassandraCreateKeyspace === 'true' && !cassandraAwsRegion
                    ? {
                          class: 'NetworkTopologyStrategy',
                          replicationFactor: 3,
                          dataCenters: {},
                      }
                    : null,
            behavior: {
                // Amazon Keyspaces doesn't support
                // the CQL IN operator.
                allowInOperator: !!cassandraAwsRegion ? false : true,
            },
        };
        console.log(
            `[Config] Enabling CassandraDB for Causal Repos with:\n\tkeyspace: ${cassandraKeyspace}\n\tcreateKeyspace: ${
                cassandraKeyspace === 'true'
            }`
        );
    }
}

const sandboxType = process.env.SANDBOX_TYPE || 'none';

if (sandboxType !== 'deno' && sandboxType !== 'none') {
    throw new Error('The Sandbox Type must be either "deno" or "none".');
}

const stageType = process.env.STAGE_TYPE || 'redis';

if (stageType !== 'redis' && stageType !== 'mongodb') {
    throw new Error('The Stage Type must be either "redis" or "mongodb".');
}

// Defaults to a week.
const botsTimeToLive =
    parseInt(process.env.BOTS_TIME_TO_LIVE) || 60 * 60 * 24 * 7;

const gpio = process.env.GPIO === 'true' || false;

const debug = process.env.DEBUG === 'true';

const mongodb: MongoDbConfig = {
    url: process.env.MONGO_URL,
    useNewUrlParser: !!process.env.MONGO_USE_NEW_URL_PARSER,
};

if ('MONGO_USE_UNIFIED_TOPOLOGY' in process.env) {
    mongodb.useUnifiedTopology = !!process.env.MONGO_USE_UNIFIED_TOPOLOGY;
}

const executeLoadedStories = process.env.EXECUTE_LOADED_STORIES !== 'false';

const config: Config = {
    socket: {
        pingInterval: 25000,
        pingTimeout: 15000,
        serveClient: false,
    },
    socketPort: 4567,
    httpPort: httpPort,
    tls: null,
    player: playerConfig,
    mongodb: mongodb,
    cassandradb: cassandradb,
    redis: redisHost
        ? {
              options: {
                  host: redisHost,
                  port: redisPort,
              },

              // expire after a month
              defaultExpireSeconds: 60 * 60 * 24 * (365 / 12),
          }
        : null,
    trees: {
        dbName: 'aux-trees',
    },
    repos: {
        mongodb: {
            dbName: 'aux-repos',
            stage: stageType === 'mongodb',
        },
        cassandra: cassandraReposConfig,
    },
    bots: {
        dbName: 'aux-bots',
        timeToLive: botsTimeToLive,
    },
    directory: {
        server: directoryWebhook
            ? {
                  secret: directoryTokenSecret,
                  webhook: directoryWebhook,
              }
            : null,
        client: directoryUpstream
            ? {
                  upstream: directoryUpstream,
                  tunnel: tunnel,
                  ipAddress: localIpAddress,
              }
            : null,
        dbName: 'aux-directory',
    },
    proxy: trustProxy
        ? {
              trust: trustProxy,
          }
        : null,
    dist: path.resolve(__dirname, '..', '..', 'aux-web', 'dist'),
    drives: path.resolve(__dirname, '..', '..', 'drives'),
    sandbox: sandboxType,
    executeLoadedStories: executeLoadedStories,
    gpio: gpio,
    debug: debug,
};

export default config;
