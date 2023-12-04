import path from 'path';
import {
    paths,
    cleanDirectory,
    getExternals,
} from '../../../script/build-helpers.mjs';
import { GIT_HASH, GIT_TAG } from '../../../script/git-stats.mjs';

const src = path.resolve(paths.root, 'src');
const auxProxy = path.resolve(src, 'aux-proxy');
const dist = path.resolve(auxProxy, 'dist');
const packageJson = path.resolve(auxProxy, 'package.json');
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
                entryPoints: [path.resolve(auxProxy, 'index.ts')],
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
