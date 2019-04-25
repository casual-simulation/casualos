import { AtomOp, Atom, AtomId, atomIdToString, atomId } from './Atom';
import { Weave } from './Weave';
import { AtomFactory } from './AtomFactory';
import { AtomReducer } from './AtomReducer';
import { sortBy, unionBy, find, groupBy } from 'lodash';
import { SiteInfo } from './SiteIdInfo';
import { StoredCausalTree } from './StoredCausalTree';
import { SiteVersionInfo } from './SiteVersionInfo';
import { PrecalculatedOp } from './PrecalculatedOp';
import { Subject } from 'rxjs';
import { AtomValidator } from './AtomValidator';
import { PrivateCryptoKey, PublicCryptoKey } from '@casual-simulation/crypto';
import { RejectedAtom } from './RejectedAtom';
import { AddResult, mergeIntoBatch } from './AddResult';
import { AtomBatch } from './AtomBatch';
import { LoadingProgressCallback } from './LoadingProgress';

/**
 * Defines an interface that contains possible options that can be set on a causal tree.
 */
export interface CausalTreeOptions {
    /**
     * Specifies whether the causal tree should try to remove atoms that no longer affect the tree.
     * Defaults to false.
     */
    garbageCollect?: boolean;

    /**
     * The validator that should be used to validate atoms.
     */
    validator?: AtomValidator;

    /**
     * The key that should be used to sign new atoms.
     */
    signingKey?: PrivateCryptoKey;
}

/**
 * Defines a class that represents a Causal Tree.
 * That is, a conflict-free replicated data type. (CRDT)
 */
export class CausalTree<TOp extends AtomOp, TValue, TMetadata> {
    private _site: SiteInfo;
    private _weave: Weave<TOp>;
    private _factory: AtomFactory<TOp>;
    private _reducer: AtomReducer<TOp, TValue, TMetadata>;
    private _metadata: TMetadata;
    private _value: TValue;
    private _knownSites: SiteInfo[];
    private _atomAdded: Subject<Atom<TOp>[]>;
    private _atomArchived: Subject<Atom<TOp>[]>;
    private _atomRejected: Subject<RejectedAtom<TOp>[]>;
    private _isBatching: boolean;
    private _batch: Atom<TOp>[];
    private _rejected: RejectedAtom<TOp>[];
    private _validator: AtomValidator;
    private _keyMap: Map<number, PublicCryptoKey>;
    private _pendingRefs: Atom<TOp>[];
    private _dirty: boolean;

    /**
     * Gets or sets whether the causal tree should collect garbage.
     * Defaults to false.
     */
    garbageCollect: boolean;

    /**
     * Gets the site that this causal tree represents.
     */
    get site() {
        return this._site;
    }

    /**
     * Gets the most recent time that this causal tree
     * has observed.
     */
    get time() {
        return this.factory.time;
    }

    /**
     * Gets the weave stored by this tree.
     */
    get weave() {
        return this._weave;
    }

    /**
     * Gets the atom factory used by this tree.
     */
    get factory() {
        return this._factory;
    }

    /**
     * Gets the currently stored value in the tree.
     */
    get value() {
        if (this._dirty) {
            [this._value, this._metadata] = this._calculateValue(this._batch);
        }
        return this._value;
    }

    /**
     * Gets the currently stored metadata.
     */
    get metadata() {
        return this._metadata;
    }

    /**
     * Gets the list of sites that this tree knows about.
     */
    get knownSites() {
        return this._knownSites;
    }

    /**
     * Gets an observable that resolves whenever a new atom is added to this tree.
     */
    get atomAdded() {
        return this._atomAdded;
    }

    /**
     * Gets an observable that resolves whenever one or more atoms are garbage collected and should be archived.
     */
    get atomsArchived() {
        return this._atomArchived;
    }

    /**
     * Gets an observable that resolves whenever one or more atoms are rejected.
     */
    get atomRejected() {
        return this._atomRejected;
    }

    /**
     * Creates a new Causal Tree with the given site ID.
     * @param tree The stored tree that this causal tree should be made from.
     * @param reducer The reducer used to convert a list of operations into a single value.
     * @param options The options to use.
     */
    constructor(
        tree: StoredCausalTree<TOp>,
        reducer: AtomReducer<TOp, TValue, TMetadata>,
        options: CausalTreeOptions = {}
    ) {
        this._site = tree.site;
        this._knownSites = unionBy(
            [this.site],
            tree.knownSites || [],
            site => site.id
        );
        this._validator = options.validator || null;
        this._keyMap = new Map();
        this._weave = new Weave<TOp>();
        this._factory = new AtomFactory<TOp>(
            this._site,
            0,
            this._validator,
            options.signingKey
        );
        this._reducer = reducer;
        this._value = undefined;
        this._metadata = undefined;
        this._dirty = false;
        this._atomAdded = new Subject<Atom<TOp>[]>();
        this._atomArchived = new Subject<Atom<TOp>[]>();
        this._atomRejected = new Subject<RejectedAtom<TOp>[]>();
        this._isBatching = false;
        this._batch = [];
        this._rejected = [];
        this.garbageCollect = options.garbageCollect || false;

        if (
            this._validator &&
            options.signingKey &&
            (!tree.site.crypto || !tree.site.crypto.publicKey)
        ) {
            console.warn(
                `[CausalTree] Created a tree with a signing key but no public key. This might cause some remotes to reject atoms because they shouldn't be signed.`
            );
        }
    }

    /**
     * Creates a root element on this tree.
     */
    root(): Promise<AddResult<TOp>> {
        throw new Error('Must be implemented in inheriting class');
    }

    /**
     * Adds the given atom to this Causal Tree's history.
     * @param atom The atom to add to the tree.
     * @param verifySignature Whether to verify the signature on the given atom. (Default true)
     */
    async add<T extends TOp>(
        atom: Atom<T>,
        verifySignature: boolean = true
    ): Promise<AddResult<T>> {
        if (verifySignature) {
            const [rej] = await this._validate([atom]);
            if (rej) {
                if (this._isBatching) {
                    this._rejected.push(rej);
                } else {
                    this._atomRejected.next([rej]);
                }
                return {
                    added: null,
                    rejected: rej,
                };
            }
        }
        this.factory.updateTime(atom);
        let [ref, rejected] = this.weave.insert(atom);
        if (ref) {
            if (this._isBatching) {
                this._batch.push(ref);
                this._dirty = true;
            } else {
                const refs = [ref];
                this.triggerGarbageCollection(refs);
                [this._value, this._metadata] = this._calculateValue(refs);
                this._atomAdded.next(refs);
            }
        }
        if (rejected) {
            if (this._isBatching) {
                this._rejected.push(rejected);
            } else {
                this._atomRejected.next([rejected]);
            }
        }
        return {
            added: ref,
            rejected: rejected,
        };
    }

    /**
     * Adds the given list of references to this causal tree's history.
     * @param refs The references to add.
     * @param verifySignatures Whether to verify that the signatures on the atoms are valid. (Default false)
     */
    async addMany(
        refs: Atom<TOp>[],
        verifySignatures: boolean = false,
        loadingCallback?: LoadingProgressCallback
    ): Promise<AtomBatch<TOp>> {
        loadingCallback = loadingCallback || (() => {});

        if (verifySignatures) {
            loadingCallback({
                message: `Validating ${refs.length} atoms...`,
            });
            const invalid = await this._validate(refs);
            if (invalid.length > 0) {
                return {
                    added: [],
                    rejected: invalid,
                };
            }
        }
        loadingCallback({
            message: `Sorting ${refs.length} atoms...`,
        });
        const atoms = sortBy(refs, a => a.id.timestamp);
        loadingCallback({
            message: `Adding ${refs.length} atoms...`,
            progressPercent: 0,
        });
        return await this.batch(async () => {
            let added: Atom<TOp>[] = [];
            let rejected: RejectedAtom<TOp>[] = [];
            for (let i = 0; i < atoms.length; i++) {
                let atom = atoms[i];
                if (atom) {
                    let { added: result, rejected: rej } = await this.add(
                        atom,
                        verifySignatures
                    );
                    if (result) {
                        added.push(result);
                    }
                    if (rej) {
                        rejected.push(rej);
                    }
                }
                loadingCallback({
                    progressPercent: i / atoms.length,
                });
            }

            return { added, rejected };
        });
    }

    /**
     * Batches all the operations in the given function so that
     * only a single notification is sent.
     * @param func
     */
    async batch<T>(func: () => T | Promise<T>): Promise<T> {
        if (this._isBatching) {
            return await func();
        }
        try {
            this._isBatching = true;
            const result = await func();
            return result;
        } finally {
            if (this._batch.length > 0) {
                this.triggerGarbageCollection(this._batch);
                [this._value, this._metadata] = this._calculateValue(
                    this._batch
                );
                this._atomAdded.next(this._batch);
                this._batch = [];
            }
            if (this._rejected.length > 0) {
                this._atomRejected.next(this._rejected);
                this._rejected = [];
            }
            this._isBatching = false;
        }
    }

    /**
     * Imports the given list of weave references into the tree.
     * The references are expected to be sorted as a valid weave and also to match
     * @param refs The references to import.
     * @param validate Whether to validate the incoming weave.
     * @param verifySignatures Whether to verify the signatures of the incoming atoms. (Default false)
     */
    async importWeave<T extends TOp>(
        refs: Atom<T>[],
        validate: boolean = true,
        verifySignatures: boolean = false,
        loadingCallback?: LoadingProgressCallback
    ): Promise<AtomBatch<TOp>> {
        loadingCallback = loadingCallback || (() => {});

        if (validate) {
            let weave = new Weave<T>();
            loadingCallback({
                message: `Importing ${refs.length} atoms...`,
            });
            weave.import(refs);
            if (!weave.isValid()) {
                loadingCallback({
                    error: 'Imported references are not valid.',
                });
                throw new Error(
                    '[CausalTree] Imported references are not valid.'
                );
            }
        }

        if (verifySignatures) {
            loadingCallback({
                message: `Verifying ${refs.length} atoms...`,
            });
            const bad = await this._validate(refs);
            if (bad.length > 0) {
                this._atomRejected.next(bad);
                return {
                    added: [],
                    rejected: bad,
                };
            }
        }

        loadingCallback({
            message: 'Updating atom factory time...',
        });
        const [newAtoms, rejected] = this.weave.import(refs);
        const sortedAtoms = sortBy(newAtoms, a => a.id.timestamp);
        for (let i = 0; i < sortedAtoms.length; i++) {
            const atom = sortedAtoms[i];
            this.factory.updateTime(atom);
        }
        // if (!this.weave.isValid()) {
        //     throw new Error('[CausalTree] Tree became invalid after import.');
        // }
        loadingCallback({
            message: 'Running atom garbage collection...',
        });
        this.triggerGarbageCollection(newAtoms);
        // if (!this.weave.isValid()) {
        //     throw new Error('[CausalTree] Tree became invalid after garbage collection.');
        // }
        [this._value, this._metadata] = this._calculateValue(newAtoms);
        if (rejected) {
            this._atomRejected.next(rejected);
        }
        return {
            added: newAtoms,
            rejected: rejected,
        };
    }

    /**
     * Imports the given tree into this one and returns the list of atoms that were imported.
     * @param tree The tree to import.
     * @param verifySignatures Whether to verify the signatures of the incoming atoms. (Default false)
     */
    async import<T extends TOp>(
        tree: StoredCausalTree<T>,
        verifySignatures: boolean = false,
        loadingCallback?: LoadingProgressCallback
    ): Promise<AtomBatch<TOp>> {
        loadingCallback = loadingCallback || (() => {});

        if (tree.knownSites) {
            tree.knownSites.forEach(s => {
                this.registerSite(s);
            });
        }

        let added: AtomBatch<TOp>;
        if (tree.weave) {
            if (tree.formatVersion === 2) {
                added = await this.importWeave(
                    tree.weave,
                    true,
                    verifySignatures,
                    loadingCallback
                );
            } else if (tree.formatVersion === 3) {
                if (tree.ordered) {
                    added = await this.importWeave(
                        tree.weave,
                        true,
                        verifySignatures,
                        loadingCallback
                    );
                } else {
                    added = await this.addMany(
                        tree.weave,
                        verifySignatures,
                        loadingCallback
                    );
                }
            } else if (typeof tree.formatVersion === 'undefined') {
                added = await this.importWeave(
                    tree.weave.map(ref => ref.atom),
                    true,
                    verifySignatures,
                    loadingCallback
                );
            } else {
                console.warn(
                    "[CausalTree] Don't know how to import tree version:",
                    tree.formatVersion
                );
                added = {
                    added: [],
                    rejected: [],
                };
            }
        }

        return added;
    }

    /**
     * Exports this tree into a storable format.
     */
    export(): StoredCausalTree<TOp> {
        return {
            formatVersion: 3,
            site: this._site,
            ordered: true,
            knownSites: this.knownSites.slice(),
            weave: this.weave.atoms.slice(),
        };
    }

    /**
     * Creates a new atom and adds it to the tree's history.
     * @param op The operation to store in the atom.
     * @param parent The parent atom.
     * @param priority The priority.
     */
    async create<T extends TOp>(
        op: T,
        parent: Atom<TOp> | Atom<TOp> | AtomId,
        priority?: number
    ): Promise<AddResult<T>> {
        const atom = await this.factory.create(op, parent, priority);
        return await this.add(atom);
    }

    /**
     * Creates a new atom from the given precalculated operation and adds it to the tree's history.
     * @param precalc The operation to create and add.
     */
    async createFromPrecalculated<T extends TOp>(
        precalc: PrecalculatedOp<T>
    ): Promise<AddResult<T>> {
        if (precalc) {
            return await this.create<T>(
                precalc.op,
                <Atom<TOp>>precalc.cause,
                precalc.priority
            );
        } else {
            return null;
        }
    }

    /**
     * Creates a new atom from the given precalculated operation and adds it to the tree's history.
     * @param precalc The operation to create and add.
     */
    async createManyFromPrecalculated<T extends TOp>(
        precalc: PrecalculatedOp<T>[]
    ): Promise<AtomBatch<T>> {
        const nonNull = precalc.filter(pc => !!pc);
        const promises = nonNull.map(pc => this.createFromPrecalculated(pc));
        let results = await Promise.all(promises);
        return mergeIntoBatch(results);
    }

    /**
     * Registers the given site in this tree's known sites list.
     * @param site The site.
     */
    registerSite(site: SiteInfo) {
        let existing = find(this._knownSites, s => s.id === site.id);
        if (!existing) {
            this._knownSites.push(site);
        }
    }

    /**
     * Gets the version of the tree.
     */
    getVersion(): SiteVersionInfo {
        return {
            site: this.site,
            knownSites: this.knownSites,
            version: this.weave.getVersion(),
        };
    }

    /**
     * Forks the given causal tree and returns a new tree that contains the same state.
     * Note that this method does not copy over configuration options such as collectGarbage.
     * Also note that this method should be overridden in child classes to ensure that the proper type
     * is being created.
     * @param type The type of the tree that is being forked.
     * @param tree The tree to fork.
     */
    fork(): CausalTree<TOp, TValue, TMetadata> {
        const stored = this.export();
        return new CausalTree<TOp, TValue, TMetadata>(stored, this._reducer);
    }

    /**
     * Performs garbage collection of the tree's weave after a set of atoms were added to the tree.
     * Returns the references that were removed from the tree.
     * @param refs The weave references that were added to the tree.
     */
    protected collectGarbage(refs: Atom<TOp>[]): Atom<TOp>[] {
        return [];
    }

    /**
     * Triggers a round of garbage collection on the given atoms.
     * @param atoms The atoms to garbage collect.
     */
    protected triggerGarbageCollection(atoms: Atom<TOp>[]): Atom<TOp>[] {
        if (this.garbageCollect) {
            const removed = this.collectGarbage(atoms);
            if (removed.length > 0) {
                this._atomArchived.next(removed);
            }
            return removed;
        }
        return [];
    }

    /**
     * Recalculates the values associated the given references.
     * This can be used as a performance improvement to only recalculate the parts of the
     * tree's value that were affected by the additions.
     * @param refs The references that were added to the tree.
     */
    protected recalculateValues(refs: Atom<TOp>[]): void {}

    /**
     * Ensures that the given atom is valid.
     * @param atom The atom to validate.
     */
    private async _validate<T extends TOp>(
        atoms: Atom<T>[]
    ): Promise<RejectedAtom<T>[]> {
        const grouped = groupBy(atoms, a => a.id.site);
        const sites = Object.keys(grouped);
        let rejected: RejectedAtom<T>[] = [];
        for (let i = 0; i < sites.length; i++) {
            const site = sites[i];
            const siteAtoms = grouped[site];
            const key = await this._getPublicKey(parseInt(site));
            const first = siteAtoms[0];
            if (key) {
                const valid = await this._validator.verifyBatch(key, siteAtoms);
                const rej: RejectedAtom<T>[] = valid
                    .map((v, i) => {
                        if (!v) {
                            return <RejectedAtom<T>>{
                                atom: siteAtoms[i],
                                reason: 'signature_failed',
                            };
                        }
                        return null;
                    })
                    .filter(a => a);
                rejected.push(...rej);
            } else if (
                !key &&
                !!first.signature &&
                this._validator &&
                this._validator.impl.supported()
            ) {
                rejected.push({
                    atom: first,
                    reason: 'no_public_key',
                });
            }
        }
        return rejected;
    }

    /**
     * Gets the public key for the given site.
     * If the site does not have a public key, then null is returned.
     * @param siteId The site that the public key should be retrieved for.
     */
    private async _getPublicKey(siteId: number): Promise<PublicCryptoKey> {
        let key = this._keyMap.get(siteId);
        if (!key) {
            const site = find(this.knownSites, s => s.id === siteId);
            if (
                site &&
                site.crypto &&
                site.crypto.publicKey &&
                this._validator &&
                this._validator.impl.supported()
            ) {
                key = await this._validator.impl.importPublicKey(
                    site.crypto.publicKey
                );
            }

            if (key) {
                this._keyMap.set(siteId, key);
            }
        }
        return key;
    }

    private _calculateValue(refs: Atom<TOp>[]): [TValue, TMetadata] {
        this._dirty = false;
        return this._reducer.eval(
            this._weave,
            refs,
            this._value,
            this._metadata
        );
    }
}
