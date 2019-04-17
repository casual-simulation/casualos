import * as path from 'path';
import { ClientConfig } from "./config";
import { getExtraDomainsForSite } from './utils';
import webConfig from './web.config'

let domains = [
    'player.filesimulator.com',
    'player.*.filesimulator.com',
    'auxplayer.com',
    'player.localhost',
    ...getExtraDomainsForSite('player')
];

const config: ClientConfig = {
    dist: path.resolve(__dirname, '..', '..', 'aux-web', 'dist'),
    index: 'player-index.html',
    domains,
    web: {
        ...webConfig,
        isBuilder: false,
        isPlayer: true
    }
};

export default config;