import {
    DeviceAuthenticator,
    DeviceToken,
    AuthenticationResult,
} from './DeviceAuthenticator';
import {
    USERNAME_CLAIM,
    USER_ROLE,
    ADMIN_ROLE,
    DeviceInfo,
} from '@casual-simulation/causal-trees';

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
