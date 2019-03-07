import { GameObject } from "./GameObject";
import { AuxFile } from "@yeti-cgi/aux-common/aux-format";
import { FileCalculationContext, calculateFileValue, TagUpdatedEvent } from "@yeti-cgi/aux-common";
import { Object3D } from "three";

/**
 * Defines a class that represents the visualization of a context.
 */
export class Context3D extends GameObject {

    /**
     * The context that this object represents.
     */
    context: string;

    /**
     * The files that are in this context.
     */
    files: Map<string, AuxFile>;

    /**
     * Creates a new context which represents a grouping of files.
     * @param context The tag that this context represents.
     * @param colliders The array that new colliders should be added to.
     */
    constructor(context: string, colliders: Object3D[]) {
        super();
        this.context = context;
        this.colliders = colliders;
        this.files = new Map();
    }

    /**
     * Notifies this context that the given file was added to the state.
     * @param file The file.
     * @param calc The calculation context that should be used.
     */
    fileAdded(file: AuxFile, calc: FileCalculationContext) {
        if (this._shouldBeInContext(file, calc)) {
            this._addFile(file);
        }
    }

    /**
     * Notifies this context that the given file was updated.
     * @param file The file.
     * @param updates The changes made to the file.
     * @param calc The calculation context that should be used.
     */
    fileUpdated(file: AuxFile, updates: TagUpdatedEvent[], calc: FileCalculationContext) {
        const isInContext = typeof this.files.get(file.id) !== 'undefined';
        const shouldBeInContext = this._shouldBeInContext(file, calc);

        if (!isInContext && shouldBeInContext) {
            this._addFile(file);
        } else if (isInContext && !shouldBeInContext) {
            this._removeFile(file);
        } else if(isInContext && shouldBeInContext) {
            this._updateFile(file, updates, calc);
        }
    }

    /**
     * Notifies this context that the given file was removed from the state.
     * @param file The file.
     * @param calc The calculation context.
     */
    fileRemoved(file: AuxFile, calc: FileCalculationContext) {
        this._removeFile(file);
    }

    private _addFile(file: AuxFile) {
        console.log('[Context3D] Add', file.id, 'to context', this.context);
        this.files.set(file.id, file);
        // TODO: Add to visual tree
    }

    private _removeFile(file: AuxFile) {
        console.log('[Context3D] Remove', file.id, 'from context', this.context);
        if (this.files.delete(file.id)) {
            // TODO: Remove from visual tree
        }
    }

    private _updateFile(file: AuxFile, updates: TagUpdatedEvent[], calc: FileCalculationContext) {
        // TODO: Propogate update
    }

    private _shouldBeInContext(file: AuxFile, calc: FileCalculationContext): boolean {
        return calculateFileValue(calc, file, this.context);
    }
}