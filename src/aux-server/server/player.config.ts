import { ClientConfig } from './config';
import * as process from 'process';
import { RemoteCausalRepoProtocol } from '@casual-simulation/aux-common';

const config: ClientConfig = {
    index: 'player.html',
    web: {
        sentryDsn: process.env.SENTRY_DSN,
        version: null,
        causalRepoConnectionProtocol:
            (process.env
                .CAUSAL_REPO_CONNECTION_PROTOCOL as RemoteCausalRepoProtocol) ||
            'socket.io',
        causalRepoConnectionUrl: process.env.CAUSAL_REPO_CONNECTION_URL,
    },
};

export default config;
