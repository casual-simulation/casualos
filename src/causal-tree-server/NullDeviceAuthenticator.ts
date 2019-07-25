import {
    DeviceAuthenticator,
    AuthenticationResult,
} from './DeviceAuthenticator';
import {
    USERNAME_CLAIM,
    DEVICE_ID_CLAIM,
    USER_ROLE,
    ADMIN_ROLE,
    DeviceInfo,
    DeviceToken,
} from '@casual-simulation/causal-trees';
import { Observable, of } from 'rxjs';

/**
 * Defines a device authenticator that always returns empty device info.
 */
export class NullDeviceAuthenticator implements DeviceAuthenticator {
    authenticate(token: DeviceToken): Observable<AuthenticationResult> {
        return of({
            success: true,
            info: {
                claims: {
                    [USERNAME_CLAIM]: token.username,
                    [DEVICE_ID_CLAIM]: token.username,
                },
                roles: [USER_ROLE],
            },
        });
    }
}
