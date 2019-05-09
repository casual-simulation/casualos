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

export class PlayerFileClickOperation extends BaseFileClickOperation {
    // This overrides the base class BaseInteractionManager
    protected _interaction: PlayerInteractionManager;
    // This overrides the base class IGameView
    protected _simulation3D: PlayerSimulation3D;

    protected faceClicked: { face: string };

    constructor(
        simulation: PlayerSimulation3D,
        interaction: PlayerInteractionManager,
        file: AuxFile3D,
        faceValue: string
    ) {
        super(simulation, interaction, file.file, file);
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
            return new PlayerFileDragOperation(
                this._simulation3D,
                this._interaction,
                draggedObjects,
                file3D.context
            );
        }

        return null;
    }

    protected _createCloneDragOperation(): BaseFileDragOperation {
        let duplicatedFile = duplicateFile(<File>this._file, {
            tags: {
                'aux._creator': this._file.id,
            },
        });
        return new PlayerNewFileDragOperation(
            this._simulation3D,
            this._interaction,
            duplicatedFile,
            (<AuxFile3D>this._file3D).context
        );
    }
}
