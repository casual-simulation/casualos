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
import fs from 'fs';
import {
    paths,
    cleanDirectory,
    emptyModulePlugin,
    replaceThreePlugin,
} from '../../../script/build-helpers.mjs';
import { GIT_HASH, GIT_TAG } from '../../../script/git-stats.mjs';

const src = path.resolve(paths.root, 'src');
const casualosCli = path.resolve(src, 'casualos-cli');
const dist = path.resolve(casualosCli, 'dist');
const outputFile = path.resolve(dist, 'cli.js');
const packageJson = path.resolve(casualosCli, 'package.json');

export function cleanDirectories() {
    cleanDirectory(dist);
}

export function createConfigs(dev, version) {
    const versionVariables = {
        GIT_HASH: JSON.stringify(GIT_HASH),
        GIT_TAG: JSON.stringify(version ?? GIT_TAG),
    };
    const developmentVariables = {
        DEVELOPMENT: dev ? JSON.stringify(true) : JSON.stringify(false),
    };

    return [
        [
            'CLI',
            {
                entryPoints: [
                    path.resolve(casualosCli, 'index.ts'),
                    path.resolve(casualosCli, 'cli.ts'),
                ],
                outdir: dist,
                platform: 'node',
                target: ['node18.18'],
                define: {
                    ...versionVariables,
                    ...developmentVariables,
                },
                minify: false,
                external: ['open', 'esbuild'],
                plugins: [
                    replaceThreePlugin(),
                    emptyModulePlugin('tigerbeetle-node'),
                    addNodeShebang(),
                ],
            },
        ],
    ];
}

function addNodeShebang() {
    return {
        name: 'addNodeShebang',
        setup: (build) => {
            build.onEnd((result) => {
                const addShebang = () => {
                    const fileData =
                        '#!/usr/bin/env node\n' +
                        fs.readFileSync(outputFile, { encoding: 'utf-8' });
                    fs.writeFileSync(outputFile, fileData, {
                        encoding: 'utf-8',
                        flag: 'w+',
                    });
                };

                if (fs.existsSync(outputFile)) {
                    console.log('Output file exists, adding shebang');
                    addShebang();
                } else {
                    console.log(
                        'Output file does not exist, waiting 5 seconds...'
                    );
                    setTimeout(addShebang, 5000);
                }
            });
        },
    };
}
