import { build } from '../../../script/build-helpers.mjs';
import { createConfigs, cleanDirectories } from './redirector-configs.mjs';

cleanDirectories();

build(createConfigs(process.argv[2] === 'dev'));
