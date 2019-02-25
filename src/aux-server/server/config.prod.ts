import * as path from 'path';
import * as process from 'process';
import { merge } from "lodash";
import { Config } from "./config";
import projectorConfig from './projector.config';
import playerConfig from './player.config';

const config: Config = {
    socket: {
        pingInterval: 2000,
        pingTimeout: 10000,
        serveClient: false
    },
    socketPort: 4567,
    httpPort: 3000,
    clients: [
        projectorConfig,
        playerConfig
    ],
    channels: {
        mongodb: {
            url: process.env.MONGO_URL,
            dbName: 'SO4'
        }
    }
};

export default config;