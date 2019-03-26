import { CausalTree } from "./CausalTree";
import { PublicCryptoKey, PrivateCryptoKey } from "../crypto";
import { AtomValidator } from "./AtomValidator";
import { Atom, atomIdToString, AtomOp } from "./Atom";
import { find } from 'lodash';

/**
 * Defines a wrapper for a causal tree that validates the signatures of atoms that are added to the tree.
 */
export class ValidatedCausalTree<TTree extends CausalTree<AtomOp, any, any>> {

    private _tree: TTree;
    private _keyMap: Map<number, PublicCryptoKey>;
    private _validator: AtomValidator;
    private _signingKey: PrivateCryptoKey;

    /**
     * Creates a new validated causal tree using the given tree, atom validator, and signing key.
     * @param tree The tree to validate.
     * @param validator The atom validator to use.
     * @param signingKey The key to use for signing atoms.
     */
    constructor(tree: TTree, validator: AtomValidator, signingKey: PrivateCryptoKey) {
        this._tree = tree;
        this._keyMap = new Map();
        this._validator = validator;
        this._signingKey = signingKey;
    }

    /**
     * Adds the given atom to the tree and returns the atom that was added.
     * If the atom is for this tree's site and a validator and signing key have been setup
     * then the atom will be signed before being inserted.
     * @param atom The atom.
     */
    async add<T extends AtomOp>(atom: Atom<T>): Promise<Atom<T>> {
        if (this._validator) {
            if (atom.id.site === this._tree.site.id && this._signingKey && !atom.signature) {
                atom = await this.sign(atom);
            } else if (atom.id.site !== this._tree.site.id) {
                const key = await this._getPublicKey(atom.id.site);
                if (key) {
                    const valid = await this._validator.verify(key, atom);
                    if (!valid) {
                        throw new Error(`[CausalTree] Atom (${atomIdToString(atom.id)}) signature is invalid.`);
                    }
                } else if (!key && !!atom.signature) {
                    throw new Error(`[CausalTree] Atom (${atomIdToString(atom.id)}) has a signature but we don't have the key for the site.`);
                }
            }
        }

        return this._tree.add(atom);
    }

    /**
     * Signs the given atoms using this tree's private key
     * and returns a new list of atoms that contain their signatures.
     * @param atoms The atoms to sign.
     */
    private async sign<T extends AtomOp>(atom: Atom<T>): Promise<Atom<T>> {
        if (!this._validator || !this._signingKey) {
            throw new Error('[CausalTree] Cannot sign atoms when no signing key or validator has been given.');
        }
        if (atom.id.site !== this._tree.site.id) {
            throw new Error(`[CausalTree] Can only sign atoms from this site. ${atomIdToString(atom.id)} is not from this site (${this._tree.site.id})`);
        }
        return await this._validator.sign(this._signingKey, atom);
    }

    /**
     * Gets the public key for the given site.
     * If the site does not have a public key, then null is returned.
     * @param siteId The site that the public key should be retrieved for.
     */
    private async _getPublicKey(siteId: number): Promise<PublicCryptoKey> {
        let key = this._keyMap.get(siteId);
        if (!key) {
            const site = find(this._tree.knownSites, s => s.id === siteId);
            if (site && site.crypto && site.crypto.publicKey) {
                key = await this._validator.impl.importPublicKey(site.crypto.publicKey);
            }

            if (key) {
                this._keyMap.set(siteId, key);
            }
        }
        return key;
    }

}