import { Input, InputType, MouseButtonId } from '../game-engine/input';
import { File3D } from '../game-engine/Interfaces';
import { FileDragOperation } from './FileDragOperation';
import { Vector2, Vector3, Intersection } from 'three';
import { IOperation } from './IOperation';
import GameView from '../GameView/GameView';
import { InteractionManager } from './InteractionManager';

/**
 * File Click Operation handles clicking of files for mouse and touch input with the primary (left/first finger) interaction button.
 */
export class FileClickOperation implements IOperation {

    public static readonly DragThreshold: number = 0.03;

    private _gameView: GameView;
    private _interaction: InteractionManager;
    private _file: File3D;
    private _hit: Intersection;
    private _finished: boolean;

    private _startScreenPos: Vector2;
    private _dragOperation: FileDragOperation;

    constructor(gameView: GameView, interaction: InteractionManager, file: File3D, hit: Intersection) {
        this._gameView = gameView;
        this._interaction = interaction;
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

                if (distance >= FileClickOperation.DragThreshold) {
                    // Start dragging now that we've crossed the threshold.
                    const workspace = this._interaction.findWorkspaceForIntersection(this._hit);
                    this._dragOperation = new FileDragOperation(this._gameView, this._interaction, this._file, workspace);
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

            if (!this._dragOperation) {
                // If we let go of the mouse button without starting a drag operation, this constitues a 'click'.
                if (this._file.file.type === 'object') {
                    // Select the file we are operating on.
                    this._interaction.selectFile(this._file);
                }
            }

            // Button has been released. This click operation is finished.
            this._finished = true;
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
}