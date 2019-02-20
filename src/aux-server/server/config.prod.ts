import { Config } from "./server";
import * as path from 'path';
import * as process from 'process';

const config: Config = {
    socket: {
        pingInterval: 2000,
        pingTimeout: 10000,
        serveClient: false
    },
    socketPort: 4567,
    httpPort: 3000,
    client: {
        dist: path.resolve(__dirname, '..', '..', 'aux-projector', 'dist')
    },
    channels: {
        mongodb: {
            url: process.env.MONGO_URL,
            dbName: 'SO4'
        }
    }
};

export default config;