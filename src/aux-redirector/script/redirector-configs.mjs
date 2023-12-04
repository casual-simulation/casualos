import path from 'path';
import {
    paths,
    cleanDirectory,
    watch,
    setup,
    getExternals,
    replaceEsbuildPlugin,
    replaceThreePlugin,
} from '../../../script/build-helpers.mjs';
import fs from 'fs';
import { GIT_HASH, GIT_TAG } from '../../../script/git-stats.mjs';

const src = path.resolve(paths.root, 'src');
const auxRedirector = path.resolve(src, 'aux-redirector');
const dist = path.resolve(auxRedirector, 'dist');
const packageJson = path.resolve(auxRedirector, 'package.json');
const externals = [...getExternals(packageJson), 'esbuild'];

module.exports = {
    createConfigs,
    cleanDirectories,
};

function cleanDirectories() {
    cleanDirectory(dist);
}

function createConfigs(dev, version) {
    const versionVariables = {
        GIT_HASH: JSON.stringify(GIT_HASH),
        GIT_TAG: JSON.stringify(version ?? GIT_TAG),
    };
    const developmentVariables = {
        DEVELOPMENT: dev ?? JSON.stringify(true),
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
