const { build } = require('../../../script/build-helpers');
const { createConfigs } = require('./interpreter-configs');

build(createConfigs(false));
