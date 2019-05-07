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

export const DEFAULT_INVENTORY_COUNT = 5;

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
     * The files in this contexts mapped into the inventory slots.
     * Files are ordered left to right based on their x position in the context, starting at 0 and incrementing from there.
     */
    slots: InventoryItem[] = [];

    /**
     * The file that is currently selected by the user.
     */
    selectedFile: InventoryItem = null;

    private _slotCount: number;
    private _slotsDirty: boolean;

    constructor(
        simulation: PlayerSimulation3D,
        context: string,
        slotCount?: number
    ) {
        if (context == null || context == undefined) {
            throw new Error('Inventory context cannot be null or undefined.');
        }

        if (slotCount < 0) {
            throw new Error(
                'Inventory context cannot have slot count less than 0.'
            );
        }

        this.simulation = simulation;
        this.context = context;
        this.setSlotCount(getOptionalValue(slotCount, DEFAULT_INVENTORY_COUNT));
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

    getSlotCount(): number {
        return this._slotCount;
    }

    setSlotCount(count: number): void {
        if (count == null || count == undefined || count < 0) {
            throw new Error(
                'Inventory Context cannot set the slot count to a value of:' +
                    JSON.stringify(count)
            );
        }

        this._slotCount = count;
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
        this.slots = new Array(this._slotCount);
        const y = 0;

        for (let x = 0; x < this._slotCount; x++) {
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
                this.slots[x] = {
                    file,
                    simulation: this.simulation,
                    context: this.context,
                };
            }
        }
    }
}
