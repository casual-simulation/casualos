import { cleanDirectory, build } from '../../script/build-helpers.mjs';
import { createConfigs } from './typedoc-configs.mjs';

build(createConfigs(false));
