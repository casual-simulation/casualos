const esbuild = require('esbuild');
const path = require('path');
const fs = require('fs');
const chalk = require('chalk');

const root = path.resolve(__dirname, '..');
const nodeModules = path.resolve(root, 'node_modules');
const gltfLoaders = loaders(['.gltf', '.glb'], 'file');
const imageLoaders = loaders(['.png', '.jpg', '.gif', '.webp'], 'file');
const fontLoaders = loaders(['.ttf', '.woff', '.woff2', '.otf'], 'file');
const wasmLoaders = loaders(['.wasm'], 'file');

const loader = {
    ...gltfLoaders,
    ...wasmLoaders,
    ...imageLoaders,
    ...fontLoaders,
    '.pem': 'text',
};

module.exports = {
    watch,
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

function watch(name, options) {
    return esbuild
        .build({
            bundle: true,
            watch: {
                onRebuild(error, result) {
                    if (error) {
                        logBuildFailure(name, error);
                    } else {
                        logBuildFinish(name, result);
                    }
                },
            },
            logLevel: 'silent',
            loader,
            ...options,
        })
        .then((result) => {
            logBuildFinish(name, result);
        })
        .catch((result) => {
            logBuildFailure(name, result);
        });
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
