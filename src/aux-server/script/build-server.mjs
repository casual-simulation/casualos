import { cleanDirectory, build } from '../../../script/build-helpers.mjs';
import { createConfigs } from './server-configs';

build(createConfigs(false));
