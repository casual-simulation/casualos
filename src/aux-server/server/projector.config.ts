import { ClientConfig } from './config';
import * as process from 'process';

const config: ClientConfig = {
    index: 'projector.html',
    web: {
        isBuilder: true,
        isPlayer: false,
        sentryDsn: process.env.SENTRY_DSN,
        version: null,
    },
};

export default config;
