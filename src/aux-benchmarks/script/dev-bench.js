const { cleanDirectory, setupWatch } = require('../../../script/build-helpers');
const { createConfigs, cleanDirectories } = require('./bench-configs');

cleanDirectories();

setupWatch(createConfigs(true, 'v9.9.9-dev:alpha'));
