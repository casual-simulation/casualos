import { Subscription, SubscriptionLike } from 'rxjs';
import {
    bufferTime,
    filter,
    concatMap,
    flatMap as rxFlatMap,
    tap,
} from 'rxjs/operators';
import { CausalTree } from './CausalTree';
import { CausalTreeStore } from './CausalTreeStore';
import { AtomOp, atomIdToString } from './Atom';

/**
 * Listens for new atoms from the given tree and pipes them into the given store at the given ID.
 * @param id The ID that the atoms should be stored at.
 * @param tree The tree that should be continually stored.
 * @param store The store that the tree should be stored in.
 */
export function bindChangesToStore(
    id: string,
    tree: CausalTree<AtomOp, any, any>,
    store: CausalTreeStore
): SubscriptionLike {
    let sub: Subscription = new Subscription();

    sub.add(
        tree.atomsArchived
            .pipe(
                bufferTime(1000),
                filter(batch => batch.length > 0),
                rxFlatMap(batch => batch),
                concatMap(async refs => {
                    const atoms = refs.map(r => r);
                    await store.add(id, atoms, true);
                })
            )
            .subscribe(null, err => console.error(err))
    );

    sub.add(
        tree.atomAdded
            .pipe(
                bufferTime(1000),
                filter(batch => batch.length > 0),
                rxFlatMap(batch => batch),
                concatMap(async atoms => {
                    await store.add(id, atoms, false);
                    let stored = tree.export();
                    stored.weave = [];
                    await store.put(id, stored, false);
                })
            )
            .subscribe(null, err => console.error(err))
    );

    sub.add(
        tree.atomRejected
            .pipe(
                bufferTime(1000),
                filter(batch => batch.length > 0),
                rxFlatMap(batch => batch),
                rxFlatMap(batch => batch),
                tap(ref => {
                    console.warn(
                        `[CausalTreeSever] ${id}: Atom (${atomIdToString(
                            ref.atom.id
                        )}) rejected: ${ref.reason}`
                    );
                })
            )
            .subscribe(null, err => console.error(err))
    );

    return sub;
}
