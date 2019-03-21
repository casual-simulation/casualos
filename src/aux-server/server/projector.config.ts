import * as path from 'path';
import * as os from 'os';
import * as process from 'process';
import { ClientConfig } from "./config";
import { getLocalIpAddresses, getExtraDomainsForSite } from './utils';

let domains = [
    'filesimulator.com',
    'projector.filesimulator.com',
    'projector.*.filesimulator.com',
    'projector.localhost',
    'auxbuilder.com',
    'localhost',
    ...getExtraDomainsForSite('projector')
];

const config: ClientConfig = {
    dist: path.resolve(__dirname, '..', '..', 'aux-web', 'dist'),
    index: 'projector-index.html',
    domains
};

export default config;