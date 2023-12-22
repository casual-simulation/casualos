import type { RemoteCausalRepoProtocol } from '@casual-simulation/aux-common';
import { AuthManager } from './AuthManager';

declare const API_ENDPOINT: string;
declare const WEBSOCKET_ENDPOINT: string;
declare const WEBSOCKET_PROTOCOL: RemoteCausalRepoProtocol;
declare const GIT_TAG: string;

const authManager = new AuthManager(
    API_ENDPOINT,
    WEBSOCKET_ENDPOINT,
    WEBSOCKET_PROTOCOL,
    GIT_TAG
);

export { authManager };
