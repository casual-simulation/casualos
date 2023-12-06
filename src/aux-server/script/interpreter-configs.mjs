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
