import path from 'path';
import fs from 'fs';
import { defineConfig } from 'vite';
import { createVuePlugin } from 'vite-plugin-vue2';
import copy from 'rollup-plugin-copy';
import { createSvgIconsPlugin } from 'vite-plugin-svg-icons';
import { VitePWA } from 'vite-plugin-pwa';
import { injectHtml } from 'vite-plugin-html';

// @ts-ignore
import { GIT_HASH, GIT_TAG } from '../../../../script/git-stats';

const distDir = path.resolve(__dirname, 'dist');

const publicDir = path.resolve(__dirname, 'shared', 'static');

const casualOsPackages = fs
    .readdirSync(
        // src folder
        path.resolve(__dirname, '..', '..')
    )
    .map((folder) => `@casual-simulation/${folder}`);

const allowedChildOrigins = `http://localhost:3000 https://casualos.com https://static.casualos.com https://alpha.casualos.com https://stable.casualos.com https://auxplayer.org https://static.auxplayer.org`;

export default defineConfig(({ command, mode }) => {
    const apiEndpoint =
        process.env.AUTH_API_ENDPOINT ??
        (command === 'build'
            ? 'https://api.casualos.me'
            : 'http://localhost:3002');
    return {
        build: {
            outDir: distDir,
            emptyOutDir: false,
            rollupOptions: {
                input: {
                    web: path.resolve(__dirname, 'index.html'),
                    iframe: path.resolve(__dirname, 'iframe.html'),
                },
            },
            sourcemap: true,
            target: ['chrome100', 'firefox100', 'safari14', 'ios14', 'edge100'],
        },
        plugins: [
            createVuePlugin(),
            createSvgIconsPlugin({
                iconDirs: [
                    path.resolve(
                        __dirname,
                        '..',
                        '..',
                        'aux-components',
                        'icons'
                    ),
                ],
                symbolId: 'icon-[name]',
                svgoOptions: false,
            }),
            injectHtml({
                data: {
                    production: command === 'build',
                    allowedChildOrigins:
                        process.env.ALLOWED_CHILD_ORIGINS ??
                        allowedChildOrigins,
                    allowedFetchOrigins: apiEndpoint,
                },
            }),
        ],
        assetsInclude: ['**/*.gltf', '**/*.glb'],
        define: {
            GIT_HASH: JSON.stringify(GIT_HASH),
            GIT_TAG: JSON.stringify(
                command === 'serve' ? 'v9.9.9-dev:alpha' : GIT_TAG
            ),
            PRODUCTION: JSON.stringify(command === 'build'),
            API_ENDPOINT: JSON.stringify(apiEndpoint),
            MAGIC_API_KEY: JSON.stringify(
                process.env.MAGIC_API_KEY ?? 'pk_live_3CE2D56694071EC1'
            ),
            ENABLE_SMS_AUTHENTICATION: JSON.stringify(
                process.env.ENABLE_SMS_AUTHENTICATION === 'true' ||
                    (typeof process.env.ENABLE_SMS_AUTHENTICATION ===
                        'undefined' &&
                        command !== 'build')
            ),
            ASSUME_SUBSCRIPTIONS_SUPPORTED: JSON.stringify(
                command === 'serve' || !!process.env.SUBSCRIPTION_CONFIG
            ),
        },
        publicDir,
        resolve: {
            extensions: ['.vue', '.ts', '.mjs', '.js', '.tsx', '.jsx', '.json'],
            alias: {},
        },
        server: {
            host: '0.0.0.0',
            port: 3002,
            watch: {
                ignored: [
                    ...casualOsPackages.map((p) => `!**/node_modules/${p}/**`),
                ],
            },
            fs: {
                strict: true,
                allow: [
                    path.resolve(__dirname, '..', '..', '..'), // src folder
                ],
            },
            proxy: {
                '/api': 'http://localhost:2998',
                '/s3': {
                    target: 'http://localhost:4566',
                    changeOrigin: true,
                    rewrite: (path) => path.replace(/^\/s3/, ''),
                },
            },
        },
        optimizeDeps: {
            exclude: [...casualOsPackages],
        },
    };
});
