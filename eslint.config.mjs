import globals from 'globals';
import pluginJs from '@eslint/js';
import tseslint from 'typescript-eslint';
import pluginVue from 'eslint-plugin-vue';

/** @type {import('eslint').Linter.Config[]} */
export default [
    { files: ['**/*.{js,mjs,cjs,ts,vue}'] },
    { languageOptions: { globals: { ...globals.browser, ...globals.node } } },
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
        },
    },
    {
        files: ['src/aux-components/**/*.{js,ts,vue}'],
        rules: {
            'vue/multi-word-component-names': 'off',
        },
    },
];
