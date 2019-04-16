import * as path from 'path';
import * as os from 'os';
import * as process from 'process';
import { ClientConfig } from "./config";
import { getLocalIpAddresses, getExtraDomainsForSite } from './utils';
import webConfig from './web.config';

let domains = [
    'filesimulator.com',
    'projector.filesimulator.com',
    'projector.*.filesimulator.com',
    'projector.localhost',
    'auxbuilder.com',
    ...getExtraDomainsForSite('projector')
];

const config: ClientConfig = {
    dist: path.resolve(__dirname, '..', '..', 'aux-web', 'dist'),
    index: 'projector-index.html',
    domains,
    web: {
        ...webConfig,
        isBuilder: true,
        isPlayer: false
    }
};

export default config;