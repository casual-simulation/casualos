import * as path from 'path';
import * as process from 'process';
import { Config, MongoDbConfig, SandboxType } from './config';
import playerConfig from './player.config';
import { loadConfig } from '../shared/ConfigUtils';

export default function (): Config {
    const redisHost = process.env.REDIS_HOST;
    const redisPort = parseInt(process.env.REDIS_PORT as string);
    const httpPort = parseInt(process.env.NODE_PORT as string) || 3000;

    const directoryTokenSecret = process.env.DIRECTORY_TOKEN_SECRET as string;
    const directoryWebhook = process.env.DIRECTORY_WEBHOOK as string;
    const directoryUpstream = process.env.UPSTREAM_DIRECTORY as string;
    const localIpAddress = process.env.LOCAL_IP_ADDRESS as string;
    const tunnel = process.env.PROXY_TUNNEL as string;
    const trustProxy = process.env.PROXY_IP_RANGE as string;

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
        parseInt(process.env.BOTS_TIME_TO_LIVE as string) || 60 * 60 * 24 * 7;

    const gpio = process.env.GPIO === 'true' || false;

    const debug = process.env.DEBUG === 'true';

    const mongodb: MongoDbConfig = {
        url: process.env.MONGO_URL as string,
        useNewUrlParser: !!process.env.MONGO_USE_NEW_URL_PARSER,
    };

    if ('MONGO_USE_UNIFIED_TOPOLOGY' in process.env) {
        mongodb.useUnifiedTopology = !!process.env.MONGO_USE_UNIFIED_TOPOLOGY;
    }

    const executeLoadedStories = process.env.EXECUTE_LOADED_STORIES !== 'false';

    const backendConfig = loadConfig(false);

    const config: Config = {
        collaboration: {
            socket: {},
            httpPort: httpPort,
            tls: null,
            player: playerConfig,
            mongodb: mongodb,
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
                redis: null,
                mongodb: {
                    dbName: 'aux-repos',
                    stage: stageType === 'mongodb',
                },
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
            dist: path.resolve(__dirname, '..', '..', '..', 'aux-web', 'dist'),
            drives: path.resolve(__dirname, '..', '..', '..', 'drives'),
            sandbox: sandboxType as SandboxType,
            executeLoadedInstances: executeLoadedStories,
            gpio: gpio,
            debug: debug,
        },
        backend: {
            httpPort: 3002,
            dist: path.resolve(
                __dirname,
                '..',
                '..',
                '..',
                'aux-web',
                'aux-auth',
                'dist'
            ),
            config: backendConfig,
        },
    };

    return config;
}
