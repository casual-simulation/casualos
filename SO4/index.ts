
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
    git: {
        gitlab_server: 'http://localhost:4330/git',
        proxy: {},
        personal_access_token: 'F3xKGrGVJKdaWfZspjC_', // 'L6-KYvscyrdRtwVB8jhF' <-- Ryans laptop,
        default_project: {
            namespace: 'root',
            name: 'default'
        },
        user: {
            email: 'devops@yeticgi.com',
            name: 'Dev Ops'
        },
        admin_username: 'root'
    }
};

const server = new Server(config);

server.configure();
server.start();
