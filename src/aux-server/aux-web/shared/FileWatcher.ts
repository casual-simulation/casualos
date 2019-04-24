import {
    RealtimeAuxTree,
    AuxFile,
    fileChangeObservables,
} from '@casual-simulation/aux-common';
import { FileHelper } from './FileHelper';
import {
    ReplaySubject,
    Subject,
    Observable,
    SubscriptionLike,
    BehaviorSubject,
    merge,
    from,
} from 'rxjs';
import { map, flatMap } from 'rxjs/operators';
import SelectionManager from './SelectionManager';

/**
 * Defines an event that occurs when the current user's selected files have been updated.
 */
export interface SelectedFilesUpdatedEvent {
    files: AuxFile[];
}

/**
 * Defines a class that can watch a realtime causal tree.
 */
export default class FileWatcher implements SubscriptionLike {
    private _filesDiscoveredObservable: ReplaySubject<AuxFile[]>;
    private _filesRemovedObservable: ReplaySubject<string[]>;
    private _filesUpdatedObservable: Subject<AuxFile[]>;
    private _selectedFilesUpdated: BehaviorSubject<SelectedFilesUpdatedEvent>;
    private _helper: FileHelper;
    private _selection: SelectionManager;
    private _subs: SubscriptionLike[] = [];

    closed: boolean = false;

    /**
     * Gets an observable that resolves whenever a new file is discovered.
     * That is, it was created or added by another user.
     */
    get filesDiscovered(): Observable<AuxFile[]> {
        return this._filesDiscoveredObservable;
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
    get filesUpdated(): Observable<AuxFile[]> {
        return this._filesUpdatedObservable;
    }

    /**
     * Gets an observable that resolves whenever the list of selected files is updated.
     */
    get selectedFilesUpdated(): Observable<SelectedFilesUpdatedEvent> {
        return this._selectedFilesUpdated;
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
        selection: SelectionManager,
        filesAdded: Observable<AuxFile[]>,
        filesRemoved: Observable<string[]>,
        filesUpdated: Observable<AuxFile[]>
    ) {
        this._filesDiscoveredObservable = new ReplaySubject<AuxFile[]>();
        this._filesRemovedObservable = new ReplaySubject<string[]>();
        this._filesUpdatedObservable = new Subject<AuxFile[]>();
        this._selectedFilesUpdated = new BehaviorSubject<
            SelectedFilesUpdatedEvent
        >({ files: [] });
        this._helper = helper;
        this._selection = selection;

        const allSelectedFilesUpdated = this._allSelectedFilesUpdated(
            filesAdded,
            filesUpdated,
            filesRemoved
        );

        this._subs.push(
            filesAdded.subscribe(this._filesDiscoveredObservable),
            filesRemoved.subscribe(this._filesRemovedObservable),
            filesUpdated.subscribe(this._filesUpdatedObservable),
            allSelectedFilesUpdated.subscribe(this._selectedFilesUpdated)
        );
    }

    private _allSelectedFilesUpdated(
        filesAdded: Observable<AuxFile[]>,
        filesUpdated: Observable<AuxFile[]>,
        filesRemoved: Observable<string[]>
    ) {
        const alreadySelected = this._selection.getSelectedFilesForUser(
            this._helper.userFile
        );
        const alreadySelectedObservable = from(alreadySelected);
        const allFilesSelected = alreadySelectedObservable;
        const allFilesSelectedUpdatedAddedAndRemoved = merge(
            allFilesSelected,
            filesAdded.pipe(
                flatMap(files => files),
                map(f => f.id)
            ),
            filesUpdated.pipe(
                flatMap(files => files),
                map(f => f.id)
            ),
            filesRemoved
        );
        return allFilesSelectedUpdatedAddedAndRemoved.pipe(
            map(() => {
                const selectedFiles = this._selection.getSelectedFilesForUser(
                    this._helper.userFile
                );
                return { files: selectedFiles };
            })
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
