import { tryParseJson } from '@casual-simulation/aux-records';
import { readFileSync, readdirSync } from 'fs';
import path from 'path';
import { merge } from 'lodash';

declare const DEVELOPMENT: boolean;

/**
 * Loads the given environment file into the process environment.
 * @param files The files to load.
 */
export function loadEnvFiles(files: string[]) {
    const temp = {} as any;

    for (let file of files) {
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
                    delete temp[key];
                } else if (typeof value === 'object') {
                    if (typeof temp[key] === 'object') {
                        temp[key] = merge(temp[key], value);
                    } else {
                        temp[key] = value;
                    }
                } else {
                    temp[key] = String(value);
                }
            }
        }
    }

    for (let key in temp) {
        if (temp[key] === null || temp[key] === undefined || temp[key] === '') {
            delete process.env[key];
        } else if (typeof temp[key] === 'object') {
            process.env[key] = JSON.stringify(temp[key]);
        } else {
            process.env[key] = String(temp[key]);
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

/**
 * Gets the list of API origins that are allowed to make requests.
 */
export function getAllowedAPIOrigins(): string[] {
    const origins = process.env.ALLOWED_API_ORIGINS;
    if (origins) {
        const values = origins.split(' ');
        return values.filter((v) => !!v);
    }

    return [];
}

/**
 * Gets the list of API origins that are allowed to make requests.
 */
function getAllowedOrigins(): string[] {
    const origins = process.env.ALLOWED_ORIGINS;
    if (origins) {
        const values = origins.split(' ');
        return values.filter((v) => !!v);
    }

    return [];
}

export const allowedOrigins = new Set([
    'http://localhost:3002',
    'https://casualos.me',
    'https://ab1.link',
    ...getAllowedOrigins(),
]);
