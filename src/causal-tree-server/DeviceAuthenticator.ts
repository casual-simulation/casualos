import { DeviceInfo } from './DeviceInfo';

/**
 * Defines an interface for a username & bearer token pair.
 */
export interface DeviceToken {
    /**
     * The username of the account to login to.
     */
    username: string;

    /**
     * The token to use for authentication.
     */
    token: string;

    /**
     * The token that should be used to add a new token to the user's account.
     */
    grant?: string;
}

/**
 * Defines an interface that is able to authenticate a device.
 */
export interface DeviceAuthenticator {
    /**
     * Authenticates the given token.
     * If not authenticated, then the returned object will be null.
     * @param token The token to authenticate.
     */
    authenticate(token: DeviceToken): Promise<DeviceInfo>;
}
