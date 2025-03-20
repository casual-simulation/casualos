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
import {
    paths,
    cleanDirectory,
    getExternals,
} from '../../../script/build-helpers.mjs';
import { GIT_HASH, GIT_TAG } from '../../../script/git-stats.mjs';

const src = path.resolve(paths.root, 'src');
const auxRedirector = path.resolve(src, 'aux-redirector');
const dist = path.resolve(auxRedirector, 'dist');
const packageJson = path.resolve(auxRedirector, 'package.json');
const externals = [...getExternals(packageJson), 'esbuild'];

export function cleanDirectories() {
    cleanDirectory(dist);
}

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
            'Proxy',
            {
                entryPoints: [path.resolve(auxRedirector, 'index.ts')],
                outfile: path.resolve(dist, 'main.js'),
                platform: 'node',
                target: ['node14.16'],
                external: externals,
                define: {
                    ...versionVariables,
                    ...developmentVariables,
                },
                minify: !dev,
            },
        ],
    ];
}
