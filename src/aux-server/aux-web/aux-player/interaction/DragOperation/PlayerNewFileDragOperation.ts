import { BaseFileDragOperation } from '../../../shared/interaction/DragOperation/BaseFileDragOperation';
import {
    File,
    FileCalculationContext,
    DRAG_OUT_OF_INVENTORY_ACTION_NAME,
    DROP_IN_INVENTORY_ACTION_NAME,
    FileEvent,
    DRAG_ANY_OUT_OF_CONTEXT_ACTION_NAME,
    convertToFormulaObject,
    DROP_ANY_IN_INVENTORY_ACTION_NAME,
    DRAG_ANY_OUT_OF_INVENTORY_ACTION_NAME,
    isFileMovable,
    merge,
    createFile,
    fileAdded,
    PartialFile,
    CREATE_ACTION_NAME,
    FileDragMode,
} from '@casual-simulation/aux-common';
import { PlayerInteractionManager } from '../PlayerInteractionManager';
import PlayerGameView from '../../PlayerGameView/PlayerGameView';
import { Intersection, Vector2 } from 'three';
import { Physics } from '../../../shared/scene/Physics';
import { Input } from '../../../shared/scene/Input';
import { PlayerSimulation3D } from '../../scene/PlayerSimulation3D';
import { PlayerFileDragOperation } from './PlayerFileDragOperation';
import { InventorySimulation3D } from '../../scene/InventorySimulation3D';

export class PlayerNewFileDragOperation extends PlayerFileDragOperation {
    private _fileAdded: boolean;

    /**
     * Create a new drag rules.
     */
    constructor(
        playerSimulation: PlayerSimulation3D,
        inventorySimulation: InventorySimulation3D,
        interaction: PlayerInteractionManager,
        file: File,
        context: string
    ) {
        super(
            playerSimulation,
            inventorySimulation,
            interaction,
            [file],
            context
        );
    }

    protected _updateFile(file: File, data: PartialFile): FileEvent {
        if (!this._fileAdded) {
            // Add the duplicated file.
            this._file = merge(this._file, data || {});
            this._file = createFile(undefined, this._file.tags);
            this._files = [this._file];
            this._fileAdded = true;

            return fileAdded(this._file);
        } else {
            return super._updateFile(this._file, data);
        }
    }

    protected _onDragReleased(calc: FileCalculationContext): void {
        if (this._fileAdded) {
            this.simulation.helper.action(CREATE_ACTION_NAME, this._files);
        }
        super._onDragReleased(calc);
    }

    protected _canDragWithinContext(mode: FileDragMode): boolean {
        return true;
    }

    protected _canDragOutOfContext(mode: FileDragMode): boolean {
        return true;
    }
}
