// services/auth-service/eslint.config.mjs
// Fase Código: reglas recomendadas de ESLint + TypeScript. Corre en CI y en lint-staged.
import eslint from '@eslint/js';
import prettier from 'eslint-config-prettier';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist/**', 'coverage/**', 'eslint.config.mjs'] },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  // Desactiva las reglas de estilo que ya resuelve Prettier (npm run format).
  prettier,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
);
