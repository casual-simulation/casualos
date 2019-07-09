import { LoginError, LoginErrorReason } from '@casual-simulation/causal-trees';
import { AuxChannelErrorType } from './AuxChannelErrorTypes';

export function toErrorType(err: any): AuxChannelErrorType {
    if (err instanceof LoginError) {
        return {
            type: 'login',
            reason: err.reason,
        };
    } else {
        return {
            type: 'general',
            message: err.toString(),
        };
    }
}
