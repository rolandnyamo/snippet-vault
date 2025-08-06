module.exports = {
  presets: [
    ['@babel/preset-env', { 
      targets: { node: 'current' },
      modules: process.env.NODE_ENV === 'test' ? 'commonjs' : false
    }],
    ['@babel/preset-react', { runtime: 'automatic' }]
  ],
  plugins: [],
  env: {
    test: {
      plugins: [
        // Transform import.meta.url to __filename for tests
        ['babel-plugin-transform-import-meta', { module: 'CommonJS' }],
      ]
    }
  }
};