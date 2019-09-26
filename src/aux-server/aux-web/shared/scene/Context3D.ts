import { GameObject } from './GameObject';
import {
    Bot,
    FileCalculationContext,
    calculateFileValue,
    TagUpdatedEvent,
    AuxDomain,
    isFileInContext,
    getFileConfigContexts,
    isConfigForContext,
    GLOBALS_FILE_ID,
} from '@casual-simulation/aux-common';
import { Object3D, SceneUtils } from 'three';
import { AuxFile3D } from './AuxFile3D';
import { ContextGroup3D } from './ContextGroup3D';
import { AuxFile3DDecoratorFactory } from './decorators/AuxFile3DDecoratorFactory';

/**
 * Defines a class that represents the visualization of a context.
 */
export class Context3D extends GameObject {
    static debug: boolean = false;

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
    constructor(
        context: string,
        group: ContextGroup3D,
        domain: AuxDomain,
        colliders: Object3D[],
        decoratorFactory: AuxFile3DDecoratorFactory
    ) {
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
    fileAdded(file: Bot, calc: FileCalculationContext) {
        const isInContext3D = this.files.has(file.id);
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
    fileUpdated(
        file: Bot,
        updates: TagUpdatedEvent[],
        calc: FileCalculationContext
    ) {
        const isInContext3D = this.files.has(file.id);
        const isInContext = isFileInContext(calc, file, this.context);

        if (!isInContext3D && isInContext) {
            this._addFile(file, calc);
        } else if (isInContext3D && !isInContext) {
            this._removeFile(file.id, calc);
        } else if (isInContext3D && isInContext) {
            this._updateFile(file, updates, calc);
        }
    }

    /**
     * Notifies this context that the given file was removed from the state.
     * @param file The ID of the file that was removed.
     * @param calc The calculation context.
     */
    fileRemoved(id: string, calc: FileCalculationContext) {
        this._removeFile(id, calc);
    }

    frameUpdate(calc: FileCalculationContext): void {
        if (this.files) {
            this.files.forEach(f => f.frameUpdate(calc));
        }
    }

    dispose(): void {
        if (this.files) {
            this.files.forEach(f => {
                f.dispose();
            });
        }
    }

    protected _addFile(file: Bot, calc: FileCalculationContext) {
        if (Context3D.debug) {
            console.log('[Context3D] Add', file.id, 'to context', this.context);
        }
        const mesh = new AuxFile3D(
            file,
            this.contextGroup,
            this.context,
            this.domain,
            this.colliders,
            this._decoratorFactory
        );
        this.files.set(file.id, mesh);
        this.add(mesh);

        mesh.fileUpdated(file, [], calc);

        // need to fire update twice as it sometimes doesn't update the file decorator the first time.
        mesh.fileUpdated(file, [], calc);
    }

    protected _removeFile(id: string, calc: FileCalculationContext) {
        if (Context3D.debug) {
            console.log('[Context3D] Remove', id, 'from context', this.context);
        }
        const file = this.files.get(id);
        if (typeof file !== 'undefined') {
            file.fileRemoved(calc);
            file.dispose();
            this.remove(file);
            this.files.delete(id);
        }
    }

    protected _updateFile(
        file: Bot,
        updates: TagUpdatedEvent[],
        calc: FileCalculationContext
    ) {
        let mesh = this.files.get(file.id);
        mesh.fileUpdated(file, updates, calc);
    }
}
