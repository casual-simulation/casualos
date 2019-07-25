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
    SESSION_ID_CLAIM,
} from '@casual-simulation/causal-trees';
import { Observable, of } from 'rxjs';
import uuid from 'uuid/v4';

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
                    [SESSION_ID_CLAIM]: uuid(),
                },
                roles: [USER_ROLE],
            },
        });
    }
}
