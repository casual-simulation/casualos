const path = require('path');
const ts = require('rollup-plugin-ts');
const { emptyModulePlugin, injectModulePlugin } = require('./helpers');

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
            plugins: [
                emptyModulePlugin('three'),
                emptyModulePlugin('scrypt-js'),
                emptyModulePlugin('base64-js'),
                emptyModulePlugin('hash.js', /^hash\.js$/),
                injectModulePlugin('tweetnacl', {
                    randomBytes: null,
                    secretbox: { keyLength: 0 },
                    sign: null,
                }),
                emptyModulePlugin('acorn'),
                emptyModulePlugin('lru-cache'),
                emptyModulePlugin('estraverse'),
                emptyModulePlugin('mime'),
                emptyModulePlugin('fast-json-stable-stringify'),
                emptyModulePlugin('astring'),
                emptyModulePlugin(
                    '@tweenjs/tween.js',
                    /^\@tweenjs\/tween\.js$/
                ),
            ],
            minifySyntax: true,
            external: ['lodash', 'rxjs', 'uuid'],
            logLevel: 'error',
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
            logLevel: 'error',
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
            metafile: path.resolve(
                __dirname,
                '../dist/esbuild/rxjs/rxjs.meta.json'
            ),
            logLevel: 'error',
        },
    },

    {
        id: 'uuid',
        type: 'esbuild',
        options: {
            entryPoints: [path.resolve(__dirname, '../lib/uuid.ts')],
            outfile: path.resolve(__dirname, '../dist/esbuild/uuid.js'),
            bundle: true,
            format: 'esm',
            metafile: path.resolve(__dirname, '../dist/esbuild/uuid.meta.json'),
            logLevel: 'error',
        },
    },
];
