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
import path from 'path';
import { paths } from '../../../script/build-helpers.mjs';
import { GIT_HASH, GIT_TAG } from '../../../script/git-stats.mjs';

const src = path.resolve(paths.root, 'src');
const auxServer = path.resolve(src, 'aux-server');

const auxWeb = path.resolve(auxServer, 'aux-web');
const auxWebPlayer = path.resolve(auxWeb, 'aux-player');
const auxWebDist = path.resolve(auxWeb, 'dist');

const interpreterEntry = path.resolve(
    auxWebPlayer,
    'shim',
    'interpreter-shim.ts'
);

export function createConfigs(dev, version) {
    const versionVariables = {
        GIT_HASH: JSON.stringify(GIT_HASH),
        GIT_TAG: JSON.stringify(version ?? GIT_TAG),
    };
    const developmentVariables = {
        DEVELOPMENT: JSON.stringify(dev ?? true),
    };
    return [
        [
            'Interpreter',
            {
                entryPoints: [interpreterEntry],
                outfile: path.resolve(auxWebDist, 'interpreter.js'),
                platform: 'browser',
                define: {
                    ...versionVariables,
                    ...developmentVariables,
                },
                minify: !dev,
                sourcemap: true,
            },
        ],
    ];
}
