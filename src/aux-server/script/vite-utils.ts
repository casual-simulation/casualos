import { readFileSync, readdirSync } from 'fs';
import path from 'path';
import lodash from 'lodash';
// import { merge } from 'lodash';
// import { Plugin } from 'vite';
import { defaultPolicies, root, src } from './vite-helpers';

const { merge } = lodash;

export type JsonParseResult = JsonParseSuccess | JsonParseFailure;

export interface JsonParseSuccess {
    success: true;
    value: any;
}

export interface JsonParseFailure {
    success: false;
    error: Error;
}

/**
 * Tries to parse the given JSON string into a JavaScript Value.
 * @param json The JSON to parse.
 */
export function tryParseJson(json: string): JsonParseResult {
    try {
        return {
            success: true,
            value: JSON.parse(json),
        };
    } catch (err) {
        return {
            success: false,
            error: err,
        };
    }
}

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

export function getPolicies() {
    const virtualModules: Record<string, string> = {};
    const files: any = {};

    function loadPolicy(name: string, override: string | undefined) {
        const moduleName = `virtual:policies/${name}`;
        let content: string;
        if (override) {
            console.log(`[Policies] Using override for ${name}`);
            content = override;
        } else {
            const defaultTerms = readFileSync(
                path.resolve(defaultPolicies, name),
                'utf8'
            );
            content = defaultTerms;
        }

        virtualModules[moduleName] = content;

        const fileName = name.slice(0, name.lastIndexOf('.'));

        files[fileName] = content;
        files[`${fileName}.txt`] = content;
        files[`${fileName}.md`] = content;
    }

    const TERMS_OF_SERVICE = process.env.TERMS_OF_SERVICE;
    const PRIVACY_POLICY = process.env.PRIVACY_POLICY;
    const ACCEPTABLE_USE_POLICY = process.env.ACCEPTABLE_USE_POLICY;

    loadPolicy('terms-of-service.md', TERMS_OF_SERVICE);
    loadPolicy('privacy-policy.md', PRIVACY_POLICY);
    loadPolicy('acceptable-use-policy.md', ACCEPTABLE_USE_POLICY);

    return {
        virtualModules,
        files,
    };
}
