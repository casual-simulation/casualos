// Custom test environment to expose
// native TypedArray classes to tests.
// See https://github.com/facebook/jest/issues/4422
'use strict';

const JSDOMEnvironment = require('jest-environment-jsdom');

class TestEnvironment extends JSDOMEnvironment {
    constructor(config) {
        super(
            Object.assign({}, config, {
                globals: Object.assign({}, config.globals, {
                    Uint32Array: Uint32Array,
                    Uint8Array: Uint8Array,
                    ArrayBuffer: ArrayBuffer,
                }),
            })
        );
    }
}

module.exports = TestEnvironment;
