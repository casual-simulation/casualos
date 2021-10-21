const esbuild = require('esbuild');
const path = require('path');
const fs = require('fs');

const root = path.resolve(__dirname, '..');
const src = path.resolve(root, 'src');
const auxServer = path.resolve(src, 'aux-server');
const server = path.resolve(auxServer, 'server');
const serverPackageJson = path.resolve(auxServer, 'package.json');
const serverExternals = [...getExternals(serverPackageJson), 'esbuild'];

const auxWeb = path.resolve(auxServer, 'aux-web');
const auxWebDist = path.resolve(auxWeb, 'dist');

const auxVmDeno = path.resolve(src, 'aux-vm-deno');
const denoEntry = path.resolve(auxVmDeno, 'vm', 'DenoAuxChannel.worker.js');

const gltfLoaders = loaders(['.gltf', '.glb'], 'file');

const imageLoaders = loaders(['.png', '.jpg', '.gif', '.webp'], 'file');

const fontLoaders = loaders(['.ttf', '.woff', '.woff2', '.otf'], 'file');

const wasmLoaders = loaders(['.wasm'], 'file');

const loader = {
    ...gltfLoaders,
    ...wasmLoaders,
    ...imageLoaders,
    ...fontLoaders,
    '.pem': 'file',
};

// watchServer();
watchDeno();

function watchServer() {
    esbuild
        .build({
            entryPoints: [path.resolve(server, 'index.ts')],
            // outdir: path.resolve(server, 'dist'),
            outfile: path.resolve(server, 'dist', 'main.js'),
            bundle: true,
            watch: true,
            platform: 'node',
            target: ['node12.16'],
            external: serverExternals,
            loader,
            plugins: [replaceThreePlugin()],
        })
        .then((result) => {
            // TODO: log result warnings
            console.log('[dev-server] Server Build Complete.');
        });
}

function watchDeno() {
    esbuild
        .build({
            entryPoints: [denoEntry],
            outfile: path.resolve(auxWebDist, 'deno.js'),
            bundle: true,
            watch: true,
            platform: 'browser',
            loader,
            plugins: [replaceThreePlugin(), emptyModulePlugin('esbuild')],
        })
        .then((result) => {
            // TODO: log result warnings
            console.log('[dev-server] Deno Build Complete.');
        });
}

function getExternals(packageJson) {
    const package = JSON.parse(fs.readFileSync(packageJson));
    return Object.keys(package.dependencies).filter((p) => {
        // Allow all the casual-simulation packages to be bundled.
        return !/^@casual-simulation\/(?!aux-server)/.test(p);
    });
}

function replaceThreePlugin() {
    return replaceModulePlugin(/^three$/, '@casual-simulation/three');
}

function replaceModulePlugin(filter, path) {
    return {
        name: 'replace-module',
        setup(build) {
            build.onResolve({ filter }, (args) => ({
                path,
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
