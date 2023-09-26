import path from 'path';
import { listEnvironmentFiles, loadEnvFiles } from '../shared/EnvUtils';

const env = process.env.NODE_ENV;
const DEVELOPMENT = env !== 'production';

const envFiles = listEnvironmentFiles(path.resolve(__dirname, '..'));

loadEnvFiles(
    envFiles.filter((file) => !file.endsWith('.dev.env.json') || DEVELOPMENT)
);

if (envFiles.length < 0) {
    console.log('[Env] No environment files found.');
}
