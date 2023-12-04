import { cleanDirectory, setupWatch } from '../../../script/build-helpers.mjs';
import { createConfigs, cleanDirectories } from './redirector-configs';

cleanDirectories();

setupWatch(createConfigs(true, 'v9.9.9-dev:alpha'));
