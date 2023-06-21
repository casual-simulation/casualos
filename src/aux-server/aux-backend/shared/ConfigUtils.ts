import { tryParseJson } from '@casual-simulation/aux-records';
import { BuilderOptions, optionsSchema } from '../shared/ServerBuilder';
import { merge } from 'lodash';

declare const DEVELOPMENT: boolean;

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
    const SERVER_CONFIG = process.env.SERVER_CONFIG;

    let configObject: any;

    if (typeof SERVER_CONFIG === 'string') {
        const serverConfigParseResult = tryParseJson(SERVER_CONFIG);

        if (serverConfigParseResult.success === false) {
            throw new Error(
                `SERVER_CONFIG must be valid JSON: ${serverConfigParseResult.error}`
            );
        }
        configObject = serverConfigParseResult.value;
    } else if (typeof SERVER_CONFIG === 'object') {
        configObject = SERVER_CONFIG;
    } else if (required) {
        throw new Error(`SERVER_CONFIG must be a JSON string or an object.`);
    } else {
        return null;
    }

    const optionsResult = optionsSchema.safeParse(configObject);

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
