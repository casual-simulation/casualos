import esbuild from 'esbuild';
import path from 'path';
import fs from 'fs';
import chalk from 'chalk';
import chokidar from 'chokidar';
import _ from 'lodash';
import root from './root-path.cjs';

const src = path.resolve(root, 'src');
const nodeModules = path.resolve(root, 'node_modules');
const gltfLoaders = loaders(['.gltf', '.glb'], 'file');
const imageLoaders = loaders(['.png', '.jpg', '.gif', '.webp'], 'file');
const fontLoaders = loaders(['.ttf', '.woff', '.woff2', '.otf'], 'file');
const wasmLoaders = loaders(['.wasm'], 'file');

const SIXTY_SECONDS_MS = 60 * 1000;

const loader = {
    ...gltfLoaders,
    ...wasmLoaders,
    ...imageLoaders,
    ...fontLoaders,
    '.pem': 'text',
};

const paths = {
    root,
    nodeModules,
};

export {
    setupWatch,
    build,
    cleanDirectory,
    root,
    getExternals,
    loaders,
    replaceEsbuildPlugin,
    replaceThreePlugin,
    replaceModulePlugin,
    emptyModulePlugin,
    paths,
};

function cleanDirectory(dir) {
    if (fs.existsSync(dir)) {
        fs.rmdirSync(dir, {
            recursive: true,
        });
    }
}

async function build(builds) {
    let builders = await Promise.all(
        builds.map(([name, options]) => {
            return esbuild
                .build({
                    bundle: true,
                    logLevel: 'silent',
                    loader,
                    ...options,
                })
                .then((result) => {
                    return [true, name, result];
                })
                .catch((result) => {
                    return [false, name, result];
                });
        })
    );

    writeMetafiles(builders);
    logBuilders(builders);
}

async function setupWatch(builds) {
    const watcher = chokidar.watch(src, {
        ignored: [
            /node_modules/,
            '**/package.json',
            '**/tsconfig.tsbuildinfo',
            '**/*.js',
            '**/*.js.map',
            '**/*.d.ts',
            '**/*.d.ts.map',
            '**/dist',
        ],
        ignoreInitial: true,
        followSymlinks: false,
    });

    let builders = await Promise.all(
        builds.map(([name, options]) => {
            return esbuild
                .context({
                    bundle: true,
                    logLevel: 'silent',
                    loader,
                    ...options,
                })
                .then((context) => {
                    return [true, name, context, context];
                })
                .catch((result) => {
                    return [false, name, result];
                });
        })
    );

    logBuilders(builders);
    const build = _.debounce(async () => {
        console.log('[dev-server] Rebuilding...');
        builders = await Promise.all(
            builders.map(([success, name, result, context]) => {
                return context
                    .rebuild()
                    .then((result) => {
                        return [true, name, result, context];
                    })
                    .catch((result) => {
                        return [false, name, result];
                    });
            })
        );
        logBuilders(builders);
    }, 1000);

    build();

    watcher.on('all', async (event, path) => {
        if (event === 'unlink') {
            console.log('[dev-server] File was deleted:', path);
            build();
        } else if (event === 'add') {
            console.log('[dev-server] File was added:', path);
            build();
        } else {
            fs.stat(path, (err, stats) => {
                if (err) {
                    return;
                }
                // Only run builds for files that come back
                // as having been modified within the last minute.
                // A lot of times, the watcher will return when a file has been accessed ("touched")
                // when we only care about changes.
                const timeSinceModify = Math.abs(Date.now() - stats.mtimeMs);
                if (timeSinceModify < SIXTY_SECONDS_MS) {
                    console.log('[dev-server] File was changed:', event, path);
                    build();
                }
            });
        }
    });
}

function writeMetafiles(builders) {
    for (let [success, name, result] of builders) {
        if (success && result.metafile) {
            const firstOutput = Object.keys(result.metafile.outputs)[0];

            if (firstOutput) {
                const dir = path.dirname(firstOutput);
                const basename = path.basename(firstOutput);
                const extension = path.extname(basename);
                const filename = extension
                    ? basename.slice(0, basename.length - extension.length)
                    : basename;
                fs.writeFileSync(
                    path.resolve(dir, `${filename}.meta.json`),
                    JSON.stringify(result.metafile, undefined, 2)
                );
            }
        }
    }
}

function logBuilders(builders) {
    for (let [success, name, result] of builders) {
        if (success) {
            logBuildFinish(name, result);
        } else {
            logBuildFailure(name, result);
        }
    }
}

function logBuildFinish(name, result) {
    logResult(name, result);
    console.log(`[dev-server] ${name} Build Complete.`);
}

function logBuildFailure(name, result) {
    logResult(name, result);
    console.log(`[dev-server] ${name} Build Failed.`);
}

function logResult(name, result) {
    logErrors(name, result.errors);
    logWarnings(name, result.warnings);
}

function logErrors(name, errors) {
    if (errors && errors.length > 0) {
        for (let warn of errors) {
            logMessage(name, warn, 'error', 'red');
        }
    }
}

function logWarnings(name, warnings) {
    if (warnings && warnings.length > 0) {
        for (let warn of warnings) {
            logMessage(name, warn, 'warning', 'yellow');
        }
    }
}

function logMessage(name, message, type, color) {
    const lineNumberText = !message.location
        ? ''
        : `${message.location.file} ${message.location.line}`;
    const lineText = !message.location ? '' : message.location.lineText;
    console.log(
        `[dev-server] ${name} ${lineNumberText} | ${chalk[color](type)}: ${
            message.text
        }`
    );

    if (message.location) {
        const highlightedText =
            chalk.hex('eee')(lineText.substr(0, message.location.column)) +
            chalk.green.underline(
                lineText.substr(
                    message.location.column,
                    message.location.length
                )
            ) +
            chalk.hex('eee')(
                lineText.substr(
                    message.location.column + message.location.length
                )
            );

        console.log(
            `[dev-server] ${name} ${lineNumberText} | ${highlightedText}\n`
        );
    }
}

function getExternals(packageJson) {
    const packageData = JSON.parse(fs.readFileSync(packageJson));
    return Object.keys(packageData.dependencies).filter((p) => {
        // Allow all the casual-simulation packages to be bundled.
        return !/^@casual-simulation\/(?!aux-server)/.test(p);
    });
}

function replaceEsbuildPlugin() {
    return replaceModulePlugin(
        /^esbuild$/,
        path.resolve(nodeModules, 'esbuild-wasm', 'lib', 'browser.js')
    );
}

function replaceThreePlugin() {
    return replaceModulePlugin(/^three$/, '@casual-simulation/three');
}

function replaceModulePlugin(original, replacement) {
    return {
        name: 'replace-module',
        setup(build) {
            build.onResolve({ filter: original }, (args) => ({
                path: replacement,
            }));
        },
    };
}

function emptyModulePlugin(moduleId, filter = new RegExp(`^${moduleId}$`)) {
    return {
        name: 'emptyModulePlugin',
        setup: (build) => {
            build.onResolve({ filter: filter }, (args) => ({
                path: args.path,
                namespace: `empty-ns-${moduleId}`,
            }));

            build.onLoad(
                { filter: filter, namespace: `empty-ns-${moduleId}` },
                (args) => ({
                    contents: '',
                    loader: 'js',
                })
            );
        },
    };
}

function loaders(extensions, type) {
    let obj = {};
    for (let ext of extensions) {
        obj[ext] = type;
    }
    return obj;
}
