import { UserMode, File, Object, duplicateFile, FileCalculationContext } from '@yeti-cgi/aux-common';
import { BaseFileDragOperation } from '../../../shared/interaction/DragOperation/BaseFileDragOperation';
import { BaseFileClickOperation } from '../../../shared/interaction/ClickOperation/BaseFileClickOperation';
import GameView from '../../GameView/GameView';
import { PlayerInteractionManager } from '../PlayerInteractionManager';
import { PlayerInventoryFileDragOperation } from '../DragOperation/PlayerInventoryFileDragOperation';

/**
 * New File Click Operation handles clicking of files that are in the file queue.
 */
export class PlayerInventoryFileClickOperation extends BaseFileClickOperation {

    // This overrides the base class BaseInteractionManager
    protected _interaction: PlayerInteractionManager;
    // This overrides the base class IGameView
    protected _gameView: GameView;

    // The context that the file was in when click operation began.
    protected _context: string;

    constructor(gameView: GameView, interaction: PlayerInteractionManager, file: File, context: string) {
        super(gameView, interaction, file, null);
        this._context = context;
    }
    
    protected _performClick(): void {
        // Do nothing by default.
    }

    protected _createDragOperation(): BaseFileDragOperation {
        return new PlayerInventoryFileDragOperation(this._gameView, this._interaction, this._file, this._context);
    }

    protected _canDragFile(calc: FileCalculationContext, file: File) {
        return true;
    }
}