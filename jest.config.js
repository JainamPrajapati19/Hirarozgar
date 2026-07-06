module.exports = {
  preset: '@react-native/jest-preset',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testEnvironment: 'node',
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
  testMatch: ['**/__tests__/**/*.(test|spec).(ts|tsx|js)', '**/*.(test|spec).(ts|tsx|js)'],
  transform: {
    '^.+\\.(js|jsx|ts|tsx)$': ['babel-jest', { configFile: './babel.config.js' }],
  },
  transformIgnorePatterns: [
    'node_modules/(?!(' +
      'react-native|' +
      '@react-native|' +
      '@react-native/jest-preset|' +
      '@react-native/js-polyfills|' +
      'expo|' +
      '@expo|' +
      'react-native-svg|' +
      '@testing-library' +
    ')/)',
    // test-renderer ships pre-built CJS — skip babel transformation to avoid
    // object-wrapping that breaks renderer.render() in @testing-library/react-native
    'node_modules/test-renderer/',
  ],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/index.ts',
  ],
  moduleNameMapper: {
    '\\.svg$': '<rootDir>/__mocks__/svgMock.js',
    // test-renderer ships only ESM in its main entry; force CJS for Jest
    '^test-renderer$': '<rootDir>/node_modules/test-renderer/dist/index.cjs',
  },
};
