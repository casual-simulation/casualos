import { AuthManager } from './AuthManager';

declare const API_ENDPOINT: string;
declare const GIT_TAG: string;

const authManager = new AuthManager(API_ENDPOINT, GIT_TAG);

export { authManager };
