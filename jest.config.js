module.exports = {
    preset: 'ts-jest',
    testEnvironment: './jest/test_environment.js',
    moduleFileExtensions: ['ts', 'tsx', 'js'],
    testPathIgnorePatterns: [
        '/node_modules/',
        '/temp/',
        '/lib/',
        '/dist/',
        '/playwright/',
        '/__arbitraries__/',
        '/__tests__/setPrettyPrint',
    ],
    watchPathIgnorePatterns: ['/node_modules/'],
    setupFiles: ['fake-indexeddb/auto'],
    setupFilesAfterEnv: ['<rootDir>/jest/jest-setup.ts'],
    moduleNameMapper: {
        '^aux-common/(.*)$': '<rootDir>/src/aux-common/$1',
        '^@casual-simulation/three/examples/js/renderers/CSS3DRenderer$':
            '<rootDir>/__mocks__/CSS3DRendererMock.js',
        '^three$':
            '<rootDir>/src/aux-server/node_modules/@casual-simulation/three',
        '^esbuild-wasm/esbuild.wasm\\?url$':
            '<rootDir>/__mocks__/esbuild.wasm.js',
        '^aux-jest-matchers$': '<rootDir>/jest/jest-matchers.ts',
        '^@simplewebauthn/browser$':
            '<rootDir>/__mocks__/@simplewebauthn/browser.js',
    },
    transform: {
        '^.+\\.tsx?$': [
            'ts-jest',
            {
                tsconfig: 'tsconfig.test.json',
            },
        ],
    },
    snapshotFormat: {
        escapeString: true,
        printBasicPrototype: true,
    },
};
