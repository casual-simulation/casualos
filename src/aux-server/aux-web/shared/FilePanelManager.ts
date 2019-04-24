import {
    Subject,
    Observable,
    BehaviorSubject,
    merge,
    from,
    SubscriptionLike,
} from 'rxjs';
import { map, flatMap, tap, withLatestFrom, startWith } from 'rxjs/operators';
import FileWatcher from './FIleWatcher';
import { FileHelper } from './FileHelper';
import SelectionManager from './SelectionManager';
import {
    AuxFile,
    File,
    searchFileState,
    SandboxResult,
    isFile,
} from '@casual-simulation/aux-common';
import { RecentFilesManager } from './RecentFilesManager';

/**
 * Defines a class that manages the file panel.
 */
export default class FilePanelManager implements SubscriptionLike {
    private _helper: FileHelper;
    private _watcher: FileWatcher;
    private _selection: SelectionManager;
    private _recent: RecentFilesManager;

    private _isOpen: boolean = false;
    private _openChanged: BehaviorSubject<boolean>;

    private _filesUpdated: BehaviorSubject<FilesUpdatedEvent>;

    private _search: string = '';
    private _searchUpdated: Subject<string>;

    private _subs: SubscriptionLike[] = [];
    closed: boolean = false;

    /**
     * Gets the current search phrase.
     */
    get search() {
        return this._search;
    }

    /**
     * Sets the current search phrase.
     */
    set search(value: string) {
        if (value !== this._search) {
            this._search = value;
            this._searchUpdated.next(this._search);
        }
    }

    /**
     * Gets whether the file panel is open.
     */
    get isOpen() {
        return this._isOpen;
    }

    /**
     * Sets whether the file panel is open.
     */
    set isOpen(value: boolean) {
        if (value !== this.isOpen) {
            this._isOpen = value;
            this._openChanged.next(this._isOpen);
        }
    }

    /**
     * Gets an observable that resolves when the file panel is opened or closed.
     */
    get isOpenChanged(): Observable<boolean> {
        return this._openChanged;
    }

    /**
     * Gets an observable that resolves whenever the list of selected files is updated.
     */
    get filesUpdated(): Observable<FilesUpdatedEvent> {
        return this._filesUpdated;
    }

    /**
     * Gets an observable that resolves whenever the search text is changed.
     */
    get searchUpdated(): Observable<string> {
        return this._searchUpdated;
    }

    /**
     * Creates a new file panel manager.
     * @param watcher The file watcher to use.
     * @param helper The file helper to use.
     * @param selection The selection manager to use.
     * @param recent The recent files manager to use.
     */
    constructor(
        watcher: FileWatcher,
        helper: FileHelper,
        selection: SelectionManager,
        recent: RecentFilesManager
    ) {
        this._watcher = watcher;
        this._helper = helper;
        this._selection = selection;
        this._recent = recent;
        this._openChanged = new BehaviorSubject<boolean>(this._isOpen);
        this._searchUpdated = new Subject<string>();
        this._filesUpdated = new BehaviorSubject<FilesUpdatedEvent>({
            files: [],
            searchResult: null,
            isDiff: false,
            isSearch: false,
        });

        this._subs.push(
            this._selection.userChangedSelection
                .pipe(
                    withLatestFrom(this._filesUpdated),
                    tap(([, e]) => {
                        if (this._selection.mode === 'single') {
                            if (e.files.length > 0) {
                                this.isOpen = true;
                            } else if (!e.isSearch) {
                                this.isOpen = false;
                            }
                        }
                    })
                )
                .subscribe(),
            this._calculateFilesUpdated().subscribe(this._filesUpdated)
        );
    }

    /**
     * Toggles whether the file panel is open or closed.
     */
    toggleOpen() {
        this.isOpen = !this.isOpen;
    }

    unsubscribe(): void {
        if (!this.closed) {
            this.closed = true;
            this._subs.forEach(s => s.unsubscribe());
            this._subs = null;
        }
    }

    private _calculateFilesUpdated(): Observable<FilesUpdatedEvent> {
        const alreadySelected = this._selection.getSelectedFilesForUser(
            this._helper.userFile
        );
        const alreadySelectedObservable = from(alreadySelected);
        const allFilesSelected = alreadySelectedObservable;
        const allFilesSelectedUpdatedAddedAndRemoved = merge(
            allFilesSelected,
            this._watcher.filesDiscovered.pipe(
                flatMap(files => files),
                map(f => f.id)
            ),
            this._watcher.filesUpdated.pipe(
                flatMap(files => files),
                map(f => f.id)
            ),
            this._watcher.filesRemoved,
            this._recent.onUpdated,
            this._searchUpdated
        );
        return allFilesSelectedUpdatedAddedAndRemoved.pipe(
            map(() => {
                if (this._search) {
                    const results = searchFileState(
                        this.search,
                        this._helper.filesState
                    );

                    const value = results.result;

                    // Do some cleanup on the results.
                    let files: AuxFile[] = [];
                    if (value) {
                        if (Array.isArray(value) && value.every(isFile)) {
                            files = value;
                        } else if (isFile(value)) {
                            // Wrap a single file into a list so it is easier to display
                            files = [value];
                        }
                    }

                    return {
                        searchResult: value,
                        files: files,
                        isDiff: false,
                        isSearch: true,
                    };
                }
                if (this._recent.selectedRecentFile) {
                    return {
                        searchResult: null,
                        files: [<AuxFile>this._recent.selectedRecentFile],
                        isDiff: true,
                        isSearch: false,
                    };
                }
                return {
                    searchResult: null,
                    files: this._selection.getSelectedFilesForUser(
                        this._helper.userFile
                    ),
                    isDiff: false,
                    isSearch: false,
                };
            })
        );
    }
}

export interface FilesUpdatedEvent {
    files: AuxFile[];
    searchResult: any;
    isDiff: boolean;
    isSearch: boolean;
}
