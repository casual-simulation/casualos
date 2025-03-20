import globals from 'globals';
import pluginJs from '@eslint/js';
import tseslint from 'typescript-eslint';
import pluginVue from 'eslint-plugin-vue';
import header from 'eslint-plugin-header';
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
            'src/aux-common/**/*.{js,ts}',
            'src/aux-components/**/*.{js,ts}',
            'src/aux-proxy/**/*.{js,ts}',
            'src/aux-records/**/*.{js,ts}',
            'src/aux-records-aws/**/*.{js,ts}',
            'src/aux-redirector/**/*.{js,ts}',
            'src/aux-runtime/**/*.{js,ts}',
            'src/aux-server/**/*.{js,ts}',
            'src/aux-vm/**/*.{js,ts}',
            'src/aux-vm-browser/**/*.{js,ts}',
            'src/aux-vm-client/**/*.{js,ts}',
            'src/aux-vm-deno/**/*.{js,ts}',
            'src/aux-vm-node/**/*.{js,ts}',
            'src/aux-websocket/**/*.{js,ts}',
            'src/aux-websocket-aws/**/*.{js,ts}',
            'src/casualos-cli/**/*.{js,ts}',
            'src/casualos-infra/**/*.{js,ts}',
            'src/crypto/**/*.{js,ts}',
            'src/crypto-browser/**/*.{js,ts}',
            'src/crypto-node/**/*.{js,ts}',
            'src/make-github-release/**/*.{js,ts}',
            'src/tunnel/**/*.{js,ts}',
            'src/websocket/**/*.{js,ts}',
        ],
        ignores: [
            'src/aux-server/aux-web/shared/public/**/*.{js,ts}',
            'src/aux-server/aux-web/shared/monaco/**/*.{js,ts}',
            'src/aux-server/aux-web/shared/static/**/*.{js,ts}',
            'src/aux-server/aux-player/static/**/*.{js,ts}',
            'src/aux-server/aux-player/shim/**/*.{js,ts}',
            'src/aux-vm/globalThis-polyfill.ts',
        ],
        plugins: {
            header: header
        },
        rules: {
            'header/header': ['error', 'script/header.js']
        }
    }
]);
