import {
    RealtimeAuxTree,
    AuxFile,
    fileChangeObservables,
    File,
    AuxObject,
    FilesState,
    AuxState,
    UpdatedFile,
    tagsOnFile,
    PrecalculatedFilesState,
    PrecalculatedFile,
    merge,
} from '@casual-simulation/aux-common';
import {
    ReplaySubject,
    Subject,
    Observable,
    SubscriptionLike,
    BehaviorSubject,
    from,
} from 'rxjs';
import { flatMap, filter, startWith, tap } from 'rxjs/operators';
import { values, omitBy, pickBy } from 'lodash';
import { StateUpdatedEvent } from './StateUpdatedEvent';
import { FileHelper } from './FileHelper';
import { file } from '@babel/types';

/**
 * Defines a class that can watch a realtime causal tree.
 */
export class FileWatcher implements SubscriptionLike {
    private _filesDiscoveredObservable: Subject<PrecalculatedFile[]>;
    private _filesRemovedObservable: Subject<string[]>;
    private _filesUpdatedObservable: Subject<PrecalculatedFile[]>;
    private _subs: SubscriptionLike[] = [];
    private _helper: FileHelper;

    closed: boolean = false;

    /**
     * Gets an observable that resolves whenever a new file is discovered.
     * That is, it was created or added by another user.
     */
    get filesDiscovered(): Observable<PrecalculatedFile[]> {
        return this._filesDiscoveredObservable.pipe(
            startWith(values(this._helper.filesState))
        );
    }

    /**
     * Gets an observable that resolves whenever a file is removed.
     * That is, it was deleted from the working directory either by checking out a
     * branch that does not contain the file or by deleting it.
     */
    get filesRemoved(): Observable<string[]> {
        return this._filesRemovedObservable;
    }

    /**
     * Gets an observable that resolves whenever a file is updated.
     */
    get filesUpdated(): Observable<PrecalculatedFile[]> {
        return this._filesUpdatedObservable;
    }

    /**
     * Creates a new file watcher.
     * @param helper The file helper.
     * @param selection The selection manager.
     * @param filesAdded The observable that is called whenever a new file is added.
     * @param filesRemoved The observable that is called whenever a file is removed.
     * @param filesUpdated The observable that is called whenever a file is updated.
     */
    constructor(
        helper: FileHelper,
        stateUpdated: Observable<StateUpdatedEvent>
    ) {
        this._helper = helper;
        this._filesDiscoveredObservable = new Subject<PrecalculatedFile[]>();
        this._filesRemovedObservable = new Subject<string[]>();
        this._filesUpdatedObservable = new Subject<PrecalculatedFile[]>();

        this._subs.push(
            stateUpdated
                .pipe(
                    tap(update => {
                        if (this._helper.filesState) {
                            let updatedState = omitBy(
                                merge(this._helper.filesState, update.state),
                                val => val === null
                            );

                            for (let id in update.state) {
                                let fileUpdate: Partial<File> =
                                    update.state[id];
                                if (!fileUpdate) {
                                    continue;
                                }
                                let file = updatedState[id];
                                for (let tag in fileUpdate.tags) {
                                    if (file.tags[tag] === null) {
                                        delete file.tags[tag];
                                        delete file.values[tag];
                                    }
                                }
                            }

                            this._helper.filesState = updatedState;
                        } else {
                            this._helper.filesState = update.state;
                        }
                    })
                )
                .subscribe(
                    update => {
                        const added = update.addedFiles.map(
                            id => this._helper.filesState[id]
                        );
                        const updated = update.updatedFiles.map(
                            id => this._helper.filesState[id]
                        );

                        this._filesDiscoveredObservable.next(added);
                        this._filesRemovedObservable.next(update.removedFiles);
                        this._filesUpdatedObservable.next(updated);
                    },
                    err => {}
                )
        );
    }

    /**
     * Creates an observable that resolves whenever the given file changes.
     * @param file The file to watch.
     */
    fileChanged(file: PrecalculatedFile): Observable<PrecalculatedFile> {
        return this.filesUpdated.pipe(
            flatMap(files => files),
            filter(u => u.id === file.id),
            startWith(file)
        );
    }

    unsubscribe(): void {
        if (!this.closed) {
            this.closed = true;
            this._subs.forEach(s => s.unsubscribe());
            this._subs = null;
        }
    }
}
