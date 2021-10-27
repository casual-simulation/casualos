const { build } = require('../../../script/build-helpers');
const { createConfigs, cleanDirectories } = require('./proxy-configs');

cleanDirectories();

build(createConfigs(process.argv[2] === 'dev'));
