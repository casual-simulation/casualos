import { FileHelper } from './FileHelper';
import {
    AuxObject,
    getSelectionMode,
    selectionIdForUser,
    updateUserSelection,
    toggleFileSelection,
    filterFilesBySelection,
    SelectionMode,
    newSelectionId,
    FileEvent,
    updateFile,
    fileUpdated,
} from '@casual-simulation/aux-common';
import { Subject, Observable } from 'rxjs';

/**
 * Defines a class that is able to manage selections for users.
 */
export default class SelectionManager {
    private static readonly _debug = false;
    private _helper: FileHelper;

    private _userChangedSelection: Subject<void>;

    /**
     * Gets an observable that resolves whenever the user takes an action to change the selection.
     */
    get userChangedSelection(): Observable<void> {
        return this._userChangedSelection;
    }

    /**
     * Creates a new object that is able to manage selections for a user.
     * @param helper The file helper to use.
     */
    constructor(helper: FileHelper) {
        this._helper = helper;
        this._userChangedSelection = new Subject<void>();
    }

    /**
     * Gets the selection mode that the current user is in.
     */
    get mode() {
        return getSelectionMode(this._helper.userFile);
    }

    /**
     * Selects the given file for the current user.
     * @param file The file to select.
     * @param multiSelect Whether to put the user into multi-select mode. (Default false)
     */
    async selectFile(file: AuxObject, multiSelect: boolean = false) {
        await this._selectFileForUser(file, this._helper.userFile, multiSelect);
    }

    /**
     * Sets the list of files that the user should have selected.
     * @param files The files that should be selected.
     */
    async setSelectedFiles(files: AuxObject[]) {
        const newId = newSelectionId();

        await this._helper.transaction(
            fileUpdated(this._helper.userFile.id, {
                tags: {
                    ['aux._selection']: newId,
                    ['aux._selectionMode']: 'multi',
                },
            }),
            ...files.map(f =>
                fileUpdated(f.id, {
                    tags: {
                        [newId]: true,
                    },
                })
            )
        );

        this._userChangedSelection.next();
    }

    /**
     * Clears the selection for the current user.
     */
    async clearSelection() {
        await this._clearSelectionForUser(this._helper.userFile);
        this._userChangedSelection.next();
    }

    /**
     * Sets the selection mode for the current user.
     * @param mode The mode.
     */
    async setMode(mode: SelectionMode) {
        const currentMode = getSelectionMode(this._helper.userFile);
        if (currentMode !== mode) {
            return this._helper.updateFile(this._helper.userFile, {
                tags: {
                    'aux._selectionMode': mode,
                },
            });
        }
    }

    /**
     * Gets a list of files that the given user has selected.
     * @param user The file of the user.
     */
    getSelectedFilesForUser(user: AuxObject) {
        return filterFilesBySelection(
            this._helper.objects,
            user.tags['aux._selection']
        );
    }

    /**
     * Clears the selection that the given user has.
     * @param user The file for the user to clear the selection of.
     */
    private async _clearSelectionForUser(user: AuxObject) {
        if (SelectionManager._debug) {
            console.log('[SelectionManager] Clear selection for', user.id);
        }
        const update = updateUserSelection(null, null);
        await this._helper.updateFile(user, {
            tags: {
                ...update.tags,
                'aux._selectionMode': 'single',
            },
        });
    }

    private async _selectFileForUser(
        file: AuxObject,
        user: AuxObject,
        multiSelect: boolean
    ) {
        if (SelectionManager._debug) {
            console.log('[SelectionManager] Select File:', file.id);
        }

        const mode = getSelectionMode(user);
        if (mode === 'multi') {
            const { id, newId } = selectionIdForUser(user);
            if (newId) {
                const update = updateUserSelection(newId, file.id);
                await this._helper.updateFile(user, update);
            }
            if (id) {
                const update = toggleFileSelection(file, id, user.id);
                await this._helper.updateFile(file, update);
            }
        } else {
            if (multiSelect) {
                const newId = newSelectionId();
                const current = user.tags['aux._selection'];
                const update = updateUserSelection(newId, file.id);
                await this._helper.updateFile(user, {
                    tags: {
                        ...update.tags,
                        ['aux._selectionMode']: 'multi',
                    },
                });

                if (current) {
                    const currentFile = this._helper.filesState[current];
                    if (currentFile) {
                        await this._helper.updateFile(currentFile, {
                            tags: {
                                [newId]: true,
                            },
                        });
                    }
                }

                await this._helper.updateFile(file, {
                    tags: {
                        [newId]: true,
                    },
                });
            } else {
                const selection =
                    user.tags['aux._selection'] === file.id ? null : file.id;
                const update = updateUserSelection(selection, file.id);
                await this._helper.updateFile(user, update);
                await this._helper.updateFile(file, { tags: {} });
            }
        }

        this._userChangedSelection.next();
    }
}
