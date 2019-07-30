import * as path from 'path';
import * as process from 'process';
import { Config } from './config';
import projectorConfig from './projector.config';
import playerConfig from './player.config';

const redisHost = process.env.REDIS_HOST;
const redisPort = parseInt(process.env.REDIS_PORT);
const httpPort = parseInt(process.env.NODE_PORT) || 3000;

const config: Config = {
    socket: {
        pingInterval: 25000,
        pingTimeout: 15000,
        serveClient: false,
    },
    socketPort: 4567,
    httpPort: httpPort,
    builder: projectorConfig,
    player: playerConfig,
    mongodb: {
        url: process.env.MONGO_URL,
    },
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
    dist: path.resolve(__dirname, '..', '..', 'aux-web', 'dist'),
};

export default config;
