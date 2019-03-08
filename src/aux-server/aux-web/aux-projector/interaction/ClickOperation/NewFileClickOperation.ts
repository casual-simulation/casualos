import GameView from '../../GameView/GameView';
import { InteractionManager } from '../InteractionManager';
import { UserMode, File, Object, duplicateFile } from '@yeti-cgi/aux-common';
import { NewFileDragOperation } from '../DragOperation/NewFileDragOperation';
import { BaseFileDragOperation } from '../DragOperation/BaseFileDragOperation';
import { BaseFileClickOperation } from './BaseFileClickOperation';

/**
 * New File Click Operation handles clicking of files that are in the file queue.
 */
export class NewFileClickOperation extends BaseFileClickOperation {

    constructor(mode: UserMode, gameView: GameView, interaction: InteractionManager, file: File) {
        super(mode, gameView, interaction, file, null);
    }
    
    protected _performClick(): void {
        // Do nothing by default.
    }

    protected _createDragOperation(): BaseFileDragOperation {
        let duplicatedFile = duplicateFile(<Object>this._file);
        return new NewFileDragOperation(this._gameView, this._interaction, duplicatedFile);
    }

    protected _canDragFile(file: File) {
        return true;
    }
}