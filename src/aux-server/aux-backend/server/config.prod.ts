import * as path from 'path';
import * as process from 'process';
import { Config } from './config';
import playerConfig from './player.config';
import { loadConfig } from '../shared/ConfigUtils';

export default function (): Config {
    const httpPort = parseInt(process.env.NODE_PORT as string) || 3000;
    const debug = process.env.DEBUG === 'true';
    const backendConfig = loadConfig(false);
    const trustProxy = process.env.PROXY_IP_RANGE as string;

    const config: Config = {
        collaboration: {
            httpPort: httpPort,
            tls: null,
            proxy: trustProxy
                ? {
                      trust: trustProxy,
                  }
                : null,
            player: playerConfig,
            dist: path.resolve(__dirname, '..', '..', '..', 'aux-web', 'dist'),
            drives: path.resolve(__dirname, '..', '..', '..', 'drives'),
            debug: debug,
        },
        backend: {
            httpPort: 3002,
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
