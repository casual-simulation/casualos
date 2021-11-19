module.exports = {
    preset: 'ts-jest',
    testEnvironment: './jest/test_environment.js',
    moduleFileExtensions: ['ts', 'tsx', 'js'],
    testPathIgnorePatterns: [
        '/node_modules/',
        '/temp/',
        '/lib/',
        '/dist/',
        '/__arbitraries__/',
    ],
    watchPathIgnorePatterns: ['/node_modules/'],
    setupFilesAfterEnv: ['<rootDir>/jest/jest-setup.ts'],
    moduleNameMapper: {
        '^aux-common/(.*)$': '<rootDir>/src/aux-common/$1',
        '^@casual-simulation/three/examples/js/renderers/CSS3DRenderer$':
            '<rootDir>/__mocks__/CSS3DRendererMock.js',
        '^three\\-examples$': '<rootDir>/node_modules/three/examples/js',
        '^esbuild-wasm/esbuild.wasm\\?url$':
            '<rootDir>/__mocks__/esbuild.wasm.js',
    },
};
