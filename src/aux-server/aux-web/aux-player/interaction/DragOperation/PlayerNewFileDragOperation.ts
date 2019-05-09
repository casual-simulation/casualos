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
    isPickupable,
    isFileMovable,
    merge,
    createFile,
    fileAdded,
    PartialFile,
    CREATE_ACTION_NAME,
} from '@casual-simulation/aux-common';
import { PlayerInteractionManager } from '../PlayerInteractionManager';
import GameView from '../../GameView/GameView';
import { Intersection, Vector2 } from 'three';
import { Physics } from '../../../shared/scene/Physics';
import { Input } from '../../../shared/scene/Input';
import InventoryFile from '../../InventoryFile/InventoryFile';
import { PlayerSimulation3D } from '../../scene/PlayerSimulation3D';
import { BasePlayerFileDragOperation } from './BasePlayerFileDragOperation';

export class PlayerNewFileDragOperation extends BasePlayerFileDragOperation {
    private _fileAdded: boolean;

    /**
     * Create a new drag rules.
     */
    constructor(
        simulation: PlayerSimulation3D,
        interaction: PlayerInteractionManager,
        file: File,
        context: string
    ) {
        super(simulation, interaction, [file], context);
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
}
