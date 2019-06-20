import { Input } from '../../../shared/scene/Input';
import { Vector2 } from 'three';
import { IOperation } from '../../../shared/interaction/IOperation';
import {
    DEFAULT_SCENE_BACKGROUND_COLOR,
    FileCalculationContext,
} from '@casual-simulation/aux-common';
import { appManager } from '../../../shared/AppManager';
import { VRController3D, Pose } from '../../../shared/scene/vr/VRController3D';
import { BaseInteractionManager } from '../BaseInteractionManager';
import { Game } from '../../../shared/scene/Game';
import {
    VRDragThresholdPassed,
    DragThresholdPassed,
} from './ClickOperationUtils';

/**
 * Empty Click Operation handles clicking of empty space for mouse and touch input with the primary (left/first finger) interaction button.
 */
export abstract class BaseEmptyClickOperation implements IOperation {
    protected _interaction: BaseInteractionManager;
    protected _game: Game;
    protected _finished: boolean;
    protected _vrController: VRController3D;

    protected _startScreenPos: Vector2;
    protected _startVRControllerPose: Pose;

    get simulation() {
        return appManager.simulationManager.primary;
    }

    constructor(
        game: Game,
        interaction: BaseInteractionManager,
        vrController: VRController3D | null
    ) {
        this._game = game;
        this._interaction = interaction;
        this._vrController = vrController;

        if (this._vrController) {
            // Store the pose of the vr controller when the click occured.
            this._startVRControllerPose = this._vrController.worldPose.clone();
        } else {
            // Store the screen position of the input when the click occured.
            this._startScreenPos = this._game.getInput().getMouseScreenPos();
        }
    }

    public update(calc: FileCalculationContext): void {
        if (this._finished) return;

        const buttonHeld: boolean = this._vrController
            ? this._vrController.getPrimaryButtonHeld()
            : this._game.getInput().getMouseButtonHeld(0);

        if (!buttonHeld) {
            let dragThresholdPassed: boolean = this._vrController
                ? VRDragThresholdPassed(
                      this._startVRControllerPose,
                      this._vrController.worldPose
                  )
                : DragThresholdPassed(
                      this._startScreenPos,
                      this._game.getInput().getMouseScreenPos()
                  );

            if (!dragThresholdPassed) {
                this._performClick(calc);
            }

            // Button has been released. This click operation is finished.
            this._finished = true;
        }
    }

    public isFinished(): boolean {
        return this._finished;
    }

    public dispose(): void {}

    protected abstract _performClick(calc: FileCalculationContext): void;
}
