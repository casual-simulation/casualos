const { cleanDirectory, build } = require('../../script/build-helpers');
const { createConfigs } = require('./typedoc-configs');

build(createConfigs(false));
