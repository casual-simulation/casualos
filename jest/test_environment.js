// Custom test environment to expose
// native TypedArray classes to tests.
// See https://github.com/facebook/jest/issues/4422
'use strict';

const NodeEnvironment = require('jest-environment-node').TestEnvironment;

class TestEnvironment extends NodeEnvironment {
    constructor(config, context) {
        super(
            Object.assign({}, config, {
                globals: Object.assign({}, config.globals, {
                    Uint32Array: Uint32Array,
                    Uint8Array: Uint8Array,
                    ArrayBuffer: ArrayBuffer,
                    MessagePort: class MessagePort {},
                }),
            }),
            context
        );
    }
}

module.exports = TestEnvironment;
