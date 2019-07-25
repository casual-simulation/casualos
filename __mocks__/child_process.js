'use strict';

const child_process = jest.genMockFromModule('child_process');

let err = null;
let mockOutput = {};
function __setMockOutput(command, output) {
    mockOutput[command] = output;
}

function __setExecError(error) {
    err = error;
}

function exec(command, callback) {
    const output = mockOutput[command];
    callback(err, output, null);
}

child_process.__setMockOutput = __setMockOutput;
child_process.__setExecError = __setExecError;
child_process.exec = exec;

module.exports = child_process;
