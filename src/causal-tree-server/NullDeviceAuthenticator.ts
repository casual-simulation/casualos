import { DeviceAuthenticator, DeviceToken } from './DeviceAuthenticator';
import { DeviceInfo, USERNAME_CLAIM, USER_ROLE } from './DeviceInfo';

/**
 * Defines a device authenticator that always returns empty device info.
 */
export class NullDeviceAuthenticator implements DeviceAuthenticator {
    async authenticate(token: DeviceToken): Promise<DeviceInfo> {
        return {
            claims: {
                [USERNAME_CLAIM]: token.username,
            },
            roles: [USER_ROLE],
        };
    }
}
