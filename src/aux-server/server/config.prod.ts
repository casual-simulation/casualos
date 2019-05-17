import * as path from 'path';
import * as process from 'process';
import { merge } from 'lodash';
import { Config } from './config';
import projectorConfig from './projector.config';
import playerConfig from './player.config';

const redisHost = process.env.REDIS_HOST;
const redisPort = parseInt(process.env.REDIS_PORT);

const config: Config = {
    socket: {
        pingInterval: 2000,
        pingTimeout: 10000,
        serveClient: false,
    },
    socketPort: 4567,
    httpPort: 3000,
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
