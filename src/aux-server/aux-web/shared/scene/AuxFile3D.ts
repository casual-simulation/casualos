import { GameObject } from "./GameObject";
import { AuxFile } from "@yeti-cgi/aux-common/aux-format";
import { Object3D, Mesh, SceneUtils, Box3, Sphere, Group } from "three";
import { File, TagUpdatedEvent, FileCalculationContext, AuxDomain, isFileInContext } from "@yeti-cgi/aux-common";
import { createCube } from "./SceneUtils";
import { AuxFile3DDecorator } from "./AuxFile3DDecorator";
import { ContextPositionDecorator } from "./decorators/ContextPositionDecorator";
import { MeshCubeDecorator } from "./decorators/MeshCubeDecorator";
import { ContextGroup3D } from "./ContextGroup3D";
import { ScaleDecorator } from "./decorators/ScaleDecorator";
import { LabelDecorator } from "./decorators/LabelDecorator";
import { UserMeshDecorator } from "./decorators/UserMeshDecorator";
import { AuxFile3DDecoratorFactory } from "./decorators/AuxFile3DDecoratorFactory";

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

    get boundingBox(): Box3 {
        return new Box3().setFromObject(this.display);
    }

    get boundingSphere(): Sphere {
        let box = new Box3().setFromObject(this.display);
        let sphere = new Sphere();
        sphere = box.getBoundingSphere(sphere);

        return sphere;
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
    fileUpdated(file: AuxFile, updates: TagUpdatedEvent[], calc: FileCalculationContext) {
        // TODO: Add the ability for decorators to update when other files
        // get updated. (like arrows)
        if (this._shouldUpdate(calc, file)) {
            if (file.id === this.file.id) {
                this.file = file;
            }
            this.decorators.forEach(d => d.fileUpdated(this, calc));
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
    }

    private _shouldUpdate(calc: FileCalculationContext, file: AuxFile): boolean {
        return file.id === this.file.id ||
            isFileInContext(calc, file, this.context) ||
            (this.contextGroup && this.contextGroup.file.id === file.id);
    };

}