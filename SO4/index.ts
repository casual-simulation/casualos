
import { Server, Config } from './server';
import * as path from 'path';

const config: Config = {
    socket: {
        pingInterval: 2000,
        pingTimeout: 10000,
    },
    socketPort: 4567,
    httpPort: 3000,
    client: {
        dist: path.resolve(__dirname, '..', '..', 'WebClient', 'dist')
    },
    channels: {
        mongodb: {
            url: 'mongodb://localhost:27017',
            dbName: 'SO4'
        }
    }
};

const server = new Server(config);

async function init() {
    await server.configure();
    server.start();
}

init();