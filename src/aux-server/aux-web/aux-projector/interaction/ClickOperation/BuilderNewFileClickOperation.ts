import { UserMode, File, Object, duplicateFile, FileCalculationContext } from '@casual-simulation/aux-common';
import { BuilderNewFileDragOperation } from '../DragOperation/BuilderNewFileDragOperation';
import { BaseFileDragOperation } from '../../../shared/interaction/DragOperation/BaseFileDragOperation';
import { BaseFileClickOperation } from '../../../shared/interaction/ClickOperation/BaseFileClickOperation';
import { BuilderInteractionManager } from '../BuilderInteractionManager';
import GameView from '../../GameView/GameView';

/**
 * New File Click Operation handles clicking of files that are in the file queue.
 */
export class BuilderNewFileClickOperation extends BaseFileClickOperation {

    // This overrides the base class BaseInteractionManager
    protected _interaction: BuilderInteractionManager;
    // This overrides the base class IGameView
    protected _gameView: GameView;

    constructor(gameView: GameView, interaction: BuilderInteractionManager, file: File) {
        super(gameView, interaction, file, null);
    }
    
    protected _performClick(): void {
        // Do nothing by default.
    }

    protected _createDragOperation(): BaseFileDragOperation {
        let duplicatedFile = duplicateFile(<Object>this._file);
        return new BuilderNewFileDragOperation(this._gameView, this._interaction, duplicatedFile, this._file);
    }

    protected _canDragFile(calc: FileCalculationContext, file: File) {
        return true;
    }
}