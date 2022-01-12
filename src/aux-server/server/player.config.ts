import { ClientConfig } from './config';
import * as process from 'process';
import {
    RemoteCausalRepoProtocol,
    SharedPartitionsVersion,
} from '@casual-simulation/aux-common';

declare var DEVELOPMENT: boolean;

const config: ClientConfig = {
    index: 'player.html',
    manifest: 'assets-manifest.json',
    web: {
        sentryDsn: process.env.SENTRY_DSN,
        version: null,
        causalRepoConnectionProtocol:
            (process.env
                .CAUSAL_REPO_CONNECTION_PROTOCOL as RemoteCausalRepoProtocol) ||
            'websocket',
        causalRepoConnectionUrl: process.env.CAUSAL_REPO_CONNECTION_URL,
        sharedPartitionsVersion:
            (process.env
                .SHARED_PARTITIONS_VERSION as SharedPartitionsVersion) ??
            (DEVELOPMENT === true ? 'v2' : 'v1'),
        vmOrigin: process.env.VM_ORIGIN || null,
        authOrigin:
            process.env.AUTH_ORIGIN ||
            (DEVELOPMENT ? 'http://localhost:3002' : null),
        recordsOrigin:
            process.env.RECORDS_ORIGIN ||
            (DEVELOPMENT ? 'http://localhost:3002' : null),
        disableCollaboration: process.env.DISABLE_COLLABORATION === 'true',
        ab1BootstrapURL: process.env.AB1_BOOTSTRAP_URL || null,
        arcGisApiKey: process.env.ARC_GIS_API_KEY,
        jitsiAppName:
            process.env.JITSI_APP_NAME ||
            'vpaas-magic-cookie-332b53bd630448a18fcb3be9740f2caf',
        what3WordsApiKey: process.env.WHAT_3_WORDS_API_KEY || 'Z0NHMSXQ',
    },
};

export default config;
