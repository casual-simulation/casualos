import { AuxFile, calculateFileValue, FileCalculationContext, TagUpdatedEvent } from "@yeti-cgi/aux-common";

/**
 * Inventory is a helper class to assist with managing the user's inventory context.
 */
export class InventoryContext {

    /**
     * The context that this object represents.
     */
    context: string = null;

    /**
     * The files that are in this context.
     * These are ordered left to right using the file's context.x position.
     */
    files: AuxFile[] = [];

    /**
     * The file that is currently selected by the user.
     */
    selectedFile: AuxFile = null;

    constructor(context: string) {
        this.context = context;
        this.files = []
    }
    
    /**
     * Notifies this context that the given file was added to the state.
     * @param file The file.
     * @param calc The calculation context that should be used.
     */
    fileAdded(file: AuxFile, calc: FileCalculationContext) {
        const isInContext = this.files.indexOf(file) >= 0;
        const shouldBeInContext = this._shouldBeInContext(file, calc);
        if (!isInContext && shouldBeInContext) {
            this._addFile(file, calc);
        }
    }

    /**
     * Notifies this context that the given file was updated.
     * @param file The file.
     * @param updates The changes made to the file.
     * @param calc The calculation context that should be used.
     */
    fileUpdated(file: AuxFile, updates: TagUpdatedEvent[], calc: FileCalculationContext) {
        const isInContext = this.files.indexOf(file) >= 0;
        const shouldBeInContext = this._shouldBeInContext(file, calc);

        if (!isInContext && shouldBeInContext) {
            this._addFile(file, calc);
        } else if (isInContext && !shouldBeInContext) {
            this._removeFile(file.id);
        } else if(isInContext && shouldBeInContext) {
            this._updateFile(file, updates, calc);
        }
    }

    /**
     * Notifies this context that the given file was removed from the state.
     * @param file The ID of the file that was removed.
     * @param calc The calculation context.
     */
    fileRemoved(id: string, calc: FileCalculationContext) {
        this._removeFile(id);
    }

    frameUpdate(calc: FileCalculationContext): void {
    }

    selectFile(file: AuxFile): void {
        this.selectedFile = file;
    }

    dispose(): void {
    }

    private _addFile(file: AuxFile, calc: FileCalculationContext) {
        console.log('[InventoryContext] Add', file.id, 'to context', this.context);
    }

    private _removeFile(id: string) {
        console.log('[InventoryContext] Remove', id, 'from context', this.context);
    }

    private _updateFile(file: AuxFile, updates: TagUpdatedEvent[], calc: FileCalculationContext) {
        // this.files.forEach(mesh => {
        //     mesh.fileUpdated(file, updates, calc);
        // });
    }

    private _shouldBeInContext(file: AuxFile, calc: FileCalculationContext): boolean {
        return calculateFileValue(calc, file, this.context);
    }
}