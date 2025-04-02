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
import type { Config } from './config';

const domain = process.env.TARGET_DOMAIN || 'auxplayer.com';
const port = parseInt(process.env.TARGET_PORT || '443');
const secret = process.env.DIRECTORY_TOKEN_SECRET;
const trustProxy = process.env.PROXY_IP_RANGE;
const homeDir = process.env.HOME_DIR || '/home';

const config: Config = {
    httpPort: 3000,
    target: {
        domain,
        port,
    },
    proxy: trustProxy
        ? {
              trust: trustProxy,
          }
        : null,
};

export default config;
