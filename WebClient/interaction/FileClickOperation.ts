import { Input, InputType, MouseButtonId } from '../game-engine/Input';
import { File3D } from '../game-engine/File3D';
import { FileDragOperation } from './FileDragOperation';
import { Vector2, Vector3, Intersection } from 'three';
import { IOperation } from './IOperation';
import GameView from '../GameView/GameView';
import { InteractionManager } from './InteractionManager';
import { UserMode, File } from 'common/Files';
import { Physics } from '../game-engine/Physics';
import { WorkspaceMesh } from '../game-engine/WorkspaceMesh';
import { appManager } from '../AppManager';
import { merge } from 'common/utils';
import { SharedFileClickOperation } from './SharedFileClickOperation';
import { SharedFileDragOperation } from './SharedFileDragOperation';

/**
 * File Click Operation handles clicking of files for mouse and touch input with the primary (left/first finger) interaction button.
 */
export class FileClickOperation extends SharedFileClickOperation {

    private _file3D: File3D;

    constructor(mode: UserMode, gameView: GameView, interaction: InteractionManager, file: File3D) {
        super(mode, gameView, interaction, file.file);
        this._file3D = file;
    }

    protected _createDragOperation(): SharedFileDragOperation {
        const workspace = this._file.type === 'workspace' ? this._file3D : null;
        return new FileDragOperation(this._gameView, this._interaction, this._hit, this._file, workspace);
    }

    protected _performClick(): void {
        // If we let go of the mouse button without starting a drag operation, this constitues a 'click'.
        if (this._file.type === 'object') {

            if (this._interaction.isInCorrectMode(this._file)) {
                // Select the file we are operating on.
                this._interaction.selectFile(this._file3D);
            }

            // If we're clicking on a workspace show the context menu for it.
        } else if(this._file.type === 'workspace') {

            if (!this._interaction.isInCorrectMode(this._file) && this._gameView.selectedRecentFile) {
                // Create file at clicked workspace position.
                let workspaceMesh = <WorkspaceMesh>this._file3D.mesh;
                let closest = workspaceMesh.closestTileToPoint(this._hit.point);

                if (closest) {
                    let tags = {
                      _position: { x: closest.tile.gridPosition.x, y: closest.tile.gridPosition.y, z: closest.tile.localPosition.y },
                      _workspace: this._file.id,
                      _index: 0
                    };

                    let merged = merge(this._gameView.selectedRecentFile.tags, tags);

                    appManager.fileManager.createFile(undefined, merged);
                }
            } else {
                this._interaction.showContextMenu();
            }
        }
    }
}