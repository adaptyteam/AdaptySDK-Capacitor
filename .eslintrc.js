module.exports = {
  extends: '@ionic/eslint-config/recommended',
  overrides: [
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