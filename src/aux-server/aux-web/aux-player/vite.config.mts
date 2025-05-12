import path from 'path';
import fs from 'fs';
import { defineConfig, splitVendorChunkPlugin, mergeConfig } from 'vite';
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

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { GIT_HASH, GIT_TAG } from '../../../../script/git-stats.mjs';

const ENABLE_DOM_ACCESS = process.env.ENABLE_DOM_ACCESS === 'true';

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
                },
            },
            sourcemap: true,
            target: ['chrome100', 'firefox100', 'safari14', 'ios14', 'edge100'],
        },
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
                  minify: false,
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
                  splitVendorChunkPlugin(),
              ]),
        ...(command === 'build'
            ? [generateDependencyGraphRollupPlugin(distDir), visualizer()]
            : []),
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
        port: 3000,
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
        proxy: {
            '/api': 'http://localhost:2999',
            '/websocket': {
                target: 'http://localhost:2998',
                ws: true,
            },
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
}));
