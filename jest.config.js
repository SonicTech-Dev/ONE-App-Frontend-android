module.exports = {
  preset: 'react-native',
  // Match every react-native-* / @react-native-* package, not just a hand-listed
  // few — third-party RN packages ship untranspiled ESM and must be transformed.
  transformIgnorePatterns: [
    'node_modules/(?!(react-native[^/]*|@react-native[^/]*|@react-navigation)/)'
  ],
  setupFiles: [
    '<rootDir>/jest.setup.js',
    'react-native-gesture-handler/jestSetup'
  ],
  moduleNameMapper: {
    '^react-native-vector-icons/(.*)$': '<rootDir>/__mocks__/react-native-vector-icons.js'
    ,
    '^react-native-secure-key-store$': '<rootDir>/__mocks__/react-native-secure-key-store.js'
    ,
    '^react-native-linear-gradient$': '<rootDir>/__mocks__/react-native-linear-gradient.js'
  },
};
