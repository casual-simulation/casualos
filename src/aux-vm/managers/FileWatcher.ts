import { File, PrecalculatedFile, merge } from '@casual-simulation/aux-common';
import { Subject, Observable, SubscriptionLike } from 'rxjs';
import {
    flatMap,
    filter,
    startWith,
    tap,
    takeUntil,
    first,
    endWith,
} from 'rxjs/operators';
import { values, omitBy, keys } from 'lodash';
import { StateUpdatedEvent } from './StateUpdatedEvent';
import { FileHelper } from './FileHelper';

/**
 * Defines an interface that contains information about an updated file.
 */
export interface UpdatedFileInfo {
    /**
     * The file that was updated.
     */
    file: PrecalculatedFile;

    /**
     * The tags that were updated on the file.
     */
    tags: Set<string>;
}

/**
 * Defines a class that can watch a realtime causal tree.
 */
export class FileWatcher implements SubscriptionLike {
    private _filesDiscoveredObservable: Subject<PrecalculatedFile[]>;
    private _filesRemovedObservable: Subject<string[]>;
    private _filesUpdatedObservable: Subject<PrecalculatedFile[]>;
    private _fileTagsUpdatedObservable: Subject<UpdatedFileInfo[]>;
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
     * Gets an observable that resolves whenever a file is updated.
     */
    get fileTagsUpdated(): Observable<UpdatedFileInfo[]> {
        return this._fileTagsUpdatedObservable;
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
        this._fileTagsUpdatedObservable = new Subject<UpdatedFileInfo[]>();

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
                        const tagUpdates = update.updatedFiles.map(id => {
                            let u = update.state[id];
                            let tags = u && u.tags ? keys(u.tags) : [];
                            let file = this._helper.filesState[id];
                            return {
                                file,
                                tags: new Set(tags),
                            };
                        });

                        this._filesDiscoveredObservable.next(added);
                        this._filesRemovedObservable.next(update.removedFiles);
                        this._filesUpdatedObservable.next(updated);
                        this._fileTagsUpdatedObservable.next(tagUpdates);
                    },
                    err => console.error(err)
                )
        );
    }

    /**
     * Creates an observable that resolves whenever the file with the given ID changes.
     * @param file The file ID to watch.
     */
    fileChanged(id: string): Observable<PrecalculatedFile> {
        const file = this._helper.filesState
            ? this._helper.filesState[id]
            : null;
        return this.filesUpdated.pipe(
            flatMap(files => files),
            takeUntil(
                this.filesRemoved.pipe(
                    flatMap(fileIds => fileIds),
                    first(fileId => fileId === id)
                )
            ),
            filter(u => u.id === id),
            startWith(file),
            filter(f => !!f),
            endWith(null)
        );
    }

    /**
     * Creates an observable that resolves whenever the file with the given ID changes.
     * @param id The file ID to watch.
     */
    fileTagsChanged(id: string): Observable<UpdatedFileInfo> {
        const file = this._helper.filesState
            ? this._helper.filesState[id]
            : null;
        return this.fileTagsUpdated.pipe(
            flatMap(files => files),
            takeUntil(
                this.filesRemoved.pipe(
                    flatMap(fileIds => fileIds),
                    first(fileId => fileId === id)
                )
            ),
            filter(u => u.file.id === id),
            startWith({
                file,
                tags: new Set<string>(),
            }),
            filter(f => !!f),
            endWith(null)
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
