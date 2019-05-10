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
} from '@casual-simulation/aux-common';
import { PlayerInteractionManager } from '../PlayerInteractionManager';
import GameView from '../../GameView/GameView';
import { Intersection, Vector2 } from 'three';
import { Physics } from '../../../shared/scene/Physics';
import { Input } from '../../../shared/scene/Input';
import InventoryFile from '../../InventoryFile/InventoryFile';
import { PlayerSimulation3D } from '../../scene/PlayerSimulation3D';
import { BasePlayerFileDragOperation } from './BasePlayerFileDragOperation';

export class PlayerFileDragOperation extends BasePlayerFileDragOperation {
    /**
     * Create a new drag rules.
     */
    constructor(
        simulation: PlayerSimulation3D,
        interaction: PlayerInteractionManager,
        files: File[],
        context: string
    ) {
        super(simulation, interaction, files, context);
    }
}
