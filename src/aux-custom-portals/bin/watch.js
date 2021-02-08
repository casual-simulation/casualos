const esbuild = require('esbuild');
const { options } = require('./common');

start();

async function start() {
    await esbuild.build({
        ...options,
        watch: true,
    });
}
