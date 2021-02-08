const path = require('path');

module.exports = {
    options: {
        entryPoints: [path.resolve(__dirname, '../lib/test.ts')],
        outfile: path.resolve(__dirname, '../dist/out.js'),
        bundle: true,
        format: 'esm',
        metafile: path.resolve(__dirname, '../dist/meta.json'),
        external: ['lodash', 'rxjs'],
    },
};
