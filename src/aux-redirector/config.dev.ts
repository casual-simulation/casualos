import { Config } from './config';

const config: Config = {
    httpPort: 3002,
    target: {
        domain: 'localhost',
        port: 3000,
    },
    proxy: null,
};

export default config;
