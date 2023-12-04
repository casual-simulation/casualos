import { build } from '../../../script/build-helpers.mjs';
import { createConfigs, cleanDirectories } from './proxy-configs.mjs';

cleanDirectories();

build(createConfigs(process.argv[2] === 'dev'));
