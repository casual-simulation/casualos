import path from 'path';
import fs from 'fs';
import { defineConfig } from 'vite';
import { createVuePlugin } from 'vite-plugin-vue2';
import copy from 'rollup-plugin-copy';
import { createSvgIconsPlugin } from 'vite-plugin-svg-icons';
import { VitePWA } from 'vite-plugin-pwa';
import { generateDependencyGraphRollupPlugin } from '../../../../script/vite-helpers';

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
                playwright: path.resolve(__dirname, 'playwright.html'),
            },
        },
        sourcemap: true,
    },
    plugins: [
        createVuePlugin(),
        createSvgIconsPlugin({
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
                    {
                        src: `aux-web/shared/ab1/**/*`,
                        dest: path.resolve(publicDir, 'ab1'),
                    },
                ],
                hook: 'buildStart',
                copyOnce: true,
            }),
            enforce: 'pre',
        } as any,
        VitePWA({
            strategies: 'injectManifest',
            srcDir: '.',
            filename: 'sw.ts',
            injectManifest: {
                maximumFileSizeToCacheInBytes: 15728640, // 5MiB
                globDirectory: distDir,
                globPatterns: [
                    '**/*.{html,css,js,json,png,glb,ico,ttf,webp}',
                    '**/roboto-v18-latin-*.woff2',
                ],
                globIgnores: [
                    '**/webxr-profiles/**',
                    '**/deno.js',
                    '**/*.map*',
                    '**/NotoSansKR*',
                ],
            },
        }),
        ...(command === 'build'
            ? [generateDependencyGraphRollupPlugin(distDir)]
            : []),
    ],
    assetsInclude: ['**/*.gltf', '**/*.glb'],
    define: {
        GIT_HASH: JSON.stringify(GIT_HASH),
        GIT_TAG: JSON.stringify(
            command === 'serve' ? 'v9.9.9-dev:alpha' : GIT_TAG
        ),
        PROXY_CORS_REQUESTS: process.env.PROXY_CORS_REQUESTS !== 'false',
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
                path.resolve(
                    __dirname,
                    '..',
                    '..',
                    '..',
                    '..',
                    'node_modules',
                    'rxjs'
                ), // node_modules/rxjs
            ],
        },
        proxy: {
            '/api': 'http://localhost:2999',
            '/websocket': {
                target: 'http://localhost:2999',
                ws: true,
            },
        },
    },
    optimizeDeps: {
        exclude: [...casualOsPackages],
    },
}));
