import path from 'path';
import { paths, cleanDirectory } from '../../../script/build-helpers.mjs';
import { GIT_HASH, GIT_TAG } from '../../../script/git-stats.mjs';

const src = path.resolve(paths.root, 'src');
const casualosCli = path.resolve(src, 'casualos-cli');
const dist = path.resolve(casualosCli, 'dist');

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
            },
        ],
    ];
}
