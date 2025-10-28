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
    getBotsStateFromStoredAux,
    isFormula,
    isModule,
    isScript,
    parseModule,
    parseScript,
} from '@casual-simulation/aux-common';
import * as esbuild from 'esbuild';
import { cloneDeep } from 'es-toolkit';

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
        jsx: 'preserve',
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

    let promises: Promise<any>[] = [];

    for (let botId in state) {
        const bot = state[botId];

        for (let tag in bot.tags) {
            const value = bot.tags[tag];

            const transformTag = (
                loader: esbuild.TransformOptions['loader'],
                value: string,
                prefix?: string
            ) =>
                esbuild
                    .transform(value, {
                        ...transformOptions,
                        loader,
                    })
                    .then((result) => {
                        bot.tags[tag] = prefix
                            ? `${prefix}${result.code}`
                            : result.code;
                    });

            if (isScript(value)) {
                promises.push(transformTag('tsx', parseScript(value), '@'));
            } else if (isModule(value)) {
                promises.push(transformTag('tsx', parseModule(value), '📄'));
            } else if (isFormula(value)) {
                promises.push(transformTag('json', value, '🧬'));
            } else if (tag.endsWith('.js')) {
                promises.push(transformTag('js', value));
            } else if (tag.endsWith('.css')) {
                promises.push(transformTag('css', value));
            } else if (tag.endsWith('.json')) {
                promises.push(transformTag('json', value));
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
