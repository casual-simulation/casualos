import * as path from 'path';
import * as fs from 'fs';
import { Config } from './config';
import projectorConfig from './projector.config';
import playerConfig from './player.config';

const home = process.env.HOME;
const hasKeys = fs.existsSync(path.join(home, '.localhost-ssl'));

const config: Config = {
    socket: {
        pingInterval: 25000,
        pingTimeout: 15000,
        serveClient: false,
    },
    socketPort: 4567,
    httpPort: 3000,
    tls: hasKeys
        ? {
              key: fs.readFileSync(
                  path.join(home, '.localhost-ssl/device.key'),
                  'utf8'
              ),
              cert: fs.readFileSync(
                  path.join(home, '.localhost-ssl/localhost.crt'),
                  'utf8'
              ),
          }
        : null,
    builder: projectorConfig,
    player: playerConfig,
    mongodb: {
        url: 'mongodb://127.0.0.1:27017',
    },
    redis: {
        options: {
            host: '127.0.0.1',
            port: 6379,
        },
        defaultExpireSeconds: 60, // expire after a minute
    },
    trees: {
        dbName: 'aux-trees',
    },
    directory: {
        server: {
            secret: 'test',
            webhook: null,
        },
        client: {
            upstream: hasKeys
                ? 'https://localhost:3000'
                : 'http://localhost:3000',
            tunnel: null,
        },
        dbName: 'aux-directory',
    },
    proxy: null,
    dist: path.resolve(__dirname, '..', '..', 'aux-web', 'dist'),
};

export default config;
