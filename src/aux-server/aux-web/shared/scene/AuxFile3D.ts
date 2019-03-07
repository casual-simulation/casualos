import { GameObject } from "./GameObject";
import { AuxFile } from "@yeti-cgi/aux-common/aux-format";
import { Object3D } from "three";
import { TagUpdatedEvent, FileCalculationContext } from "@yeti-cgi/aux-common";

/**
 * Defines a class that is able to display Aux files.
 */
export class AuxFile3D extends GameObject {

    /**
     * The file for the mesh.
     */
    file: AuxFile;

    constructor(file: AuxFile, colliders: Object3D[]) {
        super();
        this.file = file;
        this.colliders = colliders;
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
        // TODO:
    }

    /**
     * Notifies the mesh that the given file was removed.
     * @param file The file that was removed.
     * @param calc The calculation context.
     */
    fileRemoved(file: AuxFile, calc: FileCalculationContext) {
        // TODO:
    }

}