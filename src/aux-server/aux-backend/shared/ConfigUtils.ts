import { tryParseJson } from '@casual-simulation/aux-records';
import { BuilderOptions, optionsSchema } from '../shared/ServerBuilder';
import { merge } from '@casual-simulation/aux-common';

declare const DEVELOPMENT: boolean;
declare const SERVER_CONFIG: string;

export const DEV_CONFIG: BuilderOptions = {
    livekit: {
        apiKey: 'APIu7LWFmsZckWx',
        secretKey: 'YOaoO1yUQgugMgn77dSYiVLzqdmiITNUgs3TNeZAufZ',
        endpoint: 'ws://localhost:7880',
    },
    prisma: {},
    redis: {
        host: 'localhost',
        port: 6379,
        rateLimitPrefix: 'aux-rate-limit/',
        tls: false,
    },
    mongodb: {
        url: 'mongodb://localhost:27017',
        useNewUrlParser: true,
        database: 'aux-auth',
        fileUploadUrl: 'http://localhost:2998/api/v2/records/file',
    },
};

export function loadConfig(required: boolean = true) {
    const injectedConfig = parseObject(SERVER_CONFIG);
    const envConfig = parseObject(process.env.SERVER_CONFIG);

    if (!injectedConfig && !envConfig && required) {
        throw new Error(`SERVER_CONFIG must be specified!`);
    }

    const merged = merge({}, injectedConfig ?? {}, envConfig ?? {});

    const optionsResult = optionsSchema.safeParse(merged);

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
