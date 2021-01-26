module.exports = {
    preset: 'ts-jest',
    testEnvironment: './jest/test_environment.js',
    moduleFileExtensions: ['vue', 'ts', 'tsx', 'js'],
    testPathIgnorePatterns: ['/node_modules/', '/temp/', '/lib/', '/dist/'],
    watchPathIgnorePatterns: ['/node_modules/'],
    setupFilesAfterEnv: ['<rootDir>/jest/jest-setup.ts'],
    moduleNameMapper: {
        '^aux-common/(.*)$': '<rootDir>/src/aux-common/$1',
        '^three/examples/js/renderers/CSS3DRenderer$':
            '<rootDir>/__mocks__/CSS3DRendererMock.js',
        '^three\\-examples$': '<rootDir>/node_modules/three/examples/js',
    },
    transform: {
        '^.+\\.tsx?$': 'ts-jest',
        '^.+\\.vue$': 'vue-jest',
    },
    globals: {
        'vue-jest': {
            babelConfig: false,
            tsConfig: false,
        },
    },
};
