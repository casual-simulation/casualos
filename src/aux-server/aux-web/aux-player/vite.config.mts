import path from 'path';
import fs from 'fs';
import type { BuildOptions } from 'vite';
import { defineConfig, mergeConfig } from 'vite';
import vue from '@vitejs/plugin-vue2';
import copy from 'rollup-plugin-copy';
import { createSvgIconsPlugin } from 'vite-plugin-svg-icons';
import { VitePWA } from 'vite-plugin-pwa';
import virtual from '@rollup/plugin-virtual';
import { generateDependencyGraphRollupPlugin } from '../../script/vite-helpers';
import { getPolicies } from '../../script/vite-utils';
import writeFilesPlugin from '../../plugins/write-files-plugin';
import md from '../../plugins/markdown-plugin';
import { visualizer } from 'rollup-plugin-visualizer';
import basicSsl from '@vitejs/plugin-basic-ssl';
import { viteSingleFile } from 'vite-plugin-singlefile';
import commonjs from 'vite-plugin-commonjs';
import { importMapPlugin } from 'importmap-vite-plugin';

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { GIT_HASH, GIT_TAG } from '../../../../script/git-stats.mjs';
import simpleAnalyticsPlugin from '../../plugins/simple-analytics-plugin';

const ENABLE_DOM_ACCESS = process.env.ENABLE_DOM_ACCESS === 'true';
const OMIT_SIMPLE_ANALYTICS = process.env.OMIT_SIMPLE_ANALYTICS === 'true';

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

const policies = getPolicies(true);

const importableLibraries = {
    yjs: './aux-web/shared/public/import-map/yjs',
    luxon: './aux-web/shared/public/import-map/luxon',
    'preact/compat': './aux-web/shared/public/import-map/preact.compat',
    'preact/jsx-runtime':
        './aux-web/shared/public/import-map/preact.jsx-runtime',
    preact: './aux-web/shared/public/import-map/preact',
    three: './aux-web/shared/public/import-map/three',
    'rxjs/operators': './aux-web/shared/public/import-map/rxjs-operators',
    rxjs: './aux-web/shared/public/import-map/rxjs',
    'es-toolkit': './aux-web/shared/public/import-map/es-toolkit',
    zod: './aux-web/shared/public/import-map/zod',
    uuid: './aux-web/shared/public/import-map/uuid',
};

// The chunks that we want to create.
const nodeModuleChunks: { [key: string]: string[] } = {
    // Libraries that should be in the default chunk (not split out).
    default: ['@loomhq/record-sdk/dist/esm/is-supported'],

    // Libraries to split into their own chunks.
    // This is usually done to ensure that large libraries are loaded lazily when they are needed.
    loom: ['@loomhq/record-sdk'],
    tfjs: ['@teachablemachine/image', '@tensorflow/tfjs', 'long/'],
    monaco: ['@casual-simulation/monaco-editor'],
    livekit: ['livekit-client'],
    barcode: ['jsbarcode', '@ericblade/quagga2'],
    qrcode: ['qrcode', '@chenfengyuan/vue-qrcode'],
    'geo-three': ['geo-three'],
    three: ['@casual-simulation/three', 'troika', 'webgl-sdf-generator'],
    yjs: ['yjs', 'lib0'],
    preact: ['preact'],
    rxjs: ['rxjs', 'rxjs/dist/esm/internal/operators'],
    'vue-filepond': ['vue-filepond', 'filepond'],

    'vendor-vm': [
        'acorn',
        'estraverse',
        'astring',
        'scrypt-js',
        'hash.js',
        'tweetnacl',
    ],
};

for (let lib of Object.keys(importableLibraries)) {
    const libName = lib.replace('/', '-');
    if (!nodeModuleChunks[libName]) {
        nodeModuleChunks[libName] = [lib];
    } else {
        nodeModuleChunks[libName].push(lib);
    }
}

const chunks: { [key: string]: { [key: string]: string[] } } = {
    'aux-player': {
        barcode: ['VueBarcode', 'BarcodeScanner'],
        monaco: [
            'MonacoHelpers',
            'MonacoLibs',
            'public/monaco-editor',
            'MonacoTagDiffEditor',
            'MonacoDiffEditor',
            'MonacoTagEditor',
            'CodeToolsPortal',
            'MonacoEditor',
        ],
        qrcode: [
            'QrcodeStream',
            'public/vue-qrcode-reader',
            'public/callforth',
        ],
        'vendor-player': ['vue-shortkey', 'multi-streams-mixer'],
    },
    shared: {
        'vendor-shared': ['NodeCryptoReplacement'],
        'geo-three': ['MapUtils', 'scene/map/CustomMapProvider'],
        three: ['three-legacy-gltf-loader', 'ldraw-loader'],
    },
    'aux-runtime': {
        monaco: ['AuxLibraryDefinitions'],
        runtime: ['aux-runtime', 'ProxyClientPartition'],
        default: ['LocalStoragePartition'],
    },
    'aux-common': {
        runtime: ['aux-common/partitions', 'aux-common/bots/StoredAux'],
        common: ['aux-common'],
    },
    'aux-vm': {
        runtime: [
            'aux-vm/vm',
            'HtmlAppBackend',
            'CustomAppHelper',
            'aux-vm-client/vm',
        ],
    },
    undom: {
        runtime: ['undom'],
    },
    crypto: {
        runtime: ['crypto'],
    },
    'js-interpreter': {
        common: ['InterpreterUtils'],
        runtime: ['js-interpreter'],
    },
    timesync: {
        runtime: ['timesync'],
    },
    'fast-json-stable-stringify': {
        common: ['fast-json-stable-stringify'],
    },
    websocket: {
        common: ['websocket'],
    },
    chalk: {
        'vendor-vm': ['chalk'],
    },
    expect: {
        'vendor-vm': ['expect'],
    },
};

let workerCounter = 0;

function findChunk(id: string, chunks: { [key: string]: string[] }) {
    for (let [key, libs] of Object.entries(chunks)) {
        for (let lib of libs) {
            if (id.includes(lib)) {
                // console.log('Chunking', id, '-->', key);
                if (key === 'default') {
                    return null;
                }
                return key;
            }
        }
    }

    return undefined;
}

export default defineConfig(({ command, mode }) => ({
    logLevel: 'info',
    cacheDir: path.resolve(
        __dirname,
        '..',
        '..',
        'node_modules',
        '.vite',
        mode === 'static' ? '.aux-player-static' : '.aux-player'
    ),
    build: mergeConfig(
        {
            outDir: distDir,
            emptyOutDir: false,
            rollupOptions: {
                input: {
                    main: path.resolve(__dirname, 'index.html'),
                    player: path.resolve(__dirname, 'player.html'),
                    vm: path.resolve(__dirname, 'aux-vm-iframe.html'),
                    vmDom: path.resolve(__dirname, 'aux-vm-iframe-dom.html'),
                    playwright: path.resolve(__dirname, 'playwright.html'),
                    'loading-oauth': path.resolve(
                        __dirname,
                        'loading-oauth.html'
                    ),
                    'cleanup-indexeddb': path.resolve(
                        __dirname,
                        'cleanup-indexeddb.html'
                    ),
                },
                output: {
                    manualChunks: function (id) {
                        if (
                            id.includes('\0commonjsHelpers.js') ||
                            id.includes('\0commonjs-dynamic-modules')
                        ) {
                            return 'commonjs';
                        }

                        if (id.includes('node_modules')) {
                            const c = findChunk(id, nodeModuleChunks);
                            if (typeof c !== 'undefined') {
                                return c;
                            }
                            return 'vendor-shared';
                        } else {
                            for (let chunk in chunks) {
                                if (id.includes(chunk)) {
                                    const c = findChunk(id, chunks[chunk]);
                                    if (typeof c !== 'undefined') {
                                        return c;
                                    }
                                }
                            }
                        }

                        return null;
                    },
                    onlyExplicitManualChunks: true,
                },
            },
            sourcemap: true,
            target: ['chrome100', 'firefox100', 'safari14', 'ios14', 'edge100'],
            modulePreload: {
                resolveDependencies() {
                    return [];
                },
            },
        } satisfies BuildOptions,
        mode === 'static'
            ? {
                  rollupOptions: {
                      input: path.resolve(__dirname, 'static.html'),
                      output: {
                          inlineDynamicImports: false,
                      },
                  },
                  assetsInlineLimit: (filePath: string, content: Buffer) => {
                      if (
                          filePath.endsWith('.glb') ||
                          filePath.endsWith('.gltf')
                      ) {
                          console.log('\nInlining:', filePath);
                          return true;
                      }
                      return false;
                  },
                  chunkSizeWarningLimit: 10000000,
                  cssCodeSplit: false,
                  base: './',
                  assetsDir: '',
                  minify: true,
              }
            : {}
    ),
    esbuild: {
        charset: 'ascii',
    },
    plugins: [
        commonjs(),
        md(),
        vue(),
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
        importMapPlugin({
            imports: mode === 'static' ? {} : importableLibraries,
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
        ...(mode === 'static'
            ? [
                  viteSingleFile({
                      useRecommendedBuildConfig: false,
                      inlinePattern: [
                          'static-*.js',
                          'style-*.css',
                          'ResizeObserver-*.css',
                      ],
                  }),
              ]
            : [
                  virtual({
                      ...policies.virtualModules,
                  }),
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
                              '**/*.md',
                              '**/MonacoHelpers*.js',
                              '**/MonacoHelpers*.css',
                              '**/MonacoTag*.js',
                              '**/MonacoTag*.css',
                              '**/MonacoTag*.css',
                              '**/*.worker*.js',
                              '**/vm*.js',
                              '**/jsqr*.js',
                              '**/livekit-client*.js',
                              '**/tfjs*.js',
                              '**/loom*.js',
                              '**/ClassifierStream*.js',
                              '**/cssMode*.js',
                              '**/htmlMode*.js',
                              '**/jsonMode*.js',
                              '**/tsMode*.js',
                              '**/interpreter.js',
                              '**/typesense.js',
                              '**/dependency-graph.json',
                          ],
                      },
                      devOptions: {
                          enabled: true,
                          type: 'module',
                      },
                  }),
                  writeFilesPlugin({
                      files: {
                          ...policies.files,
                      },
                  }),
                  //   splitVendorChunkPlugin(),
              ]),
        ...(command === 'build'
            ? [generateDependencyGraphRollupPlugin(distDir), visualizer()]
            : []),
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
            ...(command === 'build'
                ? {
                      // Replace the AuxRuntimeDynamicImports.ts file with aux-runtime-dynamic-imports.ts
                      // on full builds. If we don't replace this module, then the full interpreter API
                      // will be included in the vm.js build, which will make it several MB larger than it needs to be.
                      // This optimization is only really applicable for devices that don't support service workers
                      // or on first load.
                      './AuxRuntimeDynamicImports': path.resolve(
                          __dirname,
                          'shim',
                          'aux-runtime-dynamic-imports.ts'
                      ),
                  }
                : {}),
            three: '@casual-simulation/three',
            esbuild: 'esbuild-wasm',
            'monaco-editor': '@casual-simulation/monaco-editor',
            lodash: 'es-toolkit/compat',
            crypto: path.resolve(
                __dirname,
                '..',
                'shared',
                'NodeCryptoReplacement.ts'
            ),

            ...(mode === 'static'
                ? {
                      'virtual:pwa-register': path.resolve(
                          __dirname,
                          'static/pwa-register.ts'
                      ),
                      '@casual-simulation/aux-vm-browser/vm/AuxVMImpl':
                          '@casual-simulation/aux-vm-browser/vm/StaticAuxVMImpl.ts',
                      // 'MonacoHelpers': path.resolve(
                      //     __dirname,
                      //     '..',
                      //     'shared',
                      //     'StaticMonacoHelpers.ts'
                      // ),
                      // 'MonacoLibs': path.resolve(
                      //     __dirname,
                      //     '..',
                      //     'shared',
                      //     'StaticMonacoHelpers.ts'
                      // ),
                      // '@casual-simulation/monaco-editor/esm/vs/language/typescript/ts.worker': path.resolve(
                      //     __dirname,
                      //     '..',
                      //     'shared',
                      //     'EmptyModule.ts'
                      // ),
                      // '@casual-simulation/monaco-editor': path.resolve(
                      //     __dirname,
                      //     '..',
                      //     'shared',
                      //     'EmptyModule.ts'
                      // ),
                      '@teachablemachine/image': path.resolve(
                          __dirname,
                          '..',
                          'shared',
                          'EmptyModule.ts'
                      ),
                      jsbarcode: path.resolve(
                          __dirname,
                          '..',
                          'shared',
                          'EmptyModule.ts'
                      ),
                      'livekit-client': path.resolve(
                          __dirname,
                          '..',
                          'shared',
                          'EmptyModule.ts'
                      ),
                      '@casual-simulation/aux-components/fonts/MaterialIcons/MaterialIcons.css':
                          path.resolve(
                              __dirname,
                              '..',
                              'shared',
                              'EmptyModule.ts'
                          ),
                      '@casual-simulation/aux-components/fonts/Roboto/Roboto.css':
                          path.resolve(
                              __dirname,
                              '..',
                              'shared',
                              'EmptyModule.ts'
                          ),
                      '@casual-simulation/aux-records/index.ts': path.resolve(
                          __dirname,
                          '..',
                          'shared',
                          'EmptyModule.ts'
                      ),

                      openai: path.resolve(
                          __dirname,
                          '..',
                          'shared',
                          'EmptyModule.ts'
                      ),
                      '@anthropic-ai/sdk': path.resolve(
                          __dirname,
                          '..',
                          'shared',
                          'EmptyModule.ts'
                      ),
                      '@google+generative-ai': path.resolve(
                          __dirname,
                          '..',
                          'shared',
                          'EmptyModule.ts'
                      ),
                  }
                : {}),
        },
    },
    server: {
        port: 5173,
        host: '::',
        watch: {
            ignored: [
                ...casualOsPackages.map((p) => `!**/node_modules/${p}/**`),
            ],
        },
        fs: {
            strict: true,
            allow: [
                path.resolve(__dirname, '..', '..', '..'), // src folder
                path.resolve(__dirname, '..', '..', '..', '..', 'node_modules'), // node_modules
            ],
        },
    },
    optimizeDeps: {
        exclude: [...casualOsPackages, 'monaco-editor'],
    },
    css: {
        preprocessorOptions: {
            scss: {
                quietDeps: true,
            },
        },
    },
    worker: {
        rollupOptions: {
            output: {
                manualChunks: undefined,
            },
        },
        plugins: () => [
            visualizer({
                filename: path.resolve(`worker-stats-${workerCounter++}.html`),
            }),
        ],
    },
}));
