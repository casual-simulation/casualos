import { Input } from '../../game-engine/Input';
import { File3D } from '../../game-engine/File3D';
import { IOperation } from '../IOperation';
import GameView from '../../GameView/GameView';
import { InteractionManager } from '../InteractionManager';
import { Ray, Intersection, Vector2, Vector3, Box3 } from 'three';
import { Physics } from '../../game-engine/Physics';
import { WorkspaceMesh } from '../../game-engine/WorkspaceMesh';
import { File, Workspace, Object, DEFAULT_WORKSPACE_SCALE, fileRemoved, fileUpdated, PartialFile, fileAdded, FileEvent } from 'aux-common/Files';
import { keys, minBy, flatMap } from 'lodash';
import { keyToPos, gridPosToRealPos, realPosToGridPos, Axial, gridDistance, posToKey } from '../../game-engine/hex';
import { isFormula, duplicateFile, createFile } from 'aux-common/Files/FileCalculations';
import { BaseFileDragOperation } from './BaseFileDragOperation';
import { appManager } from '../../AppManager';
import { merge } from 'aux-common/utils';
import { FileMesh } from '../../game-engine/FileMesh';

/**
 * New File Drag Operation handles dragging of new files from the file queue.
 */
export class NewFileDragOperation extends BaseFileDragOperation {

    private _newFile: File;
    private _initialDragMesh: FileMesh;
    

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

    // protected _dragFilesFree(): void {
    //     // File has not been added yet, do a custom drag implementation until we add it by placing it over a workspace.
    //     if (!this._initialDragMesh) {
    //         // Instance a file mesh to represent the file in its intial drag state before being added to the world.
    //         this._initialDragMesh = new FileMesh(this._gameView);
    //         this._gameView.scene.add(this._initialDragMesh);
    //         this._initialDragMesh.update(this._file);
    //     }

    //     const mouseDir = Physics.screenPosToRay(this._gameView.input.getMouseScreenPos(), this._gameView.camera);
    //     let worldPos = Physics.pointOnRay(mouseDir, this._freeDragDistance);
    // }

    protected _calculateDragPosition(workspace: File3D, gridPosition: Vector2) {
        return this._interaction.calculateFileDragPosition(workspace, gridPosition, <Object>(this._newFile || this._file));
    }

    protected _combineFiles(eventName: string) {
        if (this._newFile) {
            this._gameView.fileManager.action(this._newFile, this._other, eventName);
        }
    }
}