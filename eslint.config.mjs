import globals from 'globals';
import pluginJs from '@eslint/js';
import tseslint from 'typescript-eslint';
import pluginVue from 'eslint-plugin-vue';
import { defineConfig, globalIgnores } from 'eslint/config';

// export default defineConfig([

// ]);

/** @type {import('eslint').Linter.Config[]} */
export default [
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
            // "@typescript-eslint/consistent-type-exports": "error",
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
    // {
    //     files: ['src/aux-server/aux-web/**/*.{js,mjs,cjs,ts,vue}'],
    //     rules: {
    //         'no-restricted-imports': [
    //             'error',
    //             {
    //                 patterns: [
    //                     {
    //                         group: ['@casual-simulation/aux-records'],
    //                         importNamePattern: 'Controller$',
    //                         message: 'Controller imports are not allowed in aux-web',
    //                     },
    //                     {
    //                         group: ['@casual-simulation/aux-records'],
    //                         importNamePattern: 'Store$',
    //                         message: 'Store imports are not allowed in aux-web',
    //                     }
    //                 ]
    //             }
    //         ]
    //     }
    // },

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
];
