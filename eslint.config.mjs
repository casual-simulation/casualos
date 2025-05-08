import globals from 'globals';
import pluginJs from '@eslint/js';
import tseslint from 'typescript-eslint';
import pluginVue from 'eslint-plugin-vue';
import header from 'eslint-plugin-header';
import noNonTypeImports from './rules/no-non-type-imports.mjs';

import { defineConfig, globalIgnores } from 'eslint/config';

export default defineConfig([
    globalIgnores([
        '**/node_modules/**',
        '**/dist/**',
        '**/prisma/generated/**',
        '**/typings/**',
        'src/expect/**',
        'src/stacktrace/**',
        'src/multi-streams-mixer/**',
        'src/chalk/**',
    ]),
    { files: ['**/*.{js,mjs,cjs,ts,vue}'] },
    {
        languageOptions: {
            globals: {
                ...globals.browser,
                ...globals.node,
                MdTheme: 'readonly',
            },
        },
    },
    pluginJs.configs.recommended,
    ...tseslint.configs.recommended,
    {
        plugins: {
            casualos: noNonTypeImports,
        },
    },
    {
        rules: {
            '@typescript-eslint/consistent-type-imports': [
                'error',
                {
                    fixStyle: 'separate-type-imports',
                    prefer: 'type-imports',
                },
            ],
        },
    },
    {
        files: ['src/**/*.{js,ts,vue}'],
        ignores: [
            'src/aux-records-aws/**/*.{js,ts,vue}',
            'src/aux-records/**/*.{js,ts,vue}',
            'src/aux-server/aux-backend/**/*.{js,ts,vue}',
            '**/*.spec.{js,ts,vue}',
        ],
        rules: {
            'casualos/no-non-type-imports': [
                'error',
                {
                    patterns: {
                        '@casual-simulation/aux-records': {},
                    },
                },
            ],
        },
    },
    ...pluginVue.configs['flat/essential'],
    {
        files: ['**/*.vue'],
        languageOptions: { parserOptions: { parser: tseslint.parser } },
    },
    {
        files: ['**/*.spec.ts'],
        rules: {
            '@typescript-eslint/no-require-imports': 'off',
        },
    },

    // Disabled rules
    {
        // TODO: Go through and fix all errors
        rules: {
            'prefer-const': 'off',
            '@typescript-eslint/no-explicit-any': 'off',
            '@typescript-eslint/no-unused-vars': 'off',
            '@typescript-eslint/no-empty-object-type': [
                'error',
                { allowInterfaces: 'always' },
            ],
            'no-extra-boolean-cast': 'off',
            '@typescript-eslint/no-this-alias': 'off',
            'vue/no-deprecated-v-bind-sync': 'off',
        },
    },
    {
        files: [
            'src/aux-components/**/*.{js,ts,vue}',
            'src/aux-server/aux-web/shared/vue-components/**/*.{js,ts,vue}',
            'src/aux-server/aux-web/shared/public/**/*.{js,ts,vue}',
        ],
        rules: {
            'vue/multi-word-component-names': 'off',
            'vue/no-deprecated-v-on-native-modifier': 'off',
        },
    },
    {
        files: [
            'script/**/*.{js,mjs,ts}',
            'playwright/**/*.{js,mjs,ts}',
            '__mocks__/**/*.{js,mjs,ts}',
            'playwright/**/*.{js,mjs,ts}',
            'src/aux-common/**/*.{js,mjs,ts}',
            'src/aux-components/**/*.{js,mjs,ts}',
            'src/aux-proxy/**/*.{js,mjs,ts}',
            'src/aux-records/**/*.{js,mjs,ts}',
            'src/aux-records-aws/**/*.{js,mjs,ts}',
            'src/aux-redirector/**/*.{js,mjs,ts}',
            'src/aux-runtime/**/*.{js,mjs,ts}',
            'src/aux-server/**/*.{js,mjs,ts}',
            'src/aux-vm/**/*.{js,mjs,ts}',
            'src/aux-vm-browser/**/*.{js,mjs,ts}',
            'src/aux-vm-client/**/*.{js,mjs,ts}',
            'src/aux-vm-deno/**/*.{js,mjs,ts}',
            'src/aux-vm-node/**/*.{js,mjs,ts}',
            'src/aux-websocket/**/*.{js,mjs,ts}',
            'src/aux-websocket-aws/**/*.{js,mjs,ts}',
            'src/casualos-cli/**/*.{js,mjs,ts}',
            'src/casualos-infra/**/*.{js,mjs,ts}',
            'src/crypto/**/*.{js,mjs,ts}',
            'src/crypto-browser/**/*.{js,mjs,ts}',
            'src/crypto-node/**/*.{js,mjs,ts}',
            'src/make-github-release/**/*.{js,mjs,ts}',
            'src/tunnel/**/*.{js,mjs,ts}',
            'src/websocket/**/*.{js,mjs,ts}',
            'src/js-interpreter/**/*.{js,mjs,ts}',
        ],
        ignores: [
            'src/aux-server/aux-web/shared/public/**/*.{js,ts}',
            'src/aux-server/aux-web/shared/monaco/**/*.{js,ts}',
            'src/aux-server/aux-web/shared/static/**/*.{js,ts}',
            'src/aux-server/aux-player/static/**/*.{js,ts}',
            'src/aux-server/aux-player/shim/**/*.{js,ts}',
            'src/aux-vm/globalThis-polyfill.ts',
            'src/tunnel/bin/tunnel.ts',
        ],
        plugins: {
            header: header,
        },
        rules: {
            'header/header': ['error', 'script/header.js'],
        },
    },
]);
