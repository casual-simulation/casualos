import { ClientConfig } from './config';
import * as process from 'process';
import {
    RemoteCausalRepoProtocol,
    SharedPartitionsVersion,
} from '@casual-simulation/aux-common';

const config: ClientConfig = {
    index: 'player.html',
    manifest: 'assets-manifest.json',
    web: {
        sentryDsn: process.env.SENTRY_DSN,
        version: null,
        causalRepoConnectionProtocol:
            (process.env
                .CAUSAL_REPO_CONNECTION_PROTOCOL as RemoteCausalRepoProtocol) ||
            'socket.io',
        causalRepoConnectionUrl: process.env.CAUSAL_REPO_CONNECTION_URL,
        sharedPartitionsVersion:
            (process.env
                .SHARED_PARTITIONS_VERSION as SharedPartitionsVersion) ?? 'v1',
        vmOrigin: process.env.VM_ORIGIN || null,
        disableCollaboration: process.env.DISABLE_COLLABORATION === 'true',
    },
};

export default config;
