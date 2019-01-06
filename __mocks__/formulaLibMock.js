const { process: processTs } = require('ts-jest');

function process(...args) {
    return "module.exports = " + JSON.stringify(processTs(...args));
}

module.exports = {
    process: process
}