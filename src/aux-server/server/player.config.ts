import { ClientConfig } from './config';
import * as process from 'process';

const config: ClientConfig = {
    index: 'player.html',
    web: {
        isPlayer: true,
        sentryDsn: process.env.SENTRY_DSN,
        version: null,
    },
};

export default config;
