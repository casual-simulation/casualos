import { setupInstrumentation } from '../../../shared/Instrumentation';
import { loadConfig } from '../../../shared/ConfigUtils';

const config = loadConfig();
setupInstrumentation(config);
