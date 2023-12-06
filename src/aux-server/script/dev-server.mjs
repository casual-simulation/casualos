import { cleanDirectory, setupWatch } from '../../../script/build-helpers.mjs';
import { createConfigs, cleanDirectories } from './server-configs.mjs';
import { createConfigs as interpreterConfigs } from './interpreter-configs.mjs';

cleanDirectories();

setupWatch([
    ...createConfigs(true, 'v9.9.9-dev:alpha'),
    ...interpreterConfigs(true, 'v9.9.9-dev:alpha'),
]);
