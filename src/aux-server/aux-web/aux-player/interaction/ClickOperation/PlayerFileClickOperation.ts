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
} from '@casual-simulation/aux-common';
import { appManager } from '../../../shared/AppManager';
import { BaseFileDragOperation } from '../../../shared/interaction/DragOperation/BaseFileDragOperation';
import { PlayerFileDragOperation } from '../DragOperation/PlayerFileDragOperation';
import { dropWhile } from 'lodash';

export class PlayerFileClickOperation extends BaseFileClickOperation {
    // This overrides the base class BaseInteractionManager
    protected _interaction: PlayerInteractionManager;
    // This overrides the base class IGameView
    protected _gameView: GameView;

    constructor(
        gameView: GameView,
        interaction: PlayerInteractionManager,
        file: AuxFile3D
    ) {
        super(gameView, interaction, file.file, file);
    }

    protected _performClick(calc: FileCalculationContext): void {
        appManager.fileManager.helper.action('onClick', [this._file]);
    }

    protected _createDragOperation(
        calc: FileCalculationContext
    ): BaseFileDragOperation {
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
                this._gameView,
                this._interaction,
                draggedObjects,
                file3D.context
            );
        }

        return null;
    }
}
