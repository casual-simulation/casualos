/* CasualOS is a set of web-based tools designed to facilitate the creation of real-time, multi-user, context-aware interactive experiences.
 *
 * Copyright (c) 2019-2025 Casual Simulation, Inc.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */
import * as path from 'path';
import * as process from 'process';
import type { Config } from './config';
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
            httpPort: parseInt(process.env.BACKEND_PORT as string) || 3002,
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
