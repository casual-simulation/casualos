import { tryParseJson } from '@casual-simulation/aux-records';
import { readFileSync, readdirSync } from 'fs';
import path from 'path';

declare const DEVELOPMENT: boolean;

/**
 * Loads the given environment file into the process environment.
 * @param file The file to load.
 */
export function loadEnvFile(file: string) {
    const json = readFileSync(file, { encoding: 'utf-8' });
    const parsed = tryParseJson(json);

    if (parsed.success) {
        for (let key in parsed.value) {
            console.log(
                `[EnvUtils] Injecting Key from ${path.basename(file)}`,
                key
            );
            const value = parsed.value[key];
            if (value === null || value === undefined || value === '') {
                delete process.env[key];
            } else if (typeof value === 'object') {
                process.env[key] = JSON.stringify(value);
            } else {
                process.env[key] = String(value);
            }
        }
    }
}

/**
 * Gets the list of full paths of environment files from the given directory.
 * @param directory The directory to list environment files in.
 */
export function listEnvironmentFiles(directory: string): string[] {
    const files = readdirSync(directory, {
        withFileTypes: true,
    });

    return files
        .filter((f) => f.isFile() && f.name.endsWith('.env.json'))
        .map((f) => path.join(directory, f.name));
}
