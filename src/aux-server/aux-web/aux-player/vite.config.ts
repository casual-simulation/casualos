import path from 'path';
import fs from 'fs';
import { defineConfig } from 'vite';
import { createVuePlugin } from 'vite-plugin-vue2';
// @ts-ignore
import { GIT_HASH, GIT_TAG } from '../../../../script/git-stats';

const casualOsPackages = fs
    .readdirSync(
        // src folder
        path.resolve(__dirname, '..', '..', '..')
    )
    .map((folder) => `@casual-simulation/${folder}`);

export default defineConfig({
    plugins: [createVuePlugin()],
    assetsInclude: ['**/*.gltf', '**/*.glb'],
    define: {
        GIT_HASH: JSON.stringify(GIT_HASH),
        GIT_TAG: JSON.stringify(GIT_TAG),
        PRODUCTION: JSON.stringify(false),
    },
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
});
