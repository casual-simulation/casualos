/* CasualOS is a set of web-based tools designed to facilitate the creation of real-time, multi-user, context-aware interactive experiences.
 *
 * Copyright (c) 2019-2025 Casual Simulation, Inc.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */
import { readFileSync, readdirSync } from 'fs';
import path from 'path';
import lodash from 'es-toolkit/compat';
// import { merge } from 'es-toolkit/compat';
// import { Plugin } from 'vite';
import { defaultPolicies } from './vite-helpers';

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

export function getPolicies(includeExtensionlessFiles: boolean) {
    const virtualModules: Record<string, string> = {};
    const files: any = {};

    function loadPolicy(name: string, override: string | undefined) {
        const moduleName = `virtual:policies/${name}`;
        let content: string;
        if (override) {
            console.log(`[Policies] Using override for ${name}`);
            const jsonResult = tryParseJson(override);

            if (!jsonResult.success) {
                console.warn(
                    `[Policies] ${name} override was not valid JSON. Using string, but this might be bad if your system does not allow line breaks in environment variables.`
                );
                content = override;
            } else {
                content = String(jsonResult.value);
            }
        } else {
            const defaultTerms = readFileSync(
                path.resolve(defaultPolicies, name),
                'utf8'
            );
            content = defaultTerms;
        }

        virtualModules[moduleName] = content;

        const fileName = name.slice(0, name.lastIndexOf('.'));

        if (includeExtensionlessFiles) {
            files[fileName] = content;
        }
        files[`${fileName}.txt`] = content;
        files[`${fileName}.md`] = content;
    }

    const TERMS_OF_SERVICE = process.env.TERMS_OF_SERVICE;
    const PRIVACY_POLICY = process.env.PRIVACY_POLICY;
    const CHILDREN_PRIVACY_POLICY = process.env.CHILDREN_PRIVACY_POLICY;
    const ACCEPTABLE_USE_POLICY = process.env.ACCEPTABLE_USE_POLICY;
    const CODE_OF_CONDUCT = process.env.CODE_OF_CONDUCT;

    loadPolicy('terms-of-service.md', TERMS_OF_SERVICE);
    loadPolicy('privacy-policy.md', PRIVACY_POLICY);
    loadPolicy('acceptable-use-policy.md', ACCEPTABLE_USE_POLICY);
    loadPolicy('children-privacy-policy.md', CHILDREN_PRIVACY_POLICY);
    loadPolicy('code-of-conduct.md', CODE_OF_CONDUCT);

    return {
        virtualModules,
        files,
    };
}
