import path from 'path';
import {
    paths,
    cleanDirectory,
    getExternals,
    replaceEsbuildPlugin,
    replaceThreePlugin,
} from '../../script/build-helpers.mjs';
import { GIT_HASH, GIT_TAG } from '../../script/git-stats.mjs';
import copy from 'esbuild-copy-static-files';

const docs = path.resolve(paths.root, 'docs');
const docsPackageJson = path.resolve(docs, 'package.json');
const docsExternals = [...getExternals(docsPackageJson), 'esbuild', 'path', 'webpack-virtual-modules'];

const typedocPlugin = path.resolve(docs, 'typedoc-plugin');
const staticDir = path.resolve(typedocPlugin, 'static');
const entry = path.resolve(staticDir, 'entry.ts');
const tsconfig = path.resolve(staticDir, 'tsconfig.json');
const types = path.resolve(staticDir, 'types.d.ts');

const typedocDist = path.resolve(typedocPlugin, 'dist');

export {
    createConfigs,
    cleanDirectories,
};

function cleanDirectories() {
    cleanDirectory(typedocDist);
}

function createConfigs(dev, version) {
    const versionVariables = {
        GIT_HASH: JSON.stringify(GIT_HASH),
        GIT_TAG: JSON.stringify(version ?? GIT_TAG),
    };
    const developmentVariables = {
        DEVELOPMENT: JSON.stringify(dev ?? true),
    };
    return [
        [
            'Typedoc',
            {
                entryPoints: [path.resolve(typedocPlugin, 'index.ts')],
                outfile: path.resolve(typedocDist, 'index.js'),
                platform: 'node',
                target: ['node14.16'],
                external: docsExternals,
                define: {
                    ...versionVariables,
                    ...developmentVariables,
                },
                loader: {
                    '.mdx': 'text'
                },
                jsxFactory: 'h',
                jsxFragment: 'Fragment',
                minify: false,
                plugins: [
                    copy({
                        src: entry,
                        dest: path.resolve(
                            typedocDist,
                            'entry.ts'
                        ),
                        force: true,
                    }),
                    copy({
                        src: tsconfig,
                        dest: path.resolve(
                            typedocDist,
                            'tsconfig.json'
                        ),
                        force: true,
                    }),
                    copy({
                        src: types,
                        dest: path.resolve(
                            typedocDist,
                            'types.d.ts'
                        ),
                        force: true,
                    }),
                ],
            },
        ],
    ];
}
