import { Object3D } from 'three';
import { ContextGroup3D } from '../../shared/scene/ContextGroup3D';
import {
    AuxDomain,
    AuxFile,
    FileCalculationContext,
    isFileInContext,
} from '@casual-simulation/aux-common';
import { AuxFile3DDecoratorFactory } from '../../shared/scene/decorators/AuxFile3DDecoratorFactory';
import { Context3D } from '../../shared/scene/Context3D';
import { InventoryContextGroup3D } from './InventoryContextGroup3D';

export const DEFAULT_INVENTORY_SLOTGRID_WIDTH = 5;
export const DEFAULT_INVENTORY_SLOTGRID_HEIGHT = 3;

export class InventoryContext3D extends Context3D {
    contextGroup: InventoryContextGroup3D;

    /**
     * Creates a new context which represents a grouping of files.
     * This is a special Context3D designed for Inventory contexts which has
     * some special cases.
     * @param context The tag that this context represents.
     * @param colliders The array that new colliders should be added to.
     */
    constructor(
        context: string,
        group: InventoryContextGroup3D,
        domain: AuxDomain,
        colliders: Object3D[],
        decoratorFactory: AuxFile3DDecoratorFactory
    ) {
        super(context, group, domain, colliders, decoratorFactory);
    }

    /**
     * Notifies this context that the given file was added to the state.
     * @param file The file.
     * @param calc The calculation context that should be used.
     */
    fileAdded(file: AuxFile, calc: FileCalculationContext) {
        super.fileAdded(file, calc);
    }

    // private _doesFileFitInGridSlots(
    //     file: AuxFile,
    //     calc: FileCalculationContext
    // ): boolean {
    //     const contextPos = getFilePosition(calc, file, this.context);

    //     if (contextPos.x < 0 || contextPos.x >= this._gridSlotsWidth)
    //         return false;
    //     if (contextPos.y < 0 || contextPos.y >= this._gridSlotsHeight)
    //         return false;

    //     return true;
    // }
}
