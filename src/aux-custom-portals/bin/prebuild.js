const path = require('path');
const esbuild = require('esbuild');
const rollup = require('rollup');
const builds = require('./common');
const fs = require('fs');

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
            const dir = path.resolve(__dirname, `../dist/rollup/${build.id}`);
            // Only do rollup builds during watch when the output directory does not exist.
            if (!fs.existsSync(dir)) {
                const bundle = await rollup.rollup({
                    ...build.options,
                });

                await bundle.write({
                    dir,
                });
                await bundle.close();
            }
        }
    } catch (err) {
        console.error(err);
    }
}
