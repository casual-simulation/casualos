import { GameObject } from "./GameObject";
import { AuxFile } from "@yeti-cgi/aux-common/aux-format";
import { Object3D, Mesh, SceneUtils, Box3, Sphere, Group, Vector3, Box3Helper, Color } from "three";
import { File, TagUpdatedEvent, FileCalculationContext, AuxDomain, isFileInContext, getContextGrid, calculateGridScale } from "@yeti-cgi/aux-common";
import { createCube, calculateScale, findParentScene } from "./SceneUtils";
import { AuxFile3DDecorator } from "./AuxFile3DDecorator";
import { ContextPositionDecorator } from "./decorators/ContextPositionDecorator";
import { MeshCubeDecorator } from "./decorators/MeshCubeDecorator";
import { ContextGroup3D } from "./ContextGroup3D";
import { ScaleDecorator } from "./decorators/ScaleDecorator";
import { LabelDecorator } from "./decorators/LabelDecorator";
import { UserMeshDecorator } from "./decorators/UserMeshDecorator";
import { AuxFile3DDecoratorFactory } from "./decorators/AuxFile3DDecoratorFactory";
import { appManager } from "../AppManager";
import { DebugObjectManager } from "./DebugObjectManager";

/**
 * Defines a class that is able to display Aux files.
 */
export class AuxFile3D extends GameObject {

    static Debug_BoundingBox: boolean = false;

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
        return this._boundingBox.clone();
    }

    /**
     * Returns a copy of the file 3d's current bounding sphere.
     */
    get boundingSphere(): Sphere {
        return this._boundingSphere.clone();
    }

    constructor(file: File, contextGroup: ContextGroup3D, context: string, domain: AuxDomain, colliders: Object3D[], decoratorFactory: AuxFile3DDecoratorFactory) {
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
     * Update the internally cached representation of this aux file 3d's bounding box and sphere.
     */
    computeBoundingObjects(): void {
        // Calculate Bounding Box
        if (this._boundingBox === null) {
            this._boundingBox = new Box3();
            if (AuxFile3D.Debug_BoundingBox) {
                DebugObjectManager.debugBox3(`AuxFile3D_${this.file.id}_BoundingBox`, this._boundingBox);
            }
        }
        
        this._boundingBox.setFromObject(this.display);

        if (AuxFile3D.Debug_BoundingBox) {
            DebugObjectManager.forceUpdate(`AuxFile3D_${this.file.id}_BoundingBox`);
        }

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
    fileUpdated(file: File, updates: TagUpdatedEvent[], calc: FileCalculationContext) {
        if (this._shouldUpdate(calc, file)) {
            if (file.id === this.file.id) {
                this.file = file;
            }
            this.decorators.forEach(d => d.fileUpdated(calc));
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
            this.decorators.forEach(d => d.frameUpdate(calc));
        }
    }

    dispose() {
        super.dispose();
        if (this.decorators) {
            this.decorators.forEach(d => { d.dispose(); });
        }
        if (AuxFile3D.Debug_BoundingBox) {
            DebugObjectManager.remove(`AuxFile3D_${this.file.id}_BoundingBox`);
        }
    }

    private _shouldUpdate(calc: FileCalculationContext, file: File): boolean {
        return file.id === this.file.id ||
            isFileInContext(calc, file, this.context) ||
            (this.contextGroup && this.contextGroup.file.id === file.id);
    };
}