const esbuild = require('esbuild');
const builds = require('./common');
const fs = require('fs');
const path = require('path');

for (let b of builds) {
    start(b);
}

async function start(build) {
    try {
        if (build.type === 'esbuild') {
            await esbuild.build({
                ...build.options,
                watch: true,
            });
        } else {
            const dir = path.resolve(__dirname, `../dist/rollup/${build.id}`);
            // Only do rollup builds during watch when the output directory does not exist.
            if (!fs.existsSync(dir)) {
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
        }
    } catch (err) {
        console.error(err);
    }
}
