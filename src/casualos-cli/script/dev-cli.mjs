import { cleanDirectory, setupWatch } from '../../../script/build-helpers.mjs';
import { createConfigs, cleanDirectories } from './cli-configs.mjs';

cleanDirectories();

setupWatch([...createConfigs(true, 'v9.9.9-dev:alpha')]);
