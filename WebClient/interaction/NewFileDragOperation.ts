import { Input } from '../game-engine/Input';
import { File3D } from '../game-engine/File3D';
import { IOperation } from './IOperation';
import GameView from '../GameView/GameView';
import { InteractionManager } from './InteractionManager';
import { Ray, Intersection, Vector2, Vector3, Box3 } from 'three';
import { Physics } from '../game-engine/Physics';
import { WorkspaceMesh } from '../game-engine/WorkspaceMesh';
import { File, Workspace, Object, DEFAULT_WORKSPACE_SCALE, fileRemoved, fileUpdated, PartialFile, fileAdded, FileEvent } from 'common/Files';
import { keys, minBy, flatMap } from 'lodash';
import { keyToPos, gridPosToRealPos, realPosToGridPos, Axial, gridDistance, posToKey } from '../game-engine/hex';
import { isFormula, duplicateFile, createFile } from 'common/Files/FileCalculations';
import { SharedFileDragOperation } from './SharedFileDragOperation';
import { appManager } from 'WebClient/AppManager';
import { merge } from 'common/utils';

/**
 * New File Drag Operation handles dragging of new files from the file queue.
 */
export class NewFileDragOperation extends SharedFileDragOperation {

    private _newFile: File;

    /**
     * Create a new drag rules.
     * @param input the input module to interface with.
     * @param buttonId the button id of the input that this drag operation is being performed with. If desktop this is the mouse button
     */
    constructor(gameView: GameView, interaction: InteractionManager, file: File) {
        super(gameView, interaction, [file]);
    }

    protected _updateFile(file: File, data: PartialFile): FileEvent {
        if (!this._newFile) {
            const newFile = duplicateFile(<Object>file, data);
            this._newFile = createFile(newFile.id, newFile.tags);
            return fileAdded(this._newFile);
        } else {
            return super._updateFile(this._newFile, data);
        }
    }

    protected _calcuateDragPosition(workspace: File3D, gridPosition: Vector2) {
        return this._interaction.calculateFileDragPosition(workspace, gridPosition, <Object>(this._newFile || this._file));
    }

    protected _combineFiles(eventName: string) {
        if (this._newFile) {
            this._gameView.fileManager.action(this._newFile, this._other, eventName);
        }
    }
}