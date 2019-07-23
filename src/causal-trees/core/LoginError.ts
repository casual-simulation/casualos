export type LoginErrorReason =
    | 'invalid_username'
    | 'invalid_token'
    | 'wrong_token'
    | 'wrong_grant'
    | 'unauthorized'
    | 'account_locked'
    | 'token_locked'
    | 'channel_doesnt_exist';

export interface LoginError {
    type: 'login';
    reason: LoginErrorReason;
}
