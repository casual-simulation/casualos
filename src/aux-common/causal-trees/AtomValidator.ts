import { SigningCryptoImpl, PrivateCryptoKey, PublicCryptoKey } from '../crypto';
import { AtomOp, Atom } from './Atom';
import stringify from 'fast-json-stable-stringify';
import { toByteArray, fromByteArray } from 'base64-js';

/**
 * Defines a class that can produce and validate signatures for atoms.
 */
export class AtomValidator {
    private _impl: SigningCryptoImpl;

    /**
     * Creates a new Atom Validator instance that uses the given crypto implementation.
     * @param impl The implementation.
     */
    constructor(impl: SigningCryptoImpl) {
        this._impl = impl;
    }

    /**
     * Signs the given atom with the given private key and returns a new
     * atom that contains the signature.
     * @param key The key to sign the atom with.
     * @param atom The atom to sign.
     */
    async sign<T extends AtomOp>(key: PrivateCryptoKey, atom: Atom<T>): Promise<Atom<T>> {
        const fields = [atom.id, atom.cause, atom.value];
        const json = stringify(fields);
        const buf = Buffer.from(json);
        const signature = await this._impl.sign(key, buf.buffer);
        const ints = new Uint8Array(signature);
        const base64 = fromByteArray(ints);
        return {
            ...atom,
            signature: base64,
        };
    }

    /**
     * Verifies that the given atom was signed with the private key associated with the given public key.
     * Returns true if the atom's signature is valid. Returns false if the atom does not have a signature or if the
     * signature is invalid.
     * @param key The key to use for decrypting the signature.
     * @param atom The atom to verify.
     */
    async verify<T extends AtomOp>(key: PublicCryptoKey, atom: Atom<T>): Promise<boolean> {
        if (!atom.signature) {
            return false;
        }
        const ints = toByteArray(atom.signature);
        const signature = ints.buffer;
        return await this._impl.verify(key, signature);
    }

}