import * as path from 'path';
import * as os from 'os';
import { ClientConfig } from "./config";
import { getLocalIpAddresses } from './utils';

let domains = [
    'filesimulator.com',
    'projector.filesimulator.com',
    'projector.*.filesimulator.com',
    'projector.localhost',
    'auxbuilder.com',
    'localhost'
];

const env = process.env.NODE_ENV;
if (env === 'production') {
} else {
    const ipAddresses = getLocalIpAddresses();
    domains.push(...ipAddresses);
}

const config: ClientConfig = {
    dist: path.resolve(__dirname, '..', '..', 'aux-web', 'dist'),
    index: 'projector-index.html',
    domains: domains
};

export default config;