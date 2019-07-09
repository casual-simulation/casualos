import {
    DeviceAuthenticator,
    DeviceToken,
    AuthenticationResult,
} from './DeviceAuthenticator';
import { DeviceInfo, USERNAME_CLAIM, USER_ROLE } from './DeviceInfo';

/**
 * Defines a device authenticator that always returns empty device info.
 */
export class NullDeviceAuthenticator implements DeviceAuthenticator {
    async authenticate(token: DeviceToken): Promise<AuthenticationResult> {
        return {
            success: true,
            info: {
                claims: {
                    [USERNAME_CLAIM]: token.username,
                },
                roles: [USER_ROLE],
            },
        };
    }
}
