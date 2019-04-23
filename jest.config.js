module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    moduleFileExtensions: ['ts', 'tsx', 'js'],
    testPathIgnorePatterns: ['/node_modules/', '/temp/', '/lib/', '/dist/'],
    moduleNameMapper: {
        '^aux-common/(.*)$': '<rootDir>/src/aux-common/$1',
        '^three\\-examples$': '<rootDir>/node_modules/three/examples/js',
    },
};
