import { GameObject } from "./GameObject";
import { AuxFile } from "@yeti-cgi/aux-common/aux-format";
import { FileCalculationContext, calculateFileValue, TagUpdatedEvent, AuxDomain, isFileInContext } from "@yeti-cgi/aux-common";
import { Object3D, SceneUtils } from "three";
import { AuxFile3D } from "./AuxFile3D";
import { ContextGroup3D } from "./ContextGroup3D";
import { AuxFile3DDecoratorFactory } from "./decorators/AuxFile3DDecoratorFactory";

/**
 * Defines a class that represents the visualization of a context.
 */
export class Context3D extends GameObject {

    static debug: boolean = true;

    /**
     * The context that this object represents.
     */
    context: string;

    /**
     * The domain this object is in.
     */
    domain: AuxDomain;

    /**
     * The files that are in this context.
     */
    files: Map<string, AuxFile3D>;

    /**
     * The group that this context belongs to.
     */
    contextGroup: ContextGroup3D;

    private _decoratorFactory: AuxFile3DDecoratorFactory;

    /**
     * Creates a new context which represents a grouping of files.
     * @param context The tag that this context represents.
     * @param colliders The array that new colliders should be added to.
     */
    constructor(context: string, group: ContextGroup3D, domain: AuxDomain, colliders: Object3D[], decoratorFactory: AuxFile3DDecoratorFactory) {
        super();
        this.context = context;
        this.colliders = colliders;
        this.domain = domain;
        this.contextGroup = group;
        this.files = new Map();
        this._decoratorFactory = decoratorFactory;
    }

    /**
     * Notifies this context that the given file was added to the state.
     * @param file The file.
     * @param calc The calculation context that should be used.
     */
    fileAdded(file: AuxFile, calc: FileCalculationContext) {
        const isInContext3D = typeof this.files.get(file.id) !== 'undefined';
        const isInContext = isFileInContext(calc, file, this.context);
        
        if (!isInContext3D && isInContext) {
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
        const isInContext3D = typeof this.files.get(file.id) !== 'undefined';
        const isInContext = isFileInContext(calc, file, this.context);

        if (!isInContext3D && isInContext) {
            this._addFile(file, calc);
        } else if (isInContext3D && !isInContext) {
            this._removeFile(file.id);
        } else if(isInContext3D && isInContext) {
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
        if (this.files) {
            this.files.forEach(f => f.frameUpdate(calc));
        }
    }

    dispose(): void {
        if (this.files) {
            this.files.forEach(f => { f.dispose(); });
        }
    }

    private _addFile(file: AuxFile, calc: FileCalculationContext) {
        if (Context3D.debug) {
            console.log('[Context3D] Add', file.id, 'to context', this.context);
        }
        const mesh = new AuxFile3D(file, this.contextGroup, this.context, this.domain, this.colliders, this._decoratorFactory);
        this.files.set(file.id, mesh);
        this.add(mesh);

        mesh.fileUpdated(file, [], calc);
    }

    private _removeFile(id: string) {
        if (Context3D.debug) {
            console.log('[Context3D] Remove', id, 'from context', this.context);
        }
        const mesh = this.files.get(id);
        if (typeof mesh !== 'undefined') {
            mesh.dispose();
            this.remove(mesh);
            this.files.delete(id);
        }
    }

    private _updateFile(file: AuxFile, updates: TagUpdatedEvent[], calc: FileCalculationContext) {
        this.files.forEach(mesh => {
            mesh.fileUpdated(file, updates, calc);
        });
    }
}