export type LoginErrorReason =
    | 'invalid_username'
    | 'invalid_token'
    | 'wrong_token'
    | 'wrong_grant';

export interface LoginError {
    type: 'login';
    reason: LoginErrorReason;
}
