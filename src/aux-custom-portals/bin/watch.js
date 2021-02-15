const esbuild = require('esbuild');
const builds = require('./common');

for (let b of builds) {
    start(b);
}

async function start(build) {
    if (build.type === 'esbuild') {
        await esbuild.build({
            ...build.options,
            watch: true,
        });
    }
}
