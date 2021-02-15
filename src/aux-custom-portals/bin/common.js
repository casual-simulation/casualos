const path = require('path');
const ts = require('rollup-plugin-ts');

module.exports = [
    // esbuild is for fast builds
    {
        id: 'casualos',
        type: 'esbuild',
        options: {
            entryPoints: [path.resolve(__dirname, '../lib/casualos.ts')],
            outfile: path.resolve(__dirname, '../dist/esbuild/casualos.js'),
            bundle: true,
            format: 'esm',
            metafile: path.resolve(
                __dirname,
                '../dist/esbuild/casualos.meta.json'
            ),
            minifySyntax: true,
            external: [
                'lodash',
                'rxjs',
                'three',
                'scrypt-js',
                'base64-js',
                'uuid/v4',
                'uuid/v5',
                'hash.js',
                'tweetnacl',
                'acorn',
                'lru-cache',
                'estraverse',
                'mime',
                'fast-json-stable-stringify',
                'astring',
                '@tweenjs/tween.js',
            ],
        },
    },

    // rollup is for typescript declarations
    {
        id: 'casualos',
        type: 'rollup',
        options: {
            input: path.resolve(__dirname, '../lib/casualos.ts'),
            plugins: [
                ts({
                    // cwd: path.resolve(__dirname, '..'),
                    tsconfig: path.resolve(__dirname, '../tsconfig.d.json'),
                }),
            ],
        },
    },

    {
        id: 'lodash',
        type: 'esbuild',
        options: {
            entryPoints: [path.resolve(__dirname, '../lib/lodash.ts')],
            outfile: path.resolve(__dirname, '../dist/esbuild/lodash.js'),
            bundle: true,
            format: 'esm',
            metafile: path.resolve(
                __dirname,
                '../dist/esbuild/lodash.meta.json'
            ),
            external: [],
        },
    },

    {
        id: 'rxjs',
        type: 'esbuild',
        options: {
            entryPoints: [
                path.resolve(__dirname, '../lib/rxjs.ts'),
                path.resolve(__dirname, '../lib/rxjs-operators.ts'),
            ],
            outdir: path.resolve(__dirname, '../dist/esbuild/rxjs'),
            bundle: true,
            format: 'esm',
            metafile: path.resolve(__dirname, '../dist/esbuild/rxjs.meta.json'),
        },
    },
];
