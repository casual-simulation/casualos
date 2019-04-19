import * as path from 'path';
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
        url: 'mongodb://127.0.0.1:27017',
    },
    trees: {
        dbName: 'aux-trees',
    },
};

export default config;
