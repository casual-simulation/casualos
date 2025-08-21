/* CasualOS is a set of web-based tools designed to facilitate the creation of real-time, multi-user, context-aware interactive experiences.
 *
 * Copyright (c) 2019-2025 Casual Simulation, Inc.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */
import esbuild from 'esbuild';
import path, { dirname } from 'path';
import fs, { existsSync } from 'fs';
import { writeFile, readFile } from 'fs/promises';
import chalk from 'chalk';
import chokidar from 'chokidar';
import { debounce } from 'es-toolkit';
import root from './root-path.cjs';
import JSZip from 'jszip';
import hash from 'hash.js';
const { sha256 } = hash;

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
    const build = debounce(async () => {
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

/**
 * Downloads a file from the given URL and saves it to the given destination.
 * Optionally unzips the file.
 * @param {*} options The options object.
 * @returns
 */
export function downloadFilePlugin(options) {
    const src = options.src;
    const dest = options.dest;
    const unzip = options.unzip;
    const force = options.force;
    const expectedFiles = options.expectedFiles;
    const cache = options.cache;

    return {
        name: 'downloadFilePlugin',
        setup: (build) => {
            build.onEnd(async () => {
                if (force || unzip || !existsSync(dest)) {
                    if (expectedFiles) {
                        if (
                            expectedFiles.every((file) =>
                                existsSync(path.resolve(dest, file))
                            )
                        ) {
                            console.log(
                                'Files already exist. Skipping download.'
                            );
                            return;
                        }
                    }

                    const srcHash = sha256().update(src).digest('hex');
                    const cachePath = path.resolve(
                        nodeModules,
                        '.build-cache',
                        srcHash
                    );

                    let buffer = null;
                    if (cache) {
                        if (existsSync(cachePath)) {
                            console.log('Using cached file.');
                            buffer = await readFile(cachePath);
                        } else {
                            const cacheDir = dirname(cachePath);
                            if (!existsSync(cacheDir)) {
                                fs.mkdirSync(cacheDir, { recursive: true });
                            }
                        }
                    }

                    if (!buffer) {
                        console.log(`Downloading ${src} to ${dest}...`);
                        const response = await fetch(src);
                        buffer = new Buffer(await response.arrayBuffer());

                        if (cache) {
                            await writeFile(cachePath, buffer);
                        }
                    }

                    const dir = dirname(dest);
                    if (!existsSync(dir)) {
                        fs.mkdirSync(dir, { recursive: true });
                    }

                    if (unzip) {
                        const zip = new JSZip();
                        const zipFile = await zip.loadAsync(buffer);
                        const files = zipFile.files;
                        for (let file in files) {
                            const finalPath = path.resolve(dest, file);

                            if (force || !existsSync(finalPath)) {
                                const content = await files[file].async(
                                    'nodebuffer'
                                );
                                console.log(`Writing ${finalPath}...`);
                                await writeFile(finalPath, content, {
                                    flag: force ? 'w' : 'wx',
                                });
                            }
                        }
                    } else {
                        console.log(`Writing ${dest}...`);
                        await writeFile(dest, Buffer.from(buffer));
                    }
                    console.log('Download complete.');
                }
            });
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
