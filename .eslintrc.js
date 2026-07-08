module.exports = {
  root: true,
  extends: '@ionic/eslint-config/recommended',
  env: {
    node: true,
  },
  rules: {
    // Honor the project convention: an underscore prefix marks an
    // intentionally-unused binding (e.g. required override signatures).
    '@typescript-eslint/no-unused-vars': [
      'warn',
      {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
      },
    ],
  },
  overrides: [
    {
      files: ['**/*.config.js', '.eslintrc.js', 'scripts/**/*.js'],
      env: {
        node: true,
      },
      rules: {
        '@typescript-eslint/no-var-requires': 'off',
      },
    },
    {
      files: ['jest/**/*', '**/*.test.js', '**/*.test.ts', '**/*.spec.js', '**/*.spec.ts'],
      env: {
        jest: true,
        node: true,
      },
      rules: {
        '@typescript-eslint/no-var-requires': 'off',
        // Tests use fixtures with known-present optional fields; non-null
        // assertions are acceptable here (mirrors the src/shared override).
        '@typescript-eslint/no-non-null-assertion': 'off',
      },
    },
    {
      files: ['src/shared/**/*'],
      rules: {
        'import/order': 'off',
        'import/first': 'off',
        'import/newline-after-import': 'off',
        '@typescript-eslint/consistent-type-imports': 'off',
        '@typescript-eslint/prefer-as-const': 'off',
        '@typescript-eslint/prefer-for-of': 'off',
        '@typescript-eslint/no-non-null-assertion': 'off',
        '@typescript-eslint/explicit-module-boundary-types': 'off',
        '@typescript-eslint/ban-ts-comment': 'off',
        '@typescript-eslint/ban-types': 'off',
        '@typescript-eslint/no-empty-interface': 'off',
        '@typescript-eslint/no-unused-vars': 'off',
        'no-prototype-builtins': 'off',
        'no-undef': 'off',
      },
    },
  ],
};
