const esbuild = require('esbuild');
const path = require('path');
const fs = require('fs');
const chalk = require('chalk');
const chokidar = require('chokidar');
const _ = require('lodash');

const root = path.resolve(__dirname, '..');
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

module.exports = {
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
    paths: {
        root,
        nodeModules,
    },
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
                    metafile: true,
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
                .build({
                    bundle: true,
                    metafile: true,
                    logLevel: 'silent',
                    incremental: true,
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

    logBuilders(builders);
    const build = _.debounce(async () => {
        console.log('[dev-server] Rebuilding...');
        builders = await Promise.all(
            builders.map(([success, name, result]) => {
                return result
                    .rebuild()
                    .then((result) => {
                        return [true, name, result];
                    })
                    .catch((result) => {
                        return [false, name, result];
                    });
            })
        );
        logBuilders(builders);
    }, 1000);

    watcher.on('all', async (event, path) => {
        if (event === 'unlink') {
            console.log('[dev-server] File deleted:', path);
            build();
        } else if (event === 'add') {
            console.log('[dev-server] File added:', path);
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
                    console.log('[dev-server] File changed:', event, path);
                    build();
                }
            });
        }
    });
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
    const lineNumberText = `${message.location.file} ${message.location.line}`;
    const lineText = message.location.lineText;
    console.log(
        `[dev-server] ${name} ${lineNumberText} | ${chalk[color](type)}: ${
            message.text
        }`
    );

    const highlightedText =
        chalk.hex('eee')(lineText.substr(0, message.location.column)) +
        chalk.green.underline(
            lineText.substr(message.location.column, message.location.length)
        ) +
        chalk.hex('eee')(
            lineText.substr(message.location.column + message.location.length)
        );

    console.log(
        `[dev-server] ${name} ${lineNumberText} | ${highlightedText}\n`
    );
}

function getExternals(packageJson) {
    const package = JSON.parse(fs.readFileSync(packageJson));
    return Object.keys(package.dependencies).filter((p) => {
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
