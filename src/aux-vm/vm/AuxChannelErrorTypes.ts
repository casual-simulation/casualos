import { LoginErrorReason } from '@casual-simulation/causal-trees';

export type AuxChannelErrorType = AuxLoginErrorType | AuxGeneralErrorType;

/**
 * Defines an error that is sent from the Aux Channel when login has failed.
 */
export interface AuxLoginErrorType {
    type: 'login';
    reason: LoginErrorReason;
}

export interface AuxGeneralErrorType {
    type: 'general';
    message: string;
}
