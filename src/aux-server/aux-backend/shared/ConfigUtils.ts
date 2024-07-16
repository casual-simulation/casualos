import {
    ServerConfig,
    serverConfigSchema,
    tryParseJson,
} from '@casual-simulation/aux-records';
import { merge } from '@casual-simulation/aux-common';

declare const DEVELOPMENT: boolean;
declare const SERVER_CONFIG: string;

export const DEV_CONFIG: ServerConfig = {};

export function loadConfig(required: boolean = true) {
    const injectedConfig = parseObject(SERVER_CONFIG);
    const envConfig = parseObject(process.env.SERVER_CONFIG);

    if (!injectedConfig && !envConfig && required) {
        throw new Error(`SERVER_CONFIG must be specified!`);
    }

    const merged = merge({}, injectedConfig ?? {}, envConfig ?? {});

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
