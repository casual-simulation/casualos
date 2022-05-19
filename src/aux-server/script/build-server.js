const { cleanDirectory, build } = require('../../../script/build-helpers');
const { createConfigs } = require('./server-configs');

build(createConfigs(false));
