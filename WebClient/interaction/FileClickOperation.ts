import { Input, InputType, MouseButtonId } from '../game-engine/Input';
import { File3D } from '../game-engine/Interfaces';
import { FileDragOperation } from './FileDragOperation';
import { Vector2, Vector3, Intersection } from 'three';
import { IOperation } from './IOperation';
import GameView from '../GameView/GameView';
import { FileInteractionManager } from './FileInteractionManager';

/**
 * File Click Operation handles clicking of files for mouse and touch input with the primary (left/first finger) interaction button.
 */
export class FileClickOperation implements IOperation {

    public static readonly DragThreshold: number = 0.03;

    private _gameView: GameView;
    private _fileInteraction: FileInteractionManager;
    private _file: File3D;
    private _hit: Intersection;
    private _finished: boolean;

    private _startScreenPos: Vector2;
    private _dragOperation: FileDragOperation;

    constructor(gameView: GameView, fileInteraction: FileInteractionManager, file: File3D, hit: Intersection) {
        this._gameView = gameView;
        this._fileInteraction = fileInteraction;
        this._file = file;
        this._hit = hit;
        
        // Store the screen position of the input when the click occured.
        this._startScreenPos = this._gameView.input.getMouseScreenPos();
    }

    public update(): void {
        if (this._finished) return;

        if (this._gameView.input.getMouseButtonHeld(0)) {
            
            if (!this._dragOperation) {
                
                const curScreenPos = this._gameView.input.getMouseScreenPos();
                const distance = curScreenPos.distanceTo(this._startScreenPos);
                console.log("[FileClickOperation] drag threshold distance: " + distance);

                if (distance >= FileClickOperation.DragThreshold) {
                    // Start dragging now that we've crossed the threshold.
                    console.log("[FileClickOperation] start file drag operation");
                    const workspace = this._fileInteraction.findWorkspaceForIntersection(this._hit);
                    this._dragOperation = new FileDragOperation(this._gameView, this._fileInteraction, this._file, workspace);
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
            // Button has been released. This click operation is finished.
            this._finished = true;
            console.log("[FileClickOperation] finished");
        }
    }

    public isFinished(): boolean {
        return this._finished;
    }

    public dispose(): void {

        console.log("[FileClickOperation] dispose");

        // Make sure to dispose of drag rules if they exist.
        if (this._dragOperation) {
            this._dragOperation.dispose();
            this._dragOperation = null;
        }

    }
}