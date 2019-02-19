import { Config } from "./server";
import * as path from 'path';

const config: Config = {
    socket: {
        pingInterval: 2000,
        pingTimeout: 10000,
        serveClient: false
    },
    socketPort: 4567,
    httpPort: 3000,
    client: {
        dist: path.resolve(__dirname, '..', '..', 'WebClient', 'dist')
    },
    channels: {
        mongodb: {
            url: 'mongodb://127.0.0.1:27017',
            dbName: 'SO4'
        }
    }
};

export default config;