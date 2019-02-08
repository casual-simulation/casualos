import { Input, InputType, MouseButtonId } from '../game-engine/Input';
import { File3D } from '../game-engine/File3D';
import { FileDragOperation } from './FileDragOperation';
import { Vector2, Vector3, Intersection, Raycaster } from 'three';
import { IOperation } from './IOperation';
import GameView from '../GameView/GameView';
import { InteractionManager } from './InteractionManager';
import { UserMode, File } from 'common/Files';
import { Physics } from '../game-engine/Physics';

/**
 * Empty Click Operation handles clicking of empty space for mouse and touch input with the primary (left/first finger) interaction button.
 */
export class EmptyClickOperation implements IOperation {

    public static readonly DragThreshold: number = 0.02;

    private _gameView: GameView;
    private _interaction: InteractionManager;
    private _finished: boolean;
    private _startScreenPos: Vector2;

    constructor(gameView: GameView, interaction: InteractionManager) {
        this._gameView = gameView;
        this._interaction = interaction;

        // Store the screen position of the input when the click occured.
        this._startScreenPos = this._gameView.input.getMouseScreenPos();
    }

    public update(): void {
        if (this._finished) return;

        if (!this._gameView.input.getMouseButtonHeld(0)) {
            
            const curScreenPos = this._gameView.input.getMouseScreenPos();
            const distance = curScreenPos.distanceTo(this._startScreenPos);

            if (distance < EmptyClickOperation.DragThreshold) {

                if (this._interaction.mode === 'worksurfaces') {

                    // When we release the empty click, make sure we are still over nothing.
                    const screenPos = this._gameView.input.getMouseScreenPos();
                    const raycastResult = Physics.raycastAtScreenPos(screenPos, new Raycaster(), this._interaction.getDraggableObjects(), this._gameView.camera);
                    const clickedObject = Physics.firstRaycastHit(raycastResult);
    
                    if (!clickedObject) {
                        // Still not clicking on anything.
                        this._interaction.sceneBackgroundColorPicker(this._gameView.input.getMousePagePos());
                    }
                    
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

    }
}