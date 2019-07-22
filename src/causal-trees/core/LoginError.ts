export type LoginErrorReason =
    | 'invalid_username'
    | 'invalid_token'
    | 'wrong_token'
    | 'wrong_grant'
    | 'unauthorized'
    | 'account_locked';

export interface LoginError {
    type: 'login';
    reason: LoginErrorReason;
}
