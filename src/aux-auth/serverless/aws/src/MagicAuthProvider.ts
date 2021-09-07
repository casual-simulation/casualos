import { Magic } from '@magic-sdk/admin';
import { AuthProvider } from './AuthProvider';

export class MagicAuthProvider implements AuthProvider {
    private _magic: Magic;

    constructor(secretKey: string) {
        this._magic = new Magic(secretKey);
    }

    validateToken(token: string, bundle: string): string {
        try {
            this._magic.token.validate(token, bundle);
            return this._magic.token.getIssuer(token);
        } catch (err) {
            console.error('[MagicAuthProvider]', err);
            return null;
        }
    }
}
