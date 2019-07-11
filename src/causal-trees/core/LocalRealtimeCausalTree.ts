import {
    RealtimeCausalTree,
    RealtimeCausalTreeOptions,
} from './RealtimeCausalTree';
import { CausalTree } from './CausalTree';
import { AtomOp, Atom } from './Atom';
import { Observable, Subject, SubscriptionLike, never } from 'rxjs';
import { RejectedAtom } from './RejectedAtom';
import { LoadingProgressCallback } from './LoadingProgress';
import { SiteVersionInfo } from './SiteVersionInfo';

export class LocalRealtimeCausalTree<TTree extends CausalTree<AtomOp, any, any>>
    implements RealtimeCausalTree<TTree> {
    private _updated: Subject<Atom<AtomOp>[]>;
    private _rejected: Subject<RejectedAtom<AtomOp>[]>;
    private _subs: SubscriptionLike[];

    tree: TTree;

    get onUpdated(): Observable<Atom<AtomOp>[]> {
        return this._updated;
    }

    onError: Observable<any>;

    get onRejected(): Observable<RejectedAtom<AtomOp>[]> {
        return this._rejected;
    }

    constructor(tree: TTree, options?: RealtimeCausalTreeOptions) {
        this.tree = tree;
        this._subs = [];
        this._updated = new Subject<Atom<AtomOp>[]>();
        this._rejected = new Subject<RejectedAtom<AtomOp>[]>();
        this.onError = never();
    }

    async init(loadingCallback?: LoadingProgressCallback): Promise<void> {
        this._subs.push(
            this.tree.atomAdded.subscribe(this._updated),
            this.tree.atomRejected.subscribe(this._rejected)
        );
    }

    getVersion(): SiteVersionInfo {
        return this.tree.getVersion();
    }

    unsubscribe(): void {
        if (this.closed) {
            return;
        }
        this.closed = true;
        this.tree = null;
        this._updated.unsubscribe();
        this._updated = null;
        this._rejected.unsubscribe();
        this._rejected = null;
        this._subs.forEach(s => s.unsubscribe());
        this._subs = [];
    }

    closed: boolean;
}
