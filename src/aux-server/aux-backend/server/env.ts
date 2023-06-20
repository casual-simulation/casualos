import path from 'path';
import { listEnvironmentFiles, loadEnvFile } from '../shared/EnvUtils';

declare const DEVELOPMENT: boolean;

const envFiles = listEnvironmentFiles(path.resolve(__dirname, '..'));

for (let file of envFiles) {
    if (!file.endsWith('.dev.env.json') || DEVELOPMENT) {
        loadEnvFile(file);
    }
}

if (envFiles.length < 0) {
    console.log('[Env] No environment files found.');
}
