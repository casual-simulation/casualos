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
}

export class MemoryAuthProvider implements AuthProvider {
    private _tokenIssuers = new Map<string, string>();

    setTokenIssuer(token: string, issuer: string) {
        this._tokenIssuers.set(token, issuer);
    }

    validateToken(token: string, bundle: string): string {
        const issuer = this._tokenIssuers.get(token);
        if (issuer === undefined) {
            return null;
        }
        return issuer;
    }
}
