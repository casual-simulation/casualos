import { Input, InputType, MouseButtonId } from '../../game-engine/Input';
import { File3D } from '../../game-engine/File3D';
import { FileDragOperation } from '../DragOperation/FileDragOperation';
import { Vector2, Vector3, Intersection } from 'three';
import { IOperation } from '../IOperation';
import GameView from '../../GameView/GameView';
import { InteractionManager } from '../InteractionManager';
import { UserMode, File } from 'common/Files';
import { Physics } from '../../game-engine/Physics';
import { WorkspaceMesh } from '../../game-engine/WorkspaceMesh';
import { appManager } from '../../AppManager';
import { merge } from 'common/utils';
import { NewFileDragOperation } from '../DragOperation/NewFileDragOperation';
import { BaseFileDragOperation } from '../DragOperation/BaseFileDragOperation';
import { BaseFileClickOperation } from './BaseFileClickOperation';

/**
 * New File Click Operation handles clicking of files that are in the file queue.
 */
export class NewFileClickOperation extends BaseFileClickOperation {

    constructor(mode: UserMode, gameView: GameView, interaction: InteractionManager, file: File) {
        super(mode, gameView, interaction, file);
    }
    
    protected _performClick(): void {
        // Do nothing by default.
    }

    protected _createDragOperation(): BaseFileDragOperation {
        return new NewFileDragOperation(this._gameView, this._interaction, this._file);
    }

    protected _canDragFile(file: File) {
        return true;
    }
}