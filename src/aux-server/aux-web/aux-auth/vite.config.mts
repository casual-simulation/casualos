import path from 'path';
import fs from 'fs';
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue2';
import { createSvgIconsPlugin } from 'vite-plugin-svg-icons';
import md from '../../plugins/markdown-plugin';
import virtual from '@rollup/plugin-virtual';
import {
    getPolicies,
    listEnvironmentFiles,
    loadEnvFiles,
} from '../../script/vite-utils';
import writeFilesPlugin from '../../plugins/write-files-plugin';
import z from 'zod';
import type { RemoteCausalRepoProtocol } from '@casual-simulation/aux-common';
import basicSsl from '@vitejs/plugin-basic-ssl';
import cspPlugin from '../../plugins/csp-plugin';

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { GIT_HASH, GIT_TAG } from '../../../../script/git-stats.mjs';
import simpleAnalyticsPlugin from '../../plugins/simple-analytics-plugin';

const OMIT_SIMPLE_ANALYTICS = process.env.OMIT_SIMPLE_ANALYTICS === 'true';

const distDir = path.resolve(__dirname, 'dist');

const publicDir = path.resolve(__dirname, 'shared', 'static');

const casualOsPackages = fs
    .readdirSync(
        // src folder
        path.resolve(__dirname, '..', '..', '..')
    )
    .map((folder) => `@casual-simulation/${folder}`);

let allowedChildOrigins = `http://localhost:3000 https://casualos.com https://static.casualos.com https://alpha.casualos.com https://stable.casualos.com https://auxplayer.org https://static.auxplayer.org`;

export default defineConfig(({ command, mode }) => {
    if (process.env.ALLOWED_CHILD_ORIGINS) {
        allowedChildOrigins = process.env.ALLOWED_CHILD_ORIGINS;
    }
    const omitBuildCsp: boolean = process.env.OMIT_BUILD_CSP === 'true';
    let apiEndpoint: string | null = null;
    if (process.env.AUTH_API_ENDPOINT) {
        apiEndpoint = process.env.AUTH_API_ENDPOINT;
    }
    let websocketEndpoint: string | null = null;
    if (process.env.AUTH_WEBSOCKET_ENDPOINT) {
        websocketEndpoint = process.env.AUTH_WEBSOCKET_ENDPOINT;
    } else if (mode === 'development') {
        websocketEndpoint = 'http://localhost:3002';
    }
    let websocketProtocol: RemoteCausalRepoProtocol | null = 'websocket';
    if (process.env.AUTH_WEBSOCKET_PROTOCOL) {
        websocketProtocol = z
            .union([z.literal('websocket'), z.literal('apiary-aws')])
            .parse(process.env.AUTH_WEBSOCKET_PROTOCOL);
    }
    let frontendOrigin: string | null = null;
    if (process.env.FRONTEND_ORIGIN) {
        frontendOrigin = process.env.FRONTEND_ORIGIN;
        try {
            new URL(frontendOrigin);
        } catch (err) {
            console.error(
                `Invalid FRONTEND_ORIGIN. It must be a valid URL: ${frontendOrigin}`
            );
            throw err;
        }
    } else if (command === 'serve') {
        frontendOrigin = 'http://localhost:3000';
    }

    const env = process.env.NODE_ENV;
    const DEVELOPMENT = command === 'serve' && env !== 'production';

    const auxServerDir = path.resolve(__dirname, '..', '..');
    const rootDir = path.resolve(auxServerDir, '..', '..');
    const serverDir = path.resolve(auxServerDir, 'aux-backend', 'server');

    const envFiles = [
        ...listEnvironmentFiles(serverDir),
        ...listEnvironmentFiles(auxServerDir),
    ];

    loadEnvFiles(
        envFiles.filter(
            (file) => !file.endsWith('.dev.env.json') || DEVELOPMENT
        )
    );

    if (envFiles.length < 0) {
        console.log('[Env] No environment files found.');
    }

    const config = process.env.SERVER_CONFIG
        ? JSON.parse(process.env.SERVER_CONFIG)
        : null;

    const policies = getPolicies(false);

    return {
        cacheDir: path.resolve(
            __dirname,
            '..',
            '..',
            'node_modules',
            '.vite',
            '.aux-auth'
        ),
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
        esbuild: {
            charset: 'ascii',
        },
        plugins: [
            md(),
            vue(),
            virtual({
                ...policies.virtualModules,
            }),
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
            writeFilesPlugin({
                files: {
                    ...policies.files,
                },
            }),
            cspPlugin({
                filter: (html, ctx) =>
                    !omitBuildCsp && ctx.path.endsWith('iframe.html'),
                csp: {
                    'default-src': "'self'",
                    'child-src': allowedChildOrigins,
                    'script-src': [
                        "'self'",
                        command !== 'build' ? `'unsafe-eval'` : '',
                    ].filter((s) => s.length > 0),
                    'connect-src': ["'self'", apiEndpoint || ''].filter(
                        (s) => s.length > 0
                    ),
                },
            }),
            cspPlugin({
                filter: (html, ctx) =>
                    !omitBuildCsp && ctx.path.endsWith('index.html'),
                csp: {
                    'default-src': "'self' https://js.stripe.com",
                    'img-src': "'self' https://*",
                    'style-src': "'self' 'unsafe-inline'",
                    'child-src': "'self'",
                    'frame-src': 'https://js.stripe.com',
                    'script-src': [
                        "'self'",
                        'https://js.stripe.com',
                        'https://scripts.simpleanalyticscdn.com',
                        "'unsafe-inline'",
                        command !== 'build' ? `'unsafe-eval'` : '',
                    ].filter((s) => s.length > 0),
                    'connect-src': [
                        "'self'",
                        apiEndpoint || '',
                        'https://scripts.simpleanalyticscdn.com',
                        'http://localhost:9000',
                        '*.s3.amazonaws.com',
                    ].filter((s) => s.length > 0),
                },
            }),
            ...(!OMIT_SIMPLE_ANALYTICS ? [simpleAnalyticsPlugin()] : []),
            process.argv.some((a) => a === '--ssl') ? basicSsl() : [],
        ],
        assetsInclude: ['**/*.gltf', '**/*.glb'],
        define: {
            GIT_HASH: JSON.stringify(GIT_HASH),
            GIT_TAG: JSON.stringify(
                command === 'serve' ? 'v9.9.9-dev:alpha' : GIT_TAG
            ),
            PRODUCTION: JSON.stringify(command === 'build'),
            WEBSOCKET_ENDPOINT: JSON.stringify(websocketEndpoint),
            WEBSOCKET_PROTOCOL: JSON.stringify(websocketProtocol),
            API_ENDPOINT: JSON.stringify(apiEndpoint),
            FRONTEND_ORIGIN: JSON.stringify(frontendOrigin),
            ENABLE_SMS_AUTHENTICATION: JSON.stringify(
                process.env.ENABLE_SMS_AUTHENTICATION === 'true' ||
                    (typeof process.env.ENABLE_SMS_AUTHENTICATION ===
                        'undefined' &&
                        command !== 'build')
            ),
            ASSUME_SUBSCRIPTIONS_SUPPORTED: JSON.stringify(
                !!(config && config.subscriptions)
            ),
            ASSUME_STUDIOS_SUPPORTED: JSON.stringify(
                !!(config && !!config.subscriptions)
            ),
            USE_PRIVO_LOGIN: JSON.stringify(!!(config && config.privo)),
            SUPPORT_URL: JSON.stringify(process.env.SUPPORT_URL || null),
        },
        publicDir,
        resolve: {
            extensions: [
                '.vue',
                '.ts',
                '.mjs',
                '.js',
                '.tsx',
                '.jsx',
                '.json',
                '.md',
            ],
            alias: {
                lodash: 'es-toolkit/compat',
            },
        },
        server: {
            host: '::',
            port: 5174,
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
            // proxy: {
            //     '/api': {
            //         target: 'http://localhost:2998',
            //         configure: (proxy) => {
            //             proxy.on(
            //                 'proxyReq',
            //                 function (proxyReq, req, res, options) {
            //                     proxyReq.setHeader(
            //                         'X-Dev-Proxy-Host',
            //                         req.headers.host as any
            //                     );
            //                 }
            //             );
            //         },
            //     },
            //     '/s3': {
            //         target: 'http://localhost:4566',
            //         changeOrigin: true,
            //         rewrite: (path) => path.replace(/^\/s3/, ''),
            //     },
            //     '/websocket': {
            //         target: 'http://localhost:2998',
            //         ws: true,
            //     },
            // },
        },
        optimizeDeps: {
            exclude: [...casualOsPackages],
        },
    };
});
