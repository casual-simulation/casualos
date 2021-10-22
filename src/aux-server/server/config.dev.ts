import * as path from 'path';
import * as fs from 'fs';
import { Config } from './config';
import playerConfig from './player.config';

const config: Config = {
    socket: {
        pingInterval: 25000,
        pingTimeout: 15000,
        serveClient: false,
    },
    socketPort: 4567,
    httpPort: 2999,
    tls: null,
    player: playerConfig,
    mongodb: {
        url: 'mongodb://127.0.0.1:27017',
        useNewUrlParser: false,
    },
    cassandradb: null,
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
    repos: {
        mongodb: {
            dbName: 'aux-repos',
            stage: true,
        },
        cassandra: null,
    },
    bots: {
        dbName: 'aux-bots',
        timeToLive: 3600,
    },
    directory: {
        server: {
            secret: 'test',
            webhook: null,
        },
        client: {
            upstream: 'http://localhost:2999',
            tunnel: null,
        },
        dbName: 'aux-directory',
    },
    proxy: {
        trust: 'loopback',
    },
    dist: path.resolve(__dirname, '..', '..', 'aux-web', 'dist'),
    drives: path.resolve(__dirname, '..', '..', 'drives'),
    sandbox: 'deno',
    executeLoadedInstances: true,
    gpio: true,
    debug: false,
};

export default config;
