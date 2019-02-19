module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  transform: {
    'formula\\-lib\\.ts$': '<rootDir>/__mocks__/formulaLibMock.js'
  },
  moduleNameMapper: {
    'formula\\-lib$': '<rootDir>/src/aux-common/Formulas/formula-lib.ts',
    '^aux-common/(.*)$': '<rootDir>/src/aux-common/$1',
    '^three\\-examples$': '<rootDir>/node_modules/three/examples/js',
  }
};