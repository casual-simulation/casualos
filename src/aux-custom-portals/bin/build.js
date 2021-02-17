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
            const dir = path.resolve(__dirname, `../dist/rollup/${build.id}`);
            const bundle = await rollup.rollup({
                ...build.options,
            });

            await bundle.write(
                build.filename
                    ? {
                          file: path.resolve(`${dir}/`, build.filename),
                      }
                    : {
                          dir,
                      }
            );
            await bundle.close();
        }
    } catch (err) {
        console.error(err);
    }
}
