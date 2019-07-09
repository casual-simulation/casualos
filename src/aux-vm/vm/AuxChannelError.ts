import {
    AuxLoginErrorReason,
    AuxChannelErrorType,
} from './AuxChannelErrorTypes';

export class AuxLoginError extends Error {
    reason: AuxLoginErrorReason;
}

export function toErrorType(err: any): AuxChannelErrorType {
    if (err instanceof AuxLoginError) {
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
