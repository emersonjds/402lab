import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import typescript from 'typescript-eslint';

// eslint-disable-next-line no-restricted-syntax -- eslint reads this config as a default export
export default defineConfig(
  { ignores: ['**/dist', '**/coverage', '**/node_modules'] },
  js.configs.recommended,
  typescript.configs.strictTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: { allowDefaultProject: ['*.js'], defaultProject: 'tsconfig.base.json' },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unsafe-assignment': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
      'no-restricted-syntax': [
        'error',
        { selector: 'ExportDefaultDeclaration', message: 'Use a named export.' },
      ],
    },
  },
  {
    files: ['**/tests/**/*.ts'],
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'off',
      // A route or handler declared async for Fastify's sake does not need to await.
      '@typescript-eslint/require-await': 'off',
    },
  },
);
