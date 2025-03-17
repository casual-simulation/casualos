import globals from 'globals';
import pluginJs from '@eslint/js';
import tseslint from 'typescript-eslint';
import pluginVue from 'eslint-plugin-vue';
import { defineConfig, globalIgnores } from 'eslint/config';

export default defineConfig([
    globalIgnores([
        '**/node_modules/**',
        '**/dist/**',
        '**/prisma/generated/**',
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
]);
