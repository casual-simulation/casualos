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

import './env';
import './instrumentation';
import process from 'process';
import { Server } from './server';
import prodConfig from './config.prod';
import devConfig from './config.dev';
import type { Config } from './config';

const env = process.env.NODE_ENV;
let config: Config;
if (env === 'production') {
    console.log('[Server] Using production config.');
    config = prodConfig();
} else {
    console.log('[Server] Using dev config.');
    config = devConfig();
}

const server = new Server(config);

async function init() {
    await configure();
    server.start();
}

init();

async function configure() {
    try {
        await server.configure();
    } catch (ex) {
        console.error(ex);
        process.exit(1);
    }
}
