module.exports = {
  env: {
    es2021: true,
    node: true,
  },
  extends: [
    'airbnb-base',
  ],
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
  },
  rules: {
    'linebreak-style': 0,
    'no-console': 'off',
    'no-underscore-dangle': 'off',
    'comma-dangle': ['error', 'always-multiline'],
    'class-methods-use-this': 'off',
    'no-param-reassign': 'off',
    'no-useless-catch': 'off',
    'import/no-extraneous-dependencies': ['error', { devDependencies: true }],
    'max-len': ['error', { code: 120 }],
  },
};
