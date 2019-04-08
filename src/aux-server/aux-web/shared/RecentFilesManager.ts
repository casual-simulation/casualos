import { FileHelper } from "./FileHelper";
import { File, doFilesAppearEqual } from '@yeti-cgi/aux-common';
import { Subject, Observable } from 'rxjs';

/**
 * Defines a class that helps manage recent files.
 */
export class RecentFilesManager {
    private _helper: FileHelper;
    private _onUpdated: Subject<void>;
    
    /**
     * The files that have been stored in the recent files manager.
     */
    files: File[];

    /**
     * The maximum number of files that the recents list can contain.
     */
    maxNumberOfFiles: number = 5;

    /**
     * Gets an observable that resolves whenever the files list has been updated.
     */
    get onUpdated(): Observable<void> {
        return this._onUpdated;
    }

    /**
     * Creates a new RecentFilesManager.
     * @param helper The file helper.
     */
    constructor(helper: FileHelper) {
        this._helper = helper;
        this._onUpdated = new Subject<void>();
        this.files = [];
    }

    /**
     * Adds a diffball that represents the given file ID, tag, and value.
     * @param fileId The ID of the file that the diff represents.
     * @param tag The tag that the diff contains.
     * @param value The value that the diff contains.
     */
    addTagDiff(fileId: string, tag: string, value: any) {
        this._cleanFiles(fileId);
        this.files.unshift({
            id: fileId,
            tags: {
                [tag]: value,
                'aux._diff': true,
                'aux._diffTags': [tag]
            }
        });
        this._trimList();
        this._onUpdated.next();
    }

    /**
     * Adds the given file to the recents list.
     * @param file 
     */
    addFileDiff(file: File) {
        this._cleanFiles(file.id, file);
        this.files.unshift(file);
        this._trimList();
        this._onUpdated.next();
    }

    /**
     * Clears the files list.
     */
    clear() {
        this.files = [];
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