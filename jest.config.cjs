module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.js?(x)', '**/?(*.)+(spec|test).js?(x)'],
  transform: {
    '^.+\.js$': 'babel-jest',
  },
  transformIgnorePatterns: [
    '/node_modules/(?!(@tensorflow|@tensorflow-models))',
  ],
};