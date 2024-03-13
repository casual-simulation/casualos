import * as path from 'path';
import * as fs from 'fs';
import { Config } from './config';
import playerConfig from './player.config';
import { loadConfig } from '../shared/ConfigUtils';

export default function (): Config {
    const backendConfig = loadConfig();

    const config: Config = {
        collaboration: {
            httpPort: 2999,
            tls: null,
            player: playerConfig,
            proxy: {
                trust: 'loopback',
            },
            dist: path.resolve(__dirname, '..', '..', '..', 'aux-web', 'dist'),
            drives: path.resolve(__dirname, '..', '..', '..', 'drives'),
            debug: false,
        },
        backend: {
            httpPort: 2998,
            dist: path.resolve(
                __dirname,
                '..',
                '..',
                '..',
                'aux-web',
                'aux-auth',
                'dist'
            ),
            config: backendConfig,
        },
    };

    return config;
}
