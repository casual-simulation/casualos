import { AtomOp, Atom, AtomId, atom, atomId } from './Atom';
import { SiteInfo } from './SiteIdInfo';
import { PrivateCryptoKey } from '@casual-simulation/crypto';
import { AtomValidator } from './AtomValidator';

/**
 * Defines a class that can create atoms based on a site ID and lamport timestamp.
 */
export class AtomFactory<TOp extends AtomOp> {
    private _site: SiteInfo;
    private _time: number;
    private _signingKey: PrivateCryptoKey;
    private _validator: AtomValidator;

    /**
     * Gets the key that this factory uses to sign atoms.
     */
    get signingKey() {
        return this._signingKey;
    }

    /**
     * Gets the site ID for this factory.
     */
    get site() {
        return this._site.id;
    }

    /**
     * Gets the current lamport time from this factory.
     */
    get time() {
        return this._time;
    }

    /**
     * Creates a new atom factory with the given site.
     * @param site The site that this factory creates atoms for.
     * @param timestamp The timestamp that this factory is starting at.
     * @param validator The atom validator that should be used to sign atoms.
     * @param signingKey The key that should be used to sign atoms.
     */
    constructor(
        site: SiteInfo,
        timestamp: number = 0,
        validator: AtomValidator = null,
        signingKey: PrivateCryptoKey = null
    ) {
        this._site = site;
        this._time = timestamp;
        this._validator = validator;
        this._signingKey = signingKey;
    }

    /**
     * Updates the timestamp stored by this factory.
     * @param atom The atom that is being added to the tree.
     */
    updateTime<T extends TOp>(atom: Atom<T>) {
        if (atom.id.site !== this.site) {
            this._time = Math.max(this._time, atom.id.timestamp) + 1;
        } else {
            this._time = Math.max(this._time, atom.id.timestamp);
        }
    }

    /**
     * Creates a new Atom with the given op.
     * @param op The operation to include with the atom.
     * @param cause The parent cause of this atom.
     */
    async create<T extends TOp>(
        op: T,
        cause: Atom<TOp> | AtomId,
        priority?: number
    ): Promise<Atom<T>> {
        let causeId: AtomId = null;
        if (cause) {
            causeId = <any>(
                (!!(<Atom<TOp>>cause).id ? (<Atom<TOp>>cause).id : cause)
            );
        }
        this._time += 1;
        const a = atom(atomId(this.site, this._time, priority), causeId, op);

        if (this._validator && this._signingKey) {
            return await this._validator.sign(this._signingKey, a);
        } else {
            return a;
        }
    }
}
