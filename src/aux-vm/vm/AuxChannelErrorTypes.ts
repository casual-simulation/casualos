export type AuxChannelErrorType = AuxLoginErrorType | AuxGeneralErrorType;

export type AuxLoginErrorReason =
    | 'invalid_username'
    | 'invalid_token'
    | 'wrong_token'
    | 'wrong_grant';

/**
 * Defines an error that is sent from the Aux Channel when login has failed.
 */
export interface AuxLoginErrorType {
    type: 'login';
    reason: AuxLoginErrorReason;
}

export interface AuxGeneralErrorType {
    type: 'general';
    message: string;
}
