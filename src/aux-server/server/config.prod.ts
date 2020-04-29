import * as path from 'path';
import * as process from 'process';
import {
    Config,
    CassandraDBConfig,
    CassandraDBCausalReposConfig,
} from './config';
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

const cassandraContactPoints = process.env.CASSANDRA_CONTACT_POINTS;
const cassandraLocalDataCenter = process.env.CASSANDRA_LOCAL_DATACENTER;
const cassandraKeyspace = process.env.CASSANDRA_KEYSPACE;
const cassandraCreateKeyspace = process.env.CASSANDRA_CREATE_KEYSPACE;

let cassandradb: CassandraDBConfig = null;
let cassandraReposConfig: CassandraDBCausalReposConfig = null;

if (cassandraContactPoints && cassandraLocalDataCenter) {
    cassandradb = {
        contactPoints: cassandraContactPoints.split(','),
        localDataCenter: cassandraLocalDataCenter,
        slowRequestTime: 1000,
    };
    console.log(
        `[Config] Enabling CassandraDB with:\n\tcontactPoints: ${cassandraContactPoints}\n\tlocalDataCenter: ${cassandraLocalDataCenter}`
    );

    if (cassandraKeyspace) {
        cassandraReposConfig = {
            keyspace: cassandraKeyspace,
            replication:
                cassandraCreateKeyspace === 'true'
                    ? {
                          class: 'NetworkTopologyStrategy',
                          replicationFactor: 3,
                          dataCenters: {},
                      }
                    : null,
        };
        console.log(
            `[Config] Enabling CassandraDB for Causal Repos with:\n\tkeyspace: ${cassandraKeyspace}\n\tcreateKeyspace: ${cassandraKeyspace ===
                'true'}`
        );
    }
} else {
    console.log('[Config] Disabling CassandraDB.');
}

// Defaults to a week.
const botsTimeToLive =
    parseInt(process.env.BOTS_TIME_TO_LIVE) || 60 * 60 * 24 * 7;

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
    mongodb: {
        url: process.env.MONGO_URL,
    },
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
};

export default config;
