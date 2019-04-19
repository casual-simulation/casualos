import { Input, InputType, MouseButtonId } from '../../../shared/scene/Input';
import { Vector2, Vector3, Intersection } from 'three';
import { IOperation } from '../IOperation';
import { BaseInteractionManager } from '../BaseInteractionManager';
import {
    UserMode,
    File,
    FileCalculationContext,
    AuxFile,
    isFileMovable,
} from '@casual-simulation/aux-common';
import { BaseFileDragOperation } from '../DragOperation/BaseFileDragOperation';
import { AuxFile3D } from '../../../shared/scene/AuxFile3D';
import { ContextGroup3D } from '../../../shared/scene/ContextGroup3D';
import { IGameView } from '../../../shared/IGameView';

/**
 * File Click Operation handles clicking of files for mouse and touch input with the primary (left/first finger) interaction button.
 */
export abstract class BaseFileClickOperation implements IOperation {
    public static readonly DragThreshold: number = 0.03;

    protected _gameView: IGameView;
    protected _interaction: BaseInteractionManager;
    protected _file: File;
    protected _file3D: AuxFile3D | ContextGroup3D | null;
    protected _finished: boolean;
    protected _triedDragging: boolean;

    protected _startScreenPos: Vector2;
    protected _dragOperation: BaseFileDragOperation;

    constructor(
        gameView: IGameView,
        interaction: BaseInteractionManager,
        file: File,
        file3D: AuxFile3D | ContextGroup3D | null
    ) {
        this._gameView = gameView;
        this._interaction = interaction;
        this._file = file;
        this._file3D = file3D;

        // Store the screen position of the input when the click occured.
        this._startScreenPos = this._gameView.getInput().getMouseScreenPos();
    }

    public update(calc: FileCalculationContext): void {
        if (this._finished) return;

        // Update drag operation if one is active.
        if (this._dragOperation) {
            if (this._dragOperation.isFinished()) {
                this._dragOperation.dispose();
                this._dragOperation = null;
            } else {
                this._dragOperation.update(calc);
            }
        }

        // If using touch, need to make sure we are only ever using one finger at a time.
        // If a second finger is detected then we cancel this click operation.
        if (this._gameView.getInput().currentInputType === InputType.Touch) {
            if (this._gameView.getInput().getTouchCount() >= 2) {
                this._finished = true;
                return;
            }
        }

        if (this._gameView.getInput().getMouseButtonHeld(0)) {
            if (!this._dragOperation) {
                const curScreenPos = this._gameView
                    .getInput()
                    .getMouseScreenPos();
                const distance = curScreenPos.distanceTo(this._startScreenPos);

                if (distance >= BaseFileClickOperation.DragThreshold) {
                    // Attempt to start dragging now that we've crossed the threshold.
                    this._triedDragging = true;

                    if (this._canDragFile(calc, this._file)) {
                        this._dragOperation = this._createDragOperation(calc);
                    } else {
                        // Finish the click operation because we tried dragging but could not
                        // actually drag anything.
                        this._finished = true;
                    }
                }
            }
        } else {
            if (!this._dragOperation && !this._triedDragging) {
                this._performClick(calc);
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

    protected _canDragFile(calc: FileCalculationContext, file: File): boolean {
        return isFileMovable(calc, file);
    }

    protected abstract _performClick(calc: FileCalculationContext): void;
    protected abstract _createDragOperation(
        calc: FileCalculationContext
    ): BaseFileDragOperation;
}
