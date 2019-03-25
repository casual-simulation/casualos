import { SigningCryptoImpl } from "crypto/CryptoImpl";


/**
 * Defines a class that can produce and validate signatures for atoms.
 */
export class AtomValidator {
    private _impl: SigningCryptoImpl;

    constructor(impl: SigningCryptoImpl) {
        this._impl = impl;
    }

    sign() {
        
    }

}