import * as path from 'path';
import * as process from 'process';
import { merge } from 'lodash';
import { Config } from './config';
import projectorConfig from './projector.config';
import playerConfig from './player.config';

const config: Config = {
    socket: {
        pingInterval: 2000,
        pingTimeout: 10000,
        serveClient: false,
    },
    socketPort: 4567,
    httpPort: 3000,
    clients: [projectorConfig, playerConfig],
    mongodb: {
        url: process.env.MONGO_URL,
    },
    redis: {
        options: {
            host: '127.0.0.1',
            port: 6379,
        },

        // expire after a month
        defaultExpireSeconds: 60 * 60 * 24 * (365 / 12),
    },
    trees: {
        dbName: 'aux-trees',
    },
};

export default config;
