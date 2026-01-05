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

import type { StoredAux } from '@casual-simulation/aux-common';
import {
    constructInitializationUpdate,
    DNA_TAG_PREFIX,
    getBotsStateFromStoredAux,
    isFormula,
    isModule,
    isScript,
    parseFormula,
    parseModule,
    parseScript,
    tryParseJson,
} from '@casual-simulation/aux-common';
import {
    JSX_FACTORY,
    JSX_FRAGMENT_FACTORY,
    IMPORT_FACTORY,
    IMPORT_META_FACTORY,
    EXPORT_FACTORY,
} from '@casual-simulation/aux-runtime/runtime/AuxCompiler';
import * as esbuild from 'esbuild';
import { cloneDeep } from 'es-toolkit';
import { Transpiler } from '@casual-simulation/aux-runtime';

/**
 * Minifies the given aux object.
 * @param aux The aux object to minify.
 * @param target The target or targets to minify for.
 */
export async function minifyAux(
    aux: StoredAux,
    target: string | string[] = [
        'es2020',
        'chrome109',
        'safari18',
        'edge139',
        'firefox140',
    ]
): Promise<StoredAux> {
    return transformAux(aux, {
        minify: true,
        target,
        jsx: 'transform',
        jsxFactory: JSX_FACTORY,
        jsxFragment: JSX_FRAGMENT_FACTORY,
        platform: 'browser',
    });
}

/**
 * Transforms the given aux object using the specified transform options.
 * @param aux The aux object to transform.
 * @param transformOptions The transform options to use.
 * @returns The transformed aux object.
 */
export async function transformAux(
    aux: StoredAux,
    transformOptions: esbuild.TransformOptions
): Promise<StoredAux> {
    const state = cloneDeep(getBotsStateFromStoredAux(aux));

    const transpiler = new Transpiler({
        jsxFactory: JSX_FACTORY,
        jsxFragment: JSX_FRAGMENT_FACTORY,
        importFactory: IMPORT_FACTORY,
        importMetaFactory: IMPORT_META_FACTORY,
        exportFactory: EXPORT_FACTORY,
        insertEnergyChecks: false,
    });

    let promises: Promise<any>[] = [];

    for (let botId in state) {
        const bot = state[botId];

        for (let tag in bot.tags) {
            const value = bot.tags[tag];

            const transformTag = (
                loader: esbuild.TransformOptions['loader'],
                value: string,
                prefix?: string
            ) => {
                try {
                    let transpiled = false;
                    if (
                        loader === 'js' ||
                        loader === 'ts' ||
                        loader === 'tsx' ||
                        loader === 'jsx'
                    ) {
                        transpiled = true;
                        value = transpiler.transpile(value);
                        value = `async function __aux_tag_wrapper__(){\n${value}\n}`;
                    }
                    return esbuild
                        .transform(value, {
                            ...transformOptions,
                            loader,
                        })
                        .then((result) => {
                            let code = result.code;
                            if (transpiled) {
                                code = result.code.slice(
                                    'async function __aux_tag_wrapper__(){'
                                        .length,
                                    result.code.length - 2
                                );
                            }

                            bot.tags[tag] = prefix ? `${prefix}${code}` : code;
                        })
                        .catch((err) => {
                            const system = bot.tags['system'];
                            console.error(
                                `Failed to transform tag ${tag} on bot ${botId}${
                                    system ? ` (system: ${system})` : ''
                                }:`,
                                err
                            );
                        });
                } catch (err) {
                    const system = bot.tags['system'];
                    console.error(
                        `Failed to transform tag ${tag} on bot ${botId}${
                            system ? ` (system: ${system})` : ''
                        }:`,
                        err
                    );
                }
            };

            if (isScript(value)) {
                promises.push(transformTag('tsx', parseScript(value), '@'));
            } else if (isModule(value)) {
                promises.push(transformTag('tsx', parseModule(value), '📄'));
            } else if (isFormula(value)) {
                const parsed = parseFormula(value);
                let failed = false;
                if (!parsed) {
                    failed = true;
                } else {
                    const result = tryParseJson(parsed);
                    if (result.success === false) {
                        failed = true;
                    } else {
                        bot.tags[tag] =
                            DNA_TAG_PREFIX + JSON.stringify(result.value);
                    }
                }

                if (failed) {
                    console.error(
                        `Failed to parse JSON tag ${tag} on bot ${botId}:`
                    );
                }
            } else if (tag.endsWith('.js')) {
                promises.push(transformTag('js', value));
            } else if (tag.endsWith('.css')) {
                promises.push(transformTag('css', value));
            } else if (tag.endsWith('.json')) {
                const result = tryParseJson(value);
                if (result.success === false) {
                    console.error(
                        `Failed to parse JSON tag ${tag} on bot ${botId}:`
                    );
                } else {
                    bot.tags[tag] = JSON.stringify(result.value);
                }
            }
        }
    }

    await Promise.all(promises);

    if (aux.version === 1) {
        return {
            version: 1,
            state,
        };
    } else {
        return {
            version: 2,
            updates: [
                constructInitializationUpdate({
                    type: 'create_initialization_update',
                    bots: Object.values(state),
                }),
            ],
        };
    }
}
