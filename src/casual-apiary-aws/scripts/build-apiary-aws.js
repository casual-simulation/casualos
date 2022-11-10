const { build } = require('../../../script/build-helpers');
const { createConfigs, cleanDirectories } = require('./apiary-aws-configs');

cleanDirectories();

build(createConfigs(process.argv[2] === 'dev'));
