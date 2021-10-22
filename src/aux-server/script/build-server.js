const { cleanDirectory, build } = require('../../../script/build-helpers');
const { createConfigs } = require('./configs');

build(createConfigs(false));
