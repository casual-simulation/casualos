import * as path from 'path';
import { ClientConfig } from "./config";

const config: ClientConfig = {
    dist: path.resolve(__dirname, '..', '..', 'aux-web', 'dist'),
    index: 'player-index.html',
    domains: [
        'player.filesimulator.com',
        'player.*.filesimulator.com',
        'auxplayer.com',
        'player.localhost',
    ]
};

export default config;