import {
    LoginErrorReason,
    DeviceInfo,
    DeviceToken,
} from '@casual-simulation/causal-trees';
import { Observable } from 'rxjs';

export interface AuthenticationResult {
    success: boolean;
    info?: DeviceInfo;
    error?: LoginErrorReason;
}

/**
 * Defines an interface that is able to authenticate a device.
 */
export interface DeviceAuthenticator {
    /**
     * Authenticates the given token.
     * @param token The token to authenticate.
     */
    authenticate(token: DeviceToken): Observable<AuthenticationResult>;
}
