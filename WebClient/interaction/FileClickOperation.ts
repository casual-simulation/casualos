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

/**
 * File Click Operation handles clicking of files for mouse and touch input with the primary (left/first finger) interaction button.
 */
export class FileClickOperation implements IOperation {

    public static readonly DragThreshold: number = 0.03;

    private _gameView: GameView;
    private _interaction: InteractionManager;
    private _mode: UserMode;
    private _file: File3D;
    // private _input: Input;
    private _hit: Intersection;
    private _finished: boolean;
    private _triedDragging: boolean;

    private _startScreenPos: Vector2;
    private _dragOperation: FileDragOperation;

    constructor(mode: UserMode, gameView: GameView, interaction: InteractionManager, file: File3D, hit: Intersection) {
        this._gameView = gameView;
        this._interaction = interaction;
        this._file = file;
        this._hit = hit;
        this._mode = mode;
        
        // Store the screen position of the input when the click occured.
        this._startScreenPos = this._gameView.input.getMouseScreenPos();
    }

    public update(): void {
        if (this._finished) return;

        if (this._gameView.input.getMouseButtonHeld(0)) {
            
            if (!this._dragOperation) {
                
                const curScreenPos = this._gameView.input.getMouseScreenPos();
                const distance = curScreenPos.distanceTo(this._startScreenPos);

                if (distance >= FileClickOperation.DragThreshold) {
                    // Start dragging now that we've crossed the threshold.
                    const workspace = this._file.file.type === 'workspace' ? this._file : null;

                    this._triedDragging = true;

                    if (this._interaction.isInCorrectMode(this._file.file) && this.canDragFile(this._file.file)) {
                        this._dragOperation = new FileDragOperation(this._gameView, this._interaction, this._hit, this._file, workspace);
                    }
                }

            } else {

                if (this._dragOperation.isFinished()) {
                    this._dragOperation.dispose();
                    this._dragOperation = null;
                } else {
                    this._dragOperation.update();
                }
            }

        } else {

            if (!this._dragOperation && !this._triedDragging) {
                // If we let go of the mouse button without starting a drag operation, this constitues a 'click'.
                if (this._file.file.type === 'object') {

                    if (this._interaction.isInCorrectMode(this._file.file)) {
                        // Select the file we are operating on.
                        this._interaction.selectFile(this._file);
                    }

                    // If we're clicking on a workspace show the context menu for it.
                } else if(this._file.file.type === 'workspace') {

                    if (!this._interaction.isInCorrectMode(this._file.file) && this._gameView.selectedRecentFile) {
                        // Create file at clicked workspace position.
                        let workspaceMesh = <WorkspaceMesh>this._file.mesh;
                        let closest = workspaceMesh.closestTileToPoint(this._hit.point);

                        if (closest) {
                            let tags = {
                              _position: { x: closest.tile.gridPosition.x, y: closest.tile.gridPosition.y, z: closest.tile.localPosition.y },
                              _workspace: this._file.file.id,
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

            // Button has been released. This click operation is finished.
            this.finish();
        }
    }

    public isFinished(): boolean {
        return this._finished;
    }

    public dispose(): void {

        // Make sure to dispose of drag rules if they exist.
        if (this._dragOperation) {
            this._dragOperation.dispose();
            this._dragOperation = null;
        }

    }

    public finish() {
        this._finished = true;
    }

    canDragFile(file: File) {
        if (file.type === 'workspace') {
            // Workspaces are always movable.
            return true;
        } else {
            const hasTag = typeof file.tags._movable !== 'undefined';
            if (hasTag) {
                // Movability is determined by the result of the calculation
                const movable = this._gameView.fileManager.calculateFileValue(file, '_movable');
                return !!movable;
            } else {
                // File is movable because that is the default
                return true;
            }
        }
    }
}