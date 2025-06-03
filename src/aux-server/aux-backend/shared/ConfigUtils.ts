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
import type { ServerConfig } from '@casual-simulation/aux-records';
import { serverConfigSchema } from '@casual-simulation/aux-records';
import { merge, tryParseJson } from '@casual-simulation/aux-common';

declare const DEVELOPMENT: boolean;
declare const SERVER_CONFIG: string;

export const DEV_CONFIG: ServerConfig = {};

export function loadConfig(
    required: boolean = true,
    dynamicConfig: ServerConfig = {}
) {
    const injectedConfig = parseObject(SERVER_CONFIG);
    const envConfig = parseObject(process.env.SERVER_CONFIG);

    if (!injectedConfig && !envConfig && required) {
        throw new Error(`SERVER_CONFIG must be specified!`);
    }

    const merged = merge(
        {},
        injectedConfig ?? {},
        envConfig ?? {},
        dynamicConfig
    );

    const optionsResult = serverConfigSchema.safeParse(merged);

    if (optionsResult.success === false) {
        console.error(
            'SERVER_CONFIG does not match the options schema',
            optionsResult.error
        );
        throw new Error(`SERVER_CONFIG must be a valid set of options.`);
    }

    const options = optionsResult.data;

    if (DEVELOPMENT) {
        return merge({}, DEV_CONFIG, options);
    }

    return options;
}

function parseObject(input: string | object) {
    if (typeof input === 'string') {
        const serverConfigParseResult = tryParseJson(input);

        if (serverConfigParseResult.success === false) {
            throw new Error(
                `SERVER_CONFIG must be valid JSON: ${serverConfigParseResult.error}`
            );
        }
        return serverConfigParseResult.value;
    } else if (typeof input === 'object') {
        return input;
    } else {
        return null;
    }
}
