/**
 * Defines an interface for objects that can provide authentication services
 * for tokens and app bundle IDs.
 */
export interface AuthProvider {
    /**
     * Validates that the given token was created for the given bundle ID.
     * Returns the issuer that created the token. Returns null if the token is invalid.
     * @param token The token.
     * @param bundle The bundle ID.
     */
    validateToken(token: string, bundle: string): string;

    /**
     * Gets the number of miliseconds since Jan 1 1970 UTC that the token will expire at at.
     * @param token The token to get the expire time for.
     */
    getTokenExpireTime(token: string): number;
}

export class MemoryAuthProvider implements AuthProvider {
    private _tokenIssuers = new Map<string, string>();
    private _tokenIssueTimes = new Map<string, number>();

    setTokenIssuer(token: string, issuer: string) {
        this._tokenIssuers.set(token, issuer);
    }

    setTokenExpireTime(token: string, issueTime: number) {
        this._tokenIssueTimes.set(token, issueTime);
    }

    validateToken(token: string, bundle: string): string {
        const issuer = this._tokenIssuers.get(token);
        if (issuer === undefined) {
            return null;
        }
        return issuer;
    }

    getTokenExpireTime(token: string): number {
        const time = this._tokenIssueTimes.get(token);
        if (time === undefined) {
            return null;
        }
        return time;
    }
}
