import path from 'path';
import {
    paths,
    cleanDirectory,
    getExternals,
} from '../../../script/build-helpers.mjs';
import { GIT_HASH, GIT_TAG } from '../../../script/git-stats.mjs';

const src = path.resolve(paths.root, 'src');
const auxBenchmarks = path.resolve(src, 'aux-benchmarks');
const dist = path.resolve(auxBenchmarks, 'dist');
const packageJson = path.resolve(auxBenchmarks, 'package.json');
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
                entryPoints: [path.resolve(auxBenchmarks, 'index.ts')],
                outfile: path.resolve(dist, 'index.js'),
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
