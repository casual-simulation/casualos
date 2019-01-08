module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  // moduleNameMapper: {
  //   '\\.(jpg|jpeg|png|gif|eot|otf|webp|svg|ttf|woff|woff2|mp4|webm|wav|mp3|m4a|aac|oga)$': '<rootDir>/__mocks__/fileMock.js',
  //   '\\.(css|less)$': '<rootDir>/__mocks__/styleMock.js'
  // },
  transform: {
    'formula\\-lib\\.ts$': '<rootDir>/__mocks__/formulaLibMock.js'
  },
  moduleNameMapper: {
    '^formula\\-lib$': '<rootDir>/common/Formulas/formula-lib.ts',
    '^common(.*)$': '<rootDir>/common',
    '^von\\-grid$': '<rootDir>/WebClient/public/von-grid.min.js',
    '^three\\-examples$': '<rootDir>/node_modules/three/examples/js',
    '^fs$': 'browserfs'
  }
};