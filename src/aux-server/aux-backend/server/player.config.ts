import { ClientConfig } from './config';
import * as process from 'process';
import {
    RemoteCausalRepoProtocol,
    SharedPartitionsVersion,
} from '@casual-simulation/aux-common';
import { BiosOption } from '../../shared/WebConfig';

declare var DEVELOPMENT: boolean;

const config: ClientConfig = {
    index: 'player.html',
    manifest: 'assets-manifest.json',
    web: {
        version: null,
        causalRepoConnectionProtocol:
            (process.env
                .CAUSAL_REPO_CONNECTION_PROTOCOL as RemoteCausalRepoProtocol) ||
            'websocket',
        causalRepoConnectionUrl: process.env.CAUSAL_REPO_CONNECTION_URL,
        collaborativeRepoLocalPersistence:
            process.env.COLLABORATIVE_REPO_LOCAL_PERSISTENCE === 'true',
        staticRepoLocalPersistence:
            process.env.STATIC_REPO_LOCAL_PERSISTENCE !== 'false',
        sharedPartitionsVersion:
            (process.env
                .SHARED_PARTITIONS_VERSION as SharedPartitionsVersion) ?? 'v2',
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
        playerMode: process.env.AUX_PLAYER_MODE as 'player' | 'builder',
        requirePrivoLogin: process.env.REQUIRE_PRIVO_LOGIN === 'true',
        allowedBiosOptions: (process.env.BIOS_OPTIONS?.split(',') ||
            null) as BiosOption[],
        defaultBiosOption: process.env.DEFAULT_BIOS_OPTION || null,
    },
};

export default config;
