import { FileHelper } from '@casual-simulation/aux-vm';
import {
    File,
    doFilesAppearEqual,
    isDiff,
    getContexts,
    isWellKnownOrContext,
    PrecalculatedFile,
    createPrecalculatedFile,
    FileTags,
} from '@casual-simulation/aux-common';
import { Subject, Observable } from 'rxjs';

/**
 * Defines a class that helps manage recent files.
 */
export class RecentFilesManager {
    private _helper: FileHelper;
    private _onUpdated: Subject<void>;
    private _selectedRecentFile: PrecalculatedFile = null;

    /**
     * The files that have been stored in the recent files manager.
     */
    files: PrecalculatedFile[];

    /**
     * The maximum number of files that the recents list can contain.
     */
    maxNumberOfFiles: number = 1;

    /**
     * Gets an observable that resolves whenever the files list has been updated.
     */
    get onUpdated(): Observable<void> {
        return this._onUpdated;
    }

    /**
     * Gets the file that was selected from the recents list.
     */
    get selectedRecentFile() {
        return this._selectedRecentFile;
    }

    /**
     * Sets the file that was selected from the recents list.
     */
    set selectedRecentFile(file: PrecalculatedFile) {
        this._selectedRecentFile = file;
        this._onUpdated.next();
    }

    /**
     * Creates a new RecentFilesManager.
     * @param helper The file helper.
     */
    constructor(helper: FileHelper) {
        this._helper = helper;
        this._onUpdated = new Subject<void>();
        this.files = [createPrecalculatedFile('empty')];
    }

    /**
     * Adds a diffball that represents the given file ID, tag, and value.
     * @param fileId The ID of the file that the diff represents.
     * @param tag The tag that the diff contains.
     * @param value The value that the diff contains.
     */
    addTagDiff(fileId: string, tag: string, value: any) {
        this._cleanFiles(fileId);
        let tags = {
            [tag]: value,
            'aux.mod': true,
            'aux.mod.mergeTags': [tag],
        };
        this.files.unshift({
            id: fileId,
            precalculated: true,
            tags: tags,
            values: tags,
        });
        this._trimList();
        this._updateSelectedRecentFile();
        this._onUpdated.next();
    }

    /**
     * Adds the given file to the recents list.
     * @param file The file to add.
     * @param updateTags Whether to update the diff tags.
     */
    addFileDiff(file: File, updateTags: boolean = false) {
        const calc = this._helper.createContext();
        const contexts = getContexts(calc);
        let id: string;
        if (isDiff(null, file) && file.id.indexOf('mod-') === 0) {
            id = file.id;
        } else {
            id = `mod-${file.id}`;
        }
        this._cleanFiles(id, file);

        let {
            'aux.mod': diff,
            'aux.mod.mergeTags': modTags,
            ...others
        } = file.tags;

        let tagsObj: FileTags = {};
        let diffTags: string[] = [];
        if (updateTags || !modTags) {
            for (let tag in others) {
                if (!isWellKnownOrContext(tag, contexts)) {
                    tagsObj[tag] = others[tag];
                    diffTags.push(tag);
                }
            }
        } else {
            for (let tag of <string[]>modTags) {
                tagsObj[tag] = file.tags[tag];
                diffTags.push(tag);
            }
        }

        // let diffTags: string[] =
        //     updateTags || !modTags
        //         ? keys(others).filter(t => !isWellKnownOrContext(t, contexts))
        //         : <string[]>modTags;

        let tags =
            diffTags.length > 0
                ? {
                      'aux.mod': true,
                      'aux.mod.mergeTags': diffTags,
                      ...tagsObj,
                  }
                : {};
        const f =
            diffTags.length > 0
                ? {
                      id: id,
                      precalculated: true as const,
                      tags: tags,
                      values: tags,
                  }
                : createPrecalculatedFile('empty');
        this.files.unshift(f);
        this._trimList();
        this._updateSelectedRecentFile();
        this._onUpdated.next();
    }

    private _updateSelectedRecentFile() {
        if (this.selectedRecentFile) {
            let file = this.files.find(
                f => f.id === this.selectedRecentFile.id
            );
            this.selectedRecentFile = file || null;
        }
    }

    /**
     * Clears the files list.
     */
    clear() {
        this.files = [createPrecalculatedFile('empty')];
        this._onUpdated.next();
    }

    private _cleanFiles(fileId: string, file?: File) {
        for (let i = this.files.length - 1; i >= 0; i--) {
            let f = this.files[i];

            if (f.id === fileId || (file && doFilesAppearEqual(file, f))) {
                this.files.splice(i, 1);
            }
        }
    }

    private _trimList() {
        if (this.files.length > this.maxNumberOfFiles) {
            this.files.length = this.maxNumberOfFiles;
        }
    }
}
