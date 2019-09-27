import {
    Subject,
    Observable,
    BehaviorSubject,
    merge,
    from,
    SubscriptionLike,
} from 'rxjs';
import { flatMap, tap, withLatestFrom } from 'rxjs/operators';
import { BotHelper, FileWatcher } from '@casual-simulation/aux-vm';
import SelectionManager from './SelectionManager';
import {
    isBot,
    PrecalculatedBot,
    isPrecalculated,
    isExistingFile,
    createPrecalculatedBot,
} from '@casual-simulation/aux-common';
import { RecentFilesManager } from './RecentFilesManager';

/**
 * Defines a class that manages the file panel.
 */
export class FilePanelManager implements SubscriptionLike {
    private _helper: BotHelper;
    private _watcher: FileWatcher;
    private _selection: SelectionManager;
    private _recent: RecentFilesManager;

    private _isOpen: boolean = false;
    private _restrictVis: boolean = true;
    private _openChanged: BehaviorSubject<boolean>;
    private _visChanged: BehaviorSubject<boolean>;

    private _changedOnDrag: boolean = false;

    private _filesUpdated: BehaviorSubject<FilesUpdatedEvent>;

    private _search: string = '';
    private _searchUpdated: Subject<string>;

    private _subs: SubscriptionLike[] = [];
    closed: boolean = false;

    newDiff: boolean = false;

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
     * Gets whether the file panel has open set to false on drag.
     */
    hideOnDrag(value: boolean) {
        if (value) {
            if (this._isOpen) {
                this._changedOnDrag = true;
                this.isOpen = false;
            }
        } else {
            if (this._changedOnDrag) {
                this.isOpen = true;
            }

            this._changedOnDrag = false;
        }
    }

    /**
     * Gets whether the file panel is visible overriding the isOpen check
     */
    restrictVisible(value: boolean) {
        this._restrictVis = value;
        this._visChanged.next(this._restrictVis);
    }

    /**
     * Makes sure the sheets is open when it needs to be on reselecting
     */
    keepSheetsOpen() {
        this.isOpen = true;
    }

    /**
     * Gets an observable that resolves when the file panel is opened or closed.
     */
    get isOpenChanged(): Observable<boolean> {
        return this._openChanged;
    }

    /**
     * Gets an observable that resolves when the  closed.
     */
    get isVisChanged(): Observable<boolean> {
        return this._visChanged;
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
        helper: BotHelper,
        selection: SelectionManager,
        recent: RecentFilesManager
    ) {
        this._watcher = watcher;
        this._helper = helper;
        this._selection = selection;
        this._recent = recent;
        this._openChanged = new BehaviorSubject<boolean>(this._isOpen);
        this._visChanged = new BehaviorSubject<boolean>(this._restrictVis);
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
                                if (this.newDiff) {
                                    this.newDiff = false;
                                    this.isOpen = false;
                                } else {
                                    this.isOpen = true;
                                }
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
            this._watcher.filesDiscovered,
            this._watcher.filesUpdated,
            this._watcher.filesRemoved,
            this._recent.onUpdated,
            this._searchUpdated
        );
        return allFilesSelectedUpdatedAddedAndRemoved.pipe(
            flatMap(async () => {
                if (this._search) {
                    const results = await this._helper.search(this.search);
                    const value = results.result;

                    // Do some cleanup on the results.
                    let files: PrecalculatedBot[] = [];
                    if (value) {
                        if (Array.isArray(value) && value.every(isBot)) {
                            files = value;
                        } else if (isBot(value) && isPrecalculated(value)) {
                            // Wrap a single file into a list so it is easier to display
                            files = [<PrecalculatedBot>value];
                        } else if (isBot(value) && isExistingFile(value)) {
                            files = [
                                createPrecalculatedBot(
                                    value.id,
                                    value.tags,
                                    value.tags
                                ),
                            ];
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
                    const file = this._recent.selectedRecentFile;
                    return {
                        searchResult: null,
                        files: [file],
                        isDiff: true,
                        isSearch: false,
                    };
                }

                let selectedFiles = this._selection.getSelectedFilesForUser(
                    this._helper.userFile
                );

                if (selectedFiles.length === 0) {
                    if (!this.newDiff) {
                        this.newDiff = true;
                    }

                    const file = this._recent.files[0];
                    return {
                        searchResult: null,
                        files: [file],
                        isDiff: true,
                        isSearch: false,
                    };
                } else {
                    this.newDiff = false;
                    return {
                        searchResult: null,
                        files: selectedFiles,
                        isDiff: false,
                        isSearch: false,
                    };
                }
            })
        );
    }
}

export interface FilesUpdatedEvent {
    files: PrecalculatedBot[];
    searchResult: any;
    isDiff: boolean;
    isSearch: boolean;
}
