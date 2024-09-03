import path from 'path';
import fs from 'fs';
import {
    paths,
    cleanDirectory,
    getExternals,
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
                external: ['open'],
                plugins: [addNodeShebang()],
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
