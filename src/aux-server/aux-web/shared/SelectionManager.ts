import { FileHelper } from "./FileHelper";
import { AuxObject, getSelectionMode, selectionIdForUser, updateUserSelection, toggleFileSelection, filterFilesBySelection, SelectionMode } from "@yeti-cgi/aux-common";

/**
 * Defines a class that is able to manage selections for users.
 */
export class SelectionManager {
    private _helper: FileHelper;

    /**
     * Creates a new object that is able to manage selections for a user.
     * @param helper The file helper to use.
     */
    constructor(helper: FileHelper) {
        this._helper = helper;
    }

    /**
     * Selects the given file for the current user.
     * @param file The file to select.
     */
    async selectFile(file: AuxObject) {
        await this._selectFileForUser(file, this._helper.userFile);
    }

    /**
     * Clears the selection for the current user.
     */
    async clearSelection() {
        await this._clearSelectionForUser(this._helper.userFile);
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
                }
            });
        }
    }

    /**
     * Gets a list of files that the given user has selected.
     * @param user The file of the user.
     */
    getSelectedFilesForUser(user: AuxObject) {
        return filterFilesBySelection(this._helper.objects, user.tags._selection);
    }

    /**
     * Clears the selection that the given user has.
     * @param user The file for the user to clear the selection of.
     */
    private async _clearSelectionForUser(user: AuxObject) {
        console.log('[SelectionManager] Clear selection for', user.id);
        const update = updateUserSelection(null, null);
        await this._helper.updateFile(user, update);
    }

    private async _selectFileForUser(file: AuxObject, user: AuxObject) {
        console.log('[SelectionManager] Select File:', file.id);

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
            const selection = user.tags._selection === file.id ? null : file.id;
            await this._helper.updateFile(user, {
                tags: {
                    _selection: selection
                }
            });
        }
    }
}