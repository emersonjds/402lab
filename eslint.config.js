import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import typescript from 'typescript-eslint';

// eslint-disable-next-line no-restricted-syntax -- eslint reads this config as a default export
export default defineConfig(
  { ignores: ['**/dist', '**/coverage', '**/node_modules', '.claude/**'] },
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
);
