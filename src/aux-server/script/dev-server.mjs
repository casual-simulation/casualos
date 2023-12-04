import { cleanDirectory, setupWatch } from '../../../script/build-helpers.mjs';
import { createConfigs, cleanDirectories } from './server-configs';
import { createConfigs as interpreterConfigs } from './interpreter-configs';

cleanDirectories();

setupWatch([
    ...createConfigs(true, 'v9.9.9-dev:alpha'),
    ...interpreterConfigs(true, 'v9.9.9-dev:alpha'),
]);
