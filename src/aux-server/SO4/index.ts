
import process from 'process';
import { Server, Config } from './server';

import prodConfig from './config.prod';
import devConfig from './config.dev'; 

const env = process.env.NODE_ENV;
let config: Config;
if(env === 'production') {
    config = prodConfig;
} else {
    config = devConfig;
}

const server = new Server(config);

async function init() {
    await server.configure();
    server.start();
}

init();
