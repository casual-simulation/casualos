import path from 'path';
import { listEnvironmentFiles, loadEnvFiles } from '../shared/EnvUtils';

const env = process.env.NODE_ENV;
const DEVELOPMENT = env !== 'production';

const serverDir = path.resolve(__dirname, '..');
const auxServerDir = path.resolve(serverDir, '..', '');

const envFiles = [
    ...listEnvironmentFiles(serverDir),
    ...listEnvironmentFiles(auxServerDir),
];

loadEnvFiles(
    envFiles.filter((file) => !file.endsWith('.dev.env.json') || DEVELOPMENT)
);

if (envFiles.length < 0) {
    console.log('[Env] No environment files found.');
}
