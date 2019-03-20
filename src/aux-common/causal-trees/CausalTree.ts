import { AtomOp, Atom, AtomId } from "./Atom";
import { Weave } from "./Weave";
import { AtomFactory } from "./AtomFactory";
import { AtomReducer } from "./AtomReducer";
import { sortBy, unionBy, find } from "lodash";
import { SiteInfo } from "./SiteIdInfo";
import { StoredCausalTree } from "./StoredCausalTree";
import { SiteVersionInfo } from "./SiteVersionInfo";
import { PrecalculatedOp } from './PrecalculatedOp';
import { Subject } from 'rxjs';

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
    private _isBatching: boolean;
    private _batch: Atom<TOp>[];

    /**
     * Gets or sets whether the causal tree should collect garbage.
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
     * Creates a new Causal Tree with the given site ID.
     * @param tree The stored tree that this causal tree should be made from.
     * @param reducer The reducer used to convert a list of operations into a single value.
     */
    constructor(tree: StoredCausalTree<TOp>, reducer: AtomReducer<TOp, TValue, TMetadata>) {
        this._site = tree.site;
        this._knownSites = unionBy([
            this.site
        ], tree.knownSites || [], site => site.id);
        this._weave = new Weave<TOp>();
        this._factory = new AtomFactory<TOp>(this._site);
        this._reducer = reducer;
        this._value = undefined;
        this._metadata = undefined;
        this._atomAdded = new Subject<Atom<TOp>[]>();
        this._atomArchived = new Subject<Atom<TOp>[]>();
        this._isBatching = false;
        this._batch = [];
        this.garbageCollect = false;

        this.import(tree);
    }

    /**
     * Creates a root element on this tree.
     */
    root(): Atom<TOp> {
        throw new Error('Must be implemented in inheriting class');
    }

    /**
     * Adds the given atom to this Causal Tree's history.
     * @param atom The atom to add to the tree.
     */
    add<T extends TOp>(atom: Atom<T>): Atom<T> {
        if (atom.id.site !== this.site.id) {
            this.factory.updateTime(atom.id.timestamp);
        }
        const ref = this.weave.insert(atom);
        if (ref) {
            if (this._isBatching) {
                this._batch.push(ref);
            } else {
                const refs = [ref];
                if (this.garbageCollect) {
                    const removed = this.collectGarbage(refs);
                    if (removed.length > 0) {
                        this._atomArchived.next(removed);
                    }
                }
                [this._value, this._metadata] = this._calculateValue(refs);
                this._atomAdded.next(refs);
            }
        }
        return ref;
    }

    /**
     * Adds the given list of references to this causal tree's history.
     * @param refs The references to add.
     */
    addMany(refs: Atom<TOp>[]): Atom<TOp>[] {
        return this.batch(() => {
            let added: Atom<TOp>[] = [];
            for (let i = 0; i < refs.length; i++) {
                let atom = refs[i];
                if (atom) {
                    let result = this.add(atom);
                    if (result) {
                        added.push(result);
                    }
                }
            }

            return added;
        });
    }
    
    /**
     * Batches all the operations in the given function so that
     * only a single notification is sent.
     * @param func 
     */
    batch<T>(func: () => T): T {
        if (this._isBatching) {
            return func();
        }
        try {
            this._isBatching = true;
            return func();
        } finally {
            if (this._batch.length > 0) {
                if (this.garbageCollect) {
                    const removed = this.collectGarbage(this._batch);
                    if (removed.length > 0) {
                        this._atomArchived.next(removed);
                    }
                }
                [this._value, this._metadata] = this._calculateValue(this._batch);
                this._atomAdded.next(this._batch);
                this._batch = [];
            }
            this._isBatching = false;
        }
    }

    /**
     * Imports the given list of weave references into the tree.
     * The references are expected to be sorted as a valid weave and also to match
     * @param refs The references to import.
     */
    importWeave<T extends TOp>(refs: Atom<T>[]): Atom<TOp>[] {
        const newAtoms = this.weave.import(refs);
        const sortedAtoms = sortBy(newAtoms, a => a.id.timestamp);
        for (let i = 0; i < sortedAtoms.length; i++) {
            const atom = sortedAtoms[i];
            if (atom.id.site !== this.site.id || atom.id.timestamp >= this.time) {
                this.factory.updateTime(atom.id.timestamp);
            }
        }
        [this._value, this._metadata] = this._calculateValue(newAtoms);
        return newAtoms;
    }

    /**
     * Imports the given tree into this one and returns the list of atoms that were imported.
     * @param tree The tree to import.
     */
    import<T extends TOp>(tree: StoredCausalTree<T>): Atom<TOp>[] {
        if (tree.weave) {
            if (tree.formatVersion === 2) {
                return this.importWeave(tree.weave);
            } else if (typeof tree.formatVersion === 'undefined') {
                return this.importWeave(tree.weave.map(ref => ref.atom));
            } else {
                console.warn("[CausalTree] Don't know how to import tree version:", tree.formatVersion);
                return [];
            }
        }
    }

    /**
     * Exports this tree into a storable format.
     */
    export(): StoredCausalTree<TOp> {
        return {
            formatVersion: 2,
            site: this._site,
            knownSites: this.knownSites.slice(),
            weave: this.weave.atoms.slice()
        };
    }

    /**
     * Creates a new atom and adds it to the tree's history.
     * @param op The operation to store in the atom.
     * @param parent The parent atom.
     * @param priority The priority.
     */
    create<T extends TOp>(op: T, parent: Atom<TOp> | Atom<TOp> | AtomId, priority?: number): Atom<T> {
        const atom = this.factory.create(op, parent, priority);
        return this.add(atom);
    }

    /**
     * Creates a new atom from the given precalculated operation and adds it to the tree's history.
     * @param precalc The operation to create and add.
     */
    createFromPrecalculated<T extends TOp>(precalc: PrecalculatedOp<T>): Atom<T> {
        if (precalc) {
            return this.create<T>(precalc.op, <Atom<TOp>>precalc.cause, precalc.priority);
        } else {
            return null;
        }
    }

    /**
     * Creates a new atom from the given precalculated operation and adds it to the tree's history.
     * @param precalc The operation to create and add.
     */
    createManyFromPrecalculated<T extends TOp>(precalc: PrecalculatedOp<T>[]): Atom<T>[] {
        const nonNull = precalc.filter(pc => !!pc);
        return nonNull.map(pc => this.createFromPrecalculated(pc));
    }

    /**
     * Registers the given site in this tree's known sites list.
     * @param site The site. 
     */
    registerSite(site: SiteInfo) {
        let existing = find(this._knownSites, s => s.id === site.id);
        if(!existing) {
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
            version: this.weave.getVersion()
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
     * Recalculates the values associated the given references.
     * This can be used as a performance improvement to only recalculate the parts of the
     * tree's value that were affected by the additions.
     * @param refs The references that were added to the tree.
     */
    protected recalculateValues(refs: Atom<TOp>[]): void {}


    private _calculateValue(refs: Atom<TOp>[]): [TValue, TMetadata] {
        return this._reducer.eval(this._weave, refs, this._value, this._metadata);
    }
}