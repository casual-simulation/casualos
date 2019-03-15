
import { BuilderFileDragOperation } from '../DragOperation/BuilderFileDragOperation';
import { Intersection } from 'three';
import {
    UserMode,
    File,
    duplicateFile,
    FileCalculationContext,
    getFileIndex,
    getFilePosition,
    objectsAtContextGridPosition,
    isFileMovable
} from '@yeti-cgi/aux-common';
import { appManager } from '../../../shared/AppManager';
import { BaseFileClickOperation } from '../../../shared/interaction/ClickOperation/BaseFileClickOperation';
import { BaseFileDragOperation } from '../../../shared/interaction/DragOperation/BaseFileDragOperation';
import { AuxFile3D } from '../../../shared/scene/AuxFile3D';
import { ContextGroup3D } from '../../../shared/scene/ContextGroup3D';
import { BuilderGroup3D } from '../../../shared/scene/BuilderGroup3D';
import { BuilderInteractionManager } from '../BuilderInteractionManager';
import GameView from '../../GameView/GameView';

/**
 * File Click Operation handles clicking of files for mouse and touch input with the primary (left/first finger) interaction button.
 */
export class BuilderFileClickOperation extends BaseFileClickOperation {

    // This overrides the base class BaseInteractionManager
    protected _interaction: BuilderInteractionManager;
    // This overrides the base class IGameView
    protected _gameView: GameView;

    private _hit: Intersection;

    constructor(mode: UserMode, gameView: GameView, interaction: BuilderInteractionManager, file: AuxFile3D | ContextGroup3D, hit: Intersection) {
        super(mode, gameView, interaction, file.file, file);
        this._file3D = file;
        this._hit = hit;
    }

    protected _getWorkspace(): BuilderGroup3D | null {
        return this._file3D instanceof BuilderGroup3D ? this._file3D : null;
    }

    protected _createDragOperation(calc: FileCalculationContext): BaseFileDragOperation {
        // TODO: Be able to use different domains
        const workspace = this._getWorkspace();
        if (!workspace) {
            const file3D: AuxFile3D = <AuxFile3D>this._file3D;
            const context = file3D.context;
            const fileWorkspace = this._interaction.findWorkspaceForMesh(this._file3D);
            const position = getFilePosition(calc, file3D.file, context);
            if (fileWorkspace && position) {
                const objects = objectsAtContextGridPosition(calc, context, position);
                if (objects.length === 0) {
                    console.log('Found no objects at', position);
                    console.log(file3D.file);
                    console.log(context);
                }
                const file = this._file;
                const index = getFileIndex(calc, file, file3D.context);
                const draggedObjects = objects.filter(o => getFileIndex(calc, o, context) >= index)
                    .map(o => o);
                return new BuilderFileDragOperation(this._gameView, this._interaction, this._hit, draggedObjects, <BuilderGroup3D>workspace, file3D.context);
            }
        }
        return new BuilderFileDragOperation(this._gameView, this._interaction, this._hit, [this._file3D.file], <BuilderGroup3D>workspace, null);
    }

    protected _performClick(calc: FileCalculationContext): void {
        const workspace = this._getWorkspace();
        // If we let go of the mouse button without starting a drag operation, this constitues a 'click'.
        if (!workspace) {

            if (this._interaction.isInCorrectMode(this._file3D)) {
                // Select the file we are operating on.
                this._interaction.selectFile(<AuxFile3D>this._file3D);
            }

            // If we're clicking on a workspace show the context menu for it.
        } else if(workspace) {

            if (!this._interaction.isInCorrectMode(this._file3D) && this._gameView.selectedRecentFile) {
                // Create file at clicked workspace position.
                let workspaceMesh = workspace.surface;
                let closest = workspaceMesh.closestTileToPoint(this._hit.point);

                if (closest) {
                    const context = this._interaction.firstContextInWorkspace(workspace);
                    let newFile = duplicateFile(this._gameView.selectedRecentFile, {
                        tags: {
                            [context]: true,
                            [`${context}.x`]: closest.tile.gridPosition.x,
                            [`${context}.y`]: closest.tile.gridPosition.y,
                            [`${context}.z`]: closest.tile.localPosition.y,
                            [`${context}.index`]: 0
                        }
                    });

                    appManager.fileManager.createFile(newFile.id, newFile.tags);
                }
            } else {
                this._interaction.showContextMenu(calc);
            }
        }
    }

    protected _canDragFile(calc: FileCalculationContext, file: File): boolean {
        if (file.tags['aux.builder.context']) {
            // Workspaces are always movable.
            return true;
        } else {
            return this._interaction.isInCorrectMode(this._file3D) && isFileMovable(calc, file);
        }
    }
}