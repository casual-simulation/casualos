export type LoginErrorReason =
    | 'invalid_username'
    | 'invalid_token'
    | 'wrong_token'
    | 'wrong_grant';

export class LoginError extends Error {
    constructor(reason: LoginErrorReason) {
        super();
        this.reason = reason;
    }

    reason: LoginErrorReason;
}
