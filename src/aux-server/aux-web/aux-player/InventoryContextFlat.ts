import {
    AuxFile,
    FileCalculationContext,
    TagUpdatedEvent,
    isFileInContext,
    getFilePosition,
    getFileIndex,
} from '@casual-simulation/aux-common';
import { remove } from 'lodash';
import { getOptionalValue } from '../shared/SharedUtils';
import { ArgEvent } from '@casual-simulation/aux-common/Events';
import { Simulation } from '../shared/Simulation';

export const DEFAULT_INVENTORY_SLOTFLAT_COUNT = 5;

/**
 * Defines an interface for inventory items.
 */
export interface InventoryItem {
    file: AuxFile;
    simulation: Simulation;
    context: string;
}

/**
 * Inventory is a helper class to assist with managing the user's inventory context as flat (to be used for rendering by HTML elements).
 */
export class InventoryContextFlat {
    /**
     * The context that this object represents.
     */
    context: string = null;

    /**
     * All the files that are in this context.
     */
    files: AuxFile[] = [];

    /**
     * The files in this context mapped into the inventory slots.
     * Files are ordered left to right based on their x position in the context, starting at 0 and incrementing from there.
     */
    slots: InventoryItem[] = [];

    /**
     * The file that is currently selected by the user.
     */
    selectedFile: InventoryItem = null;

    simulation: Simulation;

    private _slotsCount: number;
    private _slotsDirty: boolean;

    onFileAdded: ArgEvent<AuxFile> = new ArgEvent<AuxFile>();
    onFileRemoved: ArgEvent<string> = new ArgEvent<string>();
    onFileUpdated: ArgEvent<AuxFile> = new ArgEvent<AuxFile>();
    onSlotsUpdated: ArgEvent<InventoryItem[]> = new ArgEvent<InventoryItem[]>();

    constructor(simulation: Simulation, context: string, slotsCount?: number) {
        this.simulation = simulation;

        if (context == null || context == undefined) {
            throw new Error('Inventory context cannot be null or undefined.');
        }

        if (slotsCount < 0) {
            throw new Error(
                'Inventory context cannot have slot count less than 0.'
            );
        }

        this.context = context;
        this.setSlotsCount(
            getOptionalValue(slotsCount, DEFAULT_INVENTORY_SLOTFLAT_COUNT)
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
            this._addFile(file);
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
            this._addFile(file);
        } else if (isInContext && !shouldBeInContext) {
            this._removeFile(file.id);
        } else if (isInContext && shouldBeInContext) {
            this._updateFile(file);
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

    getSlotsCount(): number {
        return this._slotsCount;
    }

    setSlotsCount(count: number): void {
        if (count == null || count == undefined || count < 0) {
            throw new Error(
                'Inventory Context cannot set the slot count to a value of:' +
                    JSON.stringify(count)
            );
        }

        this._slotsCount = count;
        this._slotsDirty = true;
    }

    dispose(): void {}

    private _addFile(file: AuxFile) {
        this.files.push(file);
        this._slotsDirty = true;

        this.onFileAdded.invoke(file);
    }

    private _removeFile(id: string) {
        remove(this.files, f => f.id === id);
        this._slotsDirty = true;

        this.onFileRemoved.invoke(id);
    }

    private _updateFile(file: AuxFile) {
        let fileIndex = this.files.findIndex(f => f.id == file.id);
        if (fileIndex >= 0) {
            this.files[fileIndex] = file;
            this._slotsDirty = true;

            this.onFileUpdated.invoke(file);
        }
    }

    private _resortSlots(calc: FileCalculationContext): void {
        this.slots = new Array(this._slotsCount);
        const y = 0;

        for (let x = 0; x < this._slotsCount; x++) {
            const file = this.files.find(f => {
                const contextPos = getFilePosition(calc, f, this.context);
                if (contextPos.x === x && contextPos.y === y) {
                    const index = getFileIndex(calc, f, this.context);
                    if (index === 0) {
                        return true;
                    }
                }
                return false;
            });

            if (file) {
                this.slots[x] = {
                    file: file,
                    simulation: this.simulation,
                    context: this.context,
                };
            }
        }

        this.onSlotsUpdated.invoke(this.slots);
    }
}
