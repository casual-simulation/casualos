import {
    AuxFile,
    calculateFileValue,
    FileCalculationContext,
    TagUpdatedEvent,
    isFileInContext,
    getContextPosition,
    getFilePosition,
    getFileIndex,
} from '@casual-simulation/aux-common';
import { remove } from 'lodash';
import { getOptionalValue } from '../shared/SharedUtils';
import { appManager } from '../shared/AppManager';
import { Simulation } from '../shared/Simulation';
import { PlayerSimulation3D } from './scene/PlayerSimulation3D';

export const DEFAULT_INVENTORY_SLOTFLAT_COUNT = 5;
export const DEFAULT_INVENTORY_SLOTGRID_WIDTH = 5;
export const DEFAULT_INVENTORY_SLOTGRID_HEIGHT = 3;

/**
 * Defines an interface for inventory items.
 */
export interface InventoryItem {
    file: AuxFile;
    simulation: PlayerSimulation3D;
    context: string;
}

/**
 * Inventory is a helper class to assist with managing the user's inventory context.
 */
export class InventoryContext {
    /**
     * The context that this object represents.
     */
    context: string = null;

    /**
     * The simulation that the context is for.
     */
    simulation: PlayerSimulation3D;

    /**
     * All the files that are in this context.
     */
    files: AuxFile[] = [];

    /**
     * The files in this context mapped into the inventory slots.
     * Files are ordered left to right based on their x position in the context, starting at 0 and incrementing from there.
     */
    slotsFlat: InventoryItem[] = [];

    /** The files in this context mapped into a grid.
     * Files are placed exactly where they are in the context, except for if they fall outside of the desired grid area.
     */
    slotsGrid: InventoryItem[] = [];

    /**
     * The file that is currently selected by the user.
     */
    selectedFile: InventoryItem = null;

    private _slotFlatCount: number;
    private _slotsDirty: boolean;
    private _slotGridWidth: number;
    private _slotGridHeight: number;

    constructor(
        simulation: PlayerSimulation3D,
        context: string,
        slotFlatCount?: number,
        slotGridWidth?: number,
        slotGridHeight?: number
    ) {
        if (context == null || context == undefined) {
            throw new Error('Inventory context cannot be null or undefined.');
        }

        if (slotFlatCount < 0) {
            throw new Error(
                'Inventory context cannot have slot count less than 0.'
            );
        }

        if (slotGridWidth < 0) {
            throw new Error(
                'Inventory context cannot have slot grid width less than 0.'
            );
        }

        if (slotGridHeight < 0) {
            throw new Error(
                'Inventory context cannot have slot grid height less than 0.'
            );
        }

        this.simulation = simulation;
        this.context = context;
        this.setSlotFlatCount(
            getOptionalValue(slotFlatCount, DEFAULT_INVENTORY_SLOTFLAT_COUNT)
        );
        this.setSlotGridDimensions(
            getOptionalValue(slotGridWidth, DEFAULT_INVENTORY_SLOTGRID_WIDTH),
            getOptionalValue(slotGridHeight, DEFAULT_INVENTORY_SLOTGRID_HEIGHT)
        );
        this.files = [];
    }

    /**
     * Notifies this context that the given file was added to the state.
     * @param file The file.
     * @param calc The calculation context that should be used.
     */
    async fileAdded(file: AuxFile, calc: FileCalculationContext) {
        const isInContext = !!this.files.find(f => f.id == file.id);
        const shouldBeInContext = isFileInContext(calc, file, this.context);

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
    async fileUpdated(
        file: AuxFile,
        updates: TagUpdatedEvent[],
        calc: FileCalculationContext
    ) {
        const isInContext = !!this.files.find(f => f.id == file.id);
        const shouldBeInContext = isFileInContext(calc, file, this.context);

        if (!isInContext && shouldBeInContext) {
            this._addFile(file, calc);
        } else if (isInContext && !shouldBeInContext) {
            this._removeFile(file.id);
        } else if (isInContext && shouldBeInContext) {
            this._updateFile(file, updates, calc);
        }
    }

    /**
     * Notifies this context that the given file was removed from the state.
     * @param file The ID of the file that was removed.
     * @param calc The calculation context.
     */
    fileRemoved(id: string, calc: FileCalculationContext) {
        // console.log('[InventoryContext] fileRemoved:', id);
        this._removeFile(id);
    }

    frameUpdate(calc: FileCalculationContext): void {
        if (this._slotsDirty) {
            this._resortSlots(calc);
            this._slotsDirty = false;
        }
    }

    selectFile(file: InventoryItem): void {
        this.selectedFile = file;
    }

    getSlotFlatCount(): number {
        return this._slotFlatCount;
    }

    getSlotGridWidth(): number {
        return this._slotGridWidth;
    }

    getSlotGridHeight(): number {
        return this._slotGridHeight;
    }

    setSlotFlatCount(count: number): void {
        if (count == null || count == undefined || count < 0) {
            throw new Error(
                'Inventory Context cannot set the slot count to a value of:' +
                    JSON.stringify(count)
            );
        }

        this._slotFlatCount = count;
        this._slotsDirty = true;
    }

    setSlotGridDimensions(width: number, height: number): void {
        if (width == null || width == undefined || width < 0) {
            throw new Error(
                'Inventory Context cannot set the slot grid width to a value of:' +
                    JSON.stringify(width)
            );
        }

        if (height == null || height == undefined || height < 0) {
            throw new Error(
                'Inventory Context cannot set the slot grid height to a value of:' +
                    JSON.stringify(height)
            );
        }

        this._slotGridWidth = width;
        this._slotGridHeight = height;
        this._slotsDirty = true;
    }

    dispose(): void {}

    private _addFile(file: AuxFile, calc: FileCalculationContext) {
        this.files.push(file);
        this._slotsDirty = true;
    }

    private _removeFile(id: string) {
        remove(this.files, f => f.id === id);
        this._slotsDirty = true;
    }

    private _updateFile(
        file: AuxFile,
        updates: TagUpdatedEvent[],
        calc: FileCalculationContext
    ) {
        let fileIndex = this.files.findIndex(f => f.id == file.id);
        if (fileIndex >= 0) {
            this.files[fileIndex] = file;
            this._slotsDirty = true;
        }
    }

    private _resortSlots(calc: FileCalculationContext): void {
        this.slotsFlat = new Array(this._slotFlatCount);
        const y = 0;

        for (let x = 0; x < this._slotFlatCount; x++) {
            let file = this.files.find(f => {
                let contextPos = getFilePosition(calc, f, this.context);
                if (contextPos.x === x && contextPos.y === y) {
                    let index = getFileIndex(calc, f, this.context);
                    if (index === 0) {
                        return true;
                    }
                }
                return false;
            });

            if (file) {
                this.slotsFlat[x] = {
                    file,
                    simulation: this.simulation,
                    context: this.context,
                };
            }
        }
    }
}
