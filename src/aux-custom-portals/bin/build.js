const esbuild = require('esbuild');
const path = require('path');

esbuild.buildSync({
    entryPoints: [path.resolve(__dirname, '../lib/test.ts')],
    outfile: path.resolve(__dirname, '../temp/out.js'),
});
