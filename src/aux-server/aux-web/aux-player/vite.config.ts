import path from 'path';
import fs from 'fs';
import { defineConfig } from 'vite';
import { createVuePlugin } from 'vite-plugin-vue2';
import copy from 'rollup-plugin-copy';
import viteSvgIcons from 'vite-plugin-svg-icons';
// @ts-ignore
import { GIT_HASH, GIT_TAG } from '../../../../script/git-stats';

const distDir = path.resolve(__dirname, '..', 'dist');
const webxrProfilesDir = path.posix.resolve(
    __dirname,
    '..',
    '..',
    '..',
    '..',
    'node_modules/@webxr-input-profiles/assets/dist/profiles'
);

const publicDir = path.resolve(__dirname, '..', 'shared', 'static');

const casualOsPackages = fs
    .readdirSync(
        // src folder
        path.resolve(__dirname, '..', '..', '..')
    )
    .map((folder) => `@casual-simulation/${folder}`);

export default defineConfig(({ command, mode }) => ({
    build: {
        outDir: distDir,
        emptyOutDir: false,
        rollupOptions: {
            input: {
                main: path.resolve(__dirname, 'index.html'),
                player: path.resolve(__dirname, 'player.html'),
                vm: path.resolve(__dirname, 'aux-vm-iframe.html'),
            },
        },
    },
    plugins: [
        createVuePlugin(),
        viteSvgIcons({
            iconDirs: [
                path.resolve(
                    __dirname,
                    '..',
                    '..',
                    '..',
                    'aux-components',
                    'icons'
                ),
                path.resolve(__dirname, '..', 'shared', 'public', 'icons'),
            ],
            symbolId: 'icon-[name]',
            svgoOptions: false,
        }),
        {
            ...copy({
                targets: [
                    {
                        src: `${webxrProfilesDir}/**/*`,
                        dest: path.resolve(publicDir, 'webxr-profiles'),
                    },
                ],
                hook: 'buildStart',
                copyOnce: true,
            }),
            enforce: 'pre',
        },
    ],
    assetsInclude: ['**/*.gltf', '**/*.glb'],
    define: {
        GIT_HASH: JSON.stringify(GIT_HASH),
        GIT_TAG: JSON.stringify(
            command === 'serve' ? 'v9.9.9-dev:alpha' : GIT_TAG
        ),
        PRODUCTION: JSON.stringify(command === 'build'),
    },
    publicDir,
    resolve: {
        extensions: ['.vue', '.ts', '.mjs', '.js', '.tsx', '.jsx', '.json'],
        alias: {
            'vue-json-tree-view': path.resolve(
                __dirname,
                '..',
                'shared/public/VueJsonTreeView/index.ts'
            ),
            'three-legacy-gltf-loader': path.resolve(
                __dirname,
                '..',
                'shared/public/three-legacy-gltf-loader/LegacyGLTFLoader.js'
            ),
            'three-vrcontroller-module': path.resolve(
                __dirname,
                '..',
                'shared/public/three-vrcontroller-module/VRController.js'
            ),
            callforth: path.resolve(
                __dirname,
                '..',
                'shared/public/callforth/index.js'
            ),
            'vue-qrcode-reader': path.resolve(
                __dirname,
                '..',
                'shared/public/vue-qrcode-reader/'
            ),
            'clipboard-polyfill': path.resolve(
                __dirname,
                '..',
                'shared/public/clipboard-polyfill/clipboard-polyfill.js'
            ),
            three: '@casual-simulation/three',
            esbuild: 'esbuild-wasm',
        },
    },
    server: {
        watch: {
            ignored: [
                ...casualOsPackages.map((p) => `!**/node_modules/${p}/**`),
            ],
        },
        fs: {
            strict: true,
            allow: [
                path.resolve(__dirname, '..', '..', '..'), // src folder
                path.resolve(
                    __dirname,
                    '..',
                    '..',
                    '..',
                    '..',
                    'node_modules',
                    'monaco-editor'
                ), // node_modules/monaco-editor
            ],
        },
        proxy: {
            '/api': 'http://localhost:2999',
            '/socket.io': {
                target: 'http://localhost:2999',
                ws: true,
            },
        },
    },
    optimizeDeps: {
        exclude: [...casualOsPackages],
    },
}));
