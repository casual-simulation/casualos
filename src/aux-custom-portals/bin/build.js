const path = require('path');
const esbuild = require('esbuild');
const { options } = require('./common');

esbuild.buildSync({
    ...options,
});
