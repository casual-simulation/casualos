const path = require('path');
const esbuild = require('esbuild');
const rollup = require('rollup');
const builds = require('./common');

for (let b of builds) {
    build(b);
}

async function build(build) {
    try {
        if (build.type === 'esbuild') {
            await esbuild.build({
                ...build.options,
            });
        } else {
            const bundle = await rollup.rollup({
                ...build.options,
            });

            await bundle.write({
                dir: path.resolve(__dirname, `../dist/rollup/${build.id}`),
            });
            await bundle.close();
        }
    } catch (err) {
        console.error(err);
    }
}
