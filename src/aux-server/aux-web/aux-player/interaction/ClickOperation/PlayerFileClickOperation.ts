import { BaseFileClickOperation } from '../../../shared/interaction/ClickOperation/BaseFileClickOperation';
import GameView from '../../GameView/GameView';
import { AuxFile3D } from '../../../shared/scene/AuxFile3D';
import { Intersection } from 'three';
import { PlayerInteractionManager } from '../PlayerInteractionManager';
import {
    FileCalculationContext,
    getFilePosition,
    objectsAtContextGridPosition,
    getFileIndex,
    duplicateFile,
    File,
    getFileDragMode,
} from '@casual-simulation/aux-common';
import { BaseFileDragOperation } from '../../../shared/interaction/DragOperation/BaseFileDragOperation';
import { PlayerFileDragOperation } from '../DragOperation/PlayerFileDragOperation';
import { dropWhile } from 'lodash';
import { PlayerSimulation3D } from '../../scene/PlayerSimulation3D';
import { PlayerNewFileDragOperation } from '../DragOperation/PlayerNewFileDragOperation';
import { InventorySimulation3D } from '../../scene/InventorySimulation3D';
import { Simulation3D } from '../../../shared/scene/Simulation3D';

export class PlayerFileClickOperation extends BaseFileClickOperation {
    // This overrides the base class.
    protected _interaction: PlayerInteractionManager;

    protected faceClicked: { face: string };

    constructor(
        simulation3D: Simulation3D,
        interaction: PlayerInteractionManager,
        file: AuxFile3D,
        faceValue: string
    ) {
        super(simulation3D, interaction, file.file, file);
        this.faceClicked = { face: faceValue };
    }

    protected _performClick(calc: FileCalculationContext): void {
        this.simulation.helper.action(
            'onClick',
            [this._file],
            this.faceClicked
        );
    }

    protected _createDragOperation(
        calc: FileCalculationContext
    ): BaseFileDragOperation {
        const mode = getFileDragMode(calc, this._file);
        if (mode === 'clone') {
            return this._createCloneDragOperation();
        }

        const file3D: AuxFile3D = <AuxFile3D>this._file3D;
        const context = file3D.context;
        const position = getFilePosition(calc, file3D.file, context);
        if (position) {
            const objects = objectsAtContextGridPosition(
                calc,
                context,
                position
            );
            if (objects.length === 0) {
                console.log('Found no objects at', position);
                console.log(file3D.file);
                console.log(context);
            }
            const file = this._file;
            const draggedObjects = dropWhile(objects, o => o.id !== file.id);
            const {
                playerSimulation3D,
                inventorySimulation3D,
            } = this._getSimulationsForDragOp();

            return new PlayerFileDragOperation(
                playerSimulation3D,
                inventorySimulation3D,
                this._interaction,
                draggedObjects,
                file3D.context
            );
        }

        return null;
    }

    protected _createCloneDragOperation(): BaseFileDragOperation {
        let duplicatedFile = duplicateFile(<File>this._file);
        const {
            playerSimulation3D,
            inventorySimulation3D,
        } = this._getSimulationsForDragOp();
        return new PlayerNewFileDragOperation(
            playerSimulation3D,
            inventorySimulation3D,
            this._interaction,
            duplicatedFile,
            (<AuxFile3D>this._file3D).context
        );
    }

    private _getSimulationsForDragOp() {
        let playerSimulation3D: PlayerSimulation3D;
        let inventorySimulation3D: InventorySimulation3D;

        if (this._simulation3D instanceof PlayerSimulation3D) {
            playerSimulation3D = this._simulation3D;
            inventorySimulation3D = (<GameView>(
                this.gameView
            )).findInventorySimulation3D(this._simulation3D.simulation);
        } else if (this._simulation3D instanceof InventorySimulation3D) {
            playerSimulation3D = (<GameView>(
                this.gameView
            )).findPlayerSimulation3D(this._simulation3D.simulation);
            inventorySimulation3D = this._simulation3D;
        } else {
            console.error(
                '[PlayerFileClickOperation] Unsupported Simulation3D type for drag operation.'
            );
        }

        return { playerSimulation3D, inventorySimulation3D };
    }
}
