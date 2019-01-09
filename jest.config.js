module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  transform: {
    'formula\\-lib\\.ts$': '<rootDir>/__mocks__/formulaLibMock.js'
  },
  moduleNameMapper: {
    '^formula\\-lib$': '<rootDir>/common/Formulas/formula-lib.ts',
    '^common/(.*)$': '<rootDir>/common/$1',
    '^von\\-grid$': '<rootDir>/WebClient/public/von-grid.min.js',
    '^three\\-examples$': '<rootDir>/node_modules/three/examples/js',
    '^fs$': 'browserfs'
  }
};