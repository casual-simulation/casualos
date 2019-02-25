module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleFileExtensions: ['ts', 'tsx', 'js'],
  moduleNameMapper: {
    '^aux-common/(.*)$': '<rootDir>/src/aux-common/$1',
    '^three\\-examples$': '<rootDir>/node_modules/three/examples/js',
  }
};