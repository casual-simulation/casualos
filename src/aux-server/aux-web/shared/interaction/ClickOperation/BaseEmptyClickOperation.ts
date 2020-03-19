import {
    Input,
    InputMethod,
    ControllerData,
} from '../../../shared/scene/Input';
import { Vector2, Object3D } from 'three';
import { IOperation } from '../../../shared/interaction/IOperation';
import {
    DEFAULT_SCENE_BACKGROUND_COLOR,
    BotCalculationContext,
} from '@casual-simulation/aux-common';
import { appManager } from '../../../shared/AppManager';
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
    protected _sentDownEvent: boolean;
    protected _controller: ControllerData;

    protected _startScreenPos: Vector2;
    protected _startVRControllerPose: Object3D;

    get simulation() {
        return appManager.simulationManager.primary;
    }

    constructor(
        game: Game,
        interaction: BaseInteractionManager,
        inputMethod: InputMethod
    ) {
        this._game = game;
        this._interaction = interaction;
        this._controller =
            inputMethod.type === 'controller' ? inputMethod.controller : null;

        if (this._controller) {
            // Store the pose of the vr controller when the click occured.
            this._startVRControllerPose = this._controller.ray.clone();
        } else {
            // Store the screen position of the input when the click occured.
            this._startScreenPos = this._game.getInput().getMouseScreenPos();
        }

        this._interaction.hideContextMenu();
    }

    public update(calc: BotCalculationContext): void {
        if (this._finished) return;

        if (!this._sentDownEvent) {
            this._performDown(calc);
            this._sentDownEvent = true;
        }

        const input = this._game.getInput();
        const buttonHeld: boolean = this._controller
            ? input.getControllerPrimaryButtonHeld(this._controller)
            : input.getMouseButtonHeld(0);

        if (!buttonHeld) {
            let dragThresholdPassed: boolean = this._controller
                ? VRDragThresholdPassed(
                      this._startVRControllerPose,
                      this._controller.ray
                  )
                : DragThresholdPassed(
                      this._startScreenPos,
                      this._game.getInput().getMouseScreenPos()
                  );

            if (!dragThresholdPassed) {
                this._performClick(calc);
            }

            this._performUp(calc);

            // Button has been released. This click operation is finished.
            this._finished = true;
        }
    }

    public isFinished(): boolean {
        return this._finished;
    }

    public dispose(): void {}

    /**
     * Sends the empty click event. (onGridClick)
     * @param calc
     */
    protected abstract _performClick(calc: BotCalculationContext): void;

    /**
     * Sends the empty up event. (onGridUp)
     * @param calc
     */
    protected abstract _performUp(calc: BotCalculationContext): void;

    /**
     * Sends the empty down event. (onGridDown)
     * @param calc
     */
    protected abstract _performDown(calc: BotCalculationContext): void;
}
