// noinspection JSUnusedGlobalSymbols

import * as eslint from '@eslint/js';
import * as tseslint from '@typescript-eslint/eslint-plugin';
import * as tsParser from '@typescript-eslint/parser';
import reactPlugin from 'eslint-plugin-react';
import * as prettierPlugin from 'eslint-plugin-prettier';
import * as importPlugin from 'eslint-plugin-import';

const config = [
  eslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
      react: reactPlugin,
      prettier: prettierPlugin,
      import: importPlugin,
    },
    rules: {
      'react/react-in-jsx-scope': 'off',
      'prettier/prettier': 'error',
      'import/no-default-export': 'error',
      'import/prefer-default-export': 'off',
      ...tseslint.configs.recommended.rules,
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
    env: {
      browser: true,
      es2021: true,
      node: true,
      jest: true,
    },
  },
] as const;

// eslint-disable-next-line import/no-default-export
export default config;
