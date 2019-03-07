import { GameObject } from "./GameObject";
import { AuxFile } from "@yeti-cgi/aux-common/aux-format";
import { FileCalculationContext, calculateFileValue, TagUpdatedEvent } from "@yeti-cgi/aux-common";
import { Object3D, SceneUtils } from "three";
import { AuxFile3D } from "./AuxFile3D";

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
    files: Map<string, AuxFile3D>;

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

    private _addFile(file: AuxFile) {
        console.log('[Context3D] Add', file.id, 'to context', this.context);
        const mesh = new AuxFile3D(file, this.colliders);
        this.files.set(file.id, mesh);
        this.add(mesh);
    }

    private _removeFile(id: string) {
        console.log('[Context3D] Remove', id, 'from context', this.context);
        const mesh = this.files.get(id);
        if (typeof mesh !== 'undefined') {
            this.remove(mesh);
            this.files.delete(id);
        }
    }

    private _updateFile(file: AuxFile, updates: TagUpdatedEvent[], calc: FileCalculationContext) {
        this.files.forEach(mesh => {
            mesh.fileUpdated(file, updates, calc);
        });
    }

    private _shouldBeInContext(file: AuxFile, calc: FileCalculationContext): boolean {
        return calculateFileValue(calc, file, this.context);
    }
}