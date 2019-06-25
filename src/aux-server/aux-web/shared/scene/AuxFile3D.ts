import { GameObject } from './GameObject';
import { AuxFile } from '@casual-simulation/aux-common/aux-format';
import { Object3D, Box3, Sphere, Group, Color } from 'three';
import {
    File,
    TagUpdatedEvent,
    FileCalculationContext,
    AuxDomain,
    isFileInContext,
    GLOBALS_FILE_ID,
} from '@casual-simulation/aux-common';
import { AuxFile3DDecorator } from './AuxFile3DDecorator';
import { ContextGroup3D } from './ContextGroup3D';
import { AuxFile3DDecoratorFactory } from './decorators/AuxFile3DDecoratorFactory';
import { DebugObjectManager } from './debugobjectmanager/DebugObjectManager';

/**
 * Defines a class that is able to display Aux files.
 */
export class AuxFile3D extends GameObject {
    /**
     * The context this file visualization was created for.
     */
    context: string;

    /**
     * The domain that this file visualization is in.
     */
    domain: AuxDomain;

    /**
     * The context group that this visualization belongs to.
     */
    contextGroup: ContextGroup3D;

    /**
     * The file for the mesh.
     */
    file: File;

    /**
     * The things that are displayed by this file.
     */
    display: Group;

    /**
     * The list of decorators that this file is using.
     */
    decorators: AuxFile3DDecorator[];

    private _boundingBox: Box3 = null;
    private _boundingSphere: Sphere = null;

    /**
     * Returns a copy of the file 3d's current bounding box.
     */
    get boundingBox(): Box3 {
        if (!this._boundingBox) {
            this._computeBoundingObjects();
        }

        return this._boundingBox.clone();
    }

    /**
     * Returns a copy of the file 3d's current bounding sphere.
     */
    get boundingSphere(): Sphere {
        if (!this._boundingSphere) {
            this._computeBoundingObjects();
        }
        return this._boundingSphere.clone();
    }

    constructor(
        file: File,
        contextGroup: ContextGroup3D,
        context: string,
        domain: AuxDomain,
        colliders: Object3D[],
        decoratorFactory: AuxFile3DDecoratorFactory
    ) {
        super();
        this.file = file;
        this.domain = domain;
        this.contextGroup = contextGroup;
        this.colliders = colliders;
        this.context = context;
        this.display = new Group();
        this.add(this.display);

        this.decorators = decoratorFactory.loadDecorators(this);
    }

    /**
     * Forces the file to update the file's bounding box and sphere.
     */
    forceComputeBoundingObjects(): void {
        this._computeBoundingObjects();
    }

    /**
     * Update the internally cached representation of this aux file 3d's bounding box and sphere.
     */
    private _computeBoundingObjects(): void {
        // Calculate Bounding Box
        if (this._boundingBox === null) {
            this._boundingBox = new Box3();
        }

        this._boundingBox.setFromObject(this.display);

        // Calculate Bounding Sphere
        if (this._boundingSphere === null) {
            this._boundingSphere = new Sphere();
        }
        this._boundingBox.getBoundingSphere(this._boundingSphere);
    }

    /**
     * Notifies the mesh that the given file has been added to the state.
     * @param file The file.
     * @param calc The calculation context.
     */
    fileAdded(file: AuxFile, calc: FileCalculationContext) {
        // TODO:
        // (probably don't need to do anything here cause formulas updates will propogate to fileUpdated())
    }

    /**
     * Notifies this mesh that the given file has been updated.
     * @param file The file that was updated.
     * @param updates The updates that happened on the file.
     * @param calc The calculation context.
     */
    fileUpdated(
        file: File,
        updates: TagUpdatedEvent[],
        calc: FileCalculationContext
    ) {
        if (this._shouldUpdate(calc, file)) {
            if (file.id === this.file.id) {
                this.file = file;
                this._boundingBox = null;
                this._boundingSphere = null;
            }
            for (let i = 0; i < this.decorators.length; i++) {
                this.decorators[i].fileUpdated(calc);
            }
        }
    }

    /**
     * Notifies the mesh that the given file was removed.
     * @param file The file that was removed.
     * @param calc The calculation context.
     */
    fileRemoved(file: AuxFile, calc: FileCalculationContext) {
        // TODO:
    }

    frameUpdate(calc: FileCalculationContext): void {
        if (this.decorators) {
            for (let i = 0; i < this.decorators.length; i++) {
                this.decorators[i].frameUpdate(calc);
            }
        }

        // DebugObjectManager.drawBox3(this._boundingBox, new Color('#00ff00'));
    }

    dispose() {
        super.dispose();
        if (this.decorators) {
            this.decorators.forEach(d => {
                d.dispose();
            });
        }
    }

    private _shouldUpdate(calc: FileCalculationContext, file: File): boolean {
        return file.id === this.file.id;
    }
}
