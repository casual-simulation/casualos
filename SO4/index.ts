
import { Server, Config } from './server';
import * as path from 'path';

const config: Config = {
    socket: {
        pingInterval: 2000,
        pingTimeout: 10000,
        transports: ['websocket']
    },
    socketPort: 4567,
    httpPort: 3000,
    client: {
        dist: path.resolve(__dirname, '..', '..', 'WebClient', 'dist')
    },
    git: {
        gitlab_server: 'http://localhost:4330/git',
        proxy: {},
        personal_access_token: 'L6-KYvscyrdRtwVB8jhF'
    }
};

const server = new Server(config);

server.configure();
server.start();
