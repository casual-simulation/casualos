const path = require('path');
const ts = require('rollup-plugin-ts');

module.exports = [
    // esbuild is for fast builds
    {
        type: 'esbuild',
        id: 'casualos',
        options: {
            entryPoints: [path.resolve(__dirname, '../lib/casualos.ts')],
            outfile: path.resolve(__dirname, '../dist/esbuild/casualos.js'),
            bundle: true,
            format: 'esm',
            metafile: path.resolve(
                __dirname,
                '../dist/esbuild/casualos.meta.json'
            ),
            external: ['lodash', 'rxjs'],
        },
    },

    // rollup is for typescript declarations
    {
        type: 'rollup',
        id: 'casualos',
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
];
