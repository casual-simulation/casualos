import { InputType } from '../../../shared/scene/Input';
import { Vector2 } from 'three';
import { IOperation } from '../IOperation';
import { BaseInteractionManager } from '../BaseInteractionManager';
import {
    Bot,
    BotCalculationContext,
    isBotMovable,
    getBotPosition,
} from '@casual-simulation/aux-common';
import { BaseBotDragOperation } from '../DragOperation/BaseBotDragOperation';
import { AuxBot3D } from '../../../shared/scene/AuxBot3D';
import { ContextGroup3D } from '../../../shared/scene/ContextGroup3D';
import { Simulation3D } from '../../scene/Simulation3D';
import { VRController3D, Pose } from '../../../shared/scene/vr/VRController3D';
import {
    VRDragThresholdPassed,
    DragThresholdPassed,
} from './ClickOperationUtils';

/**
 * Bot Click Operation handles clicking of bots for mouse and touch input with the primary (left/first finger) interaction button.
 */
export abstract class BaseBotClickOperation implements IOperation {
    protected _simulation3D: Simulation3D;
    protected _interaction: BaseInteractionManager;
    protected _bot: Bot;
    protected _bot3D: AuxBot3D | ContextGroup3D | null;
    protected _finished: boolean;
    protected _triedDragging: boolean;
    protected _vrController: VRController3D;

    protected _startScreenPos: Vector2;
    protected _startBotPos: Vector2 = null;
    protected _startVRControllerPose: Pose;
    protected _dragOperation: BaseBotDragOperation;

    protected heldTime: number;
    protected isMobile: boolean;

    protected get game() {
        return this._simulation3D.game;
    }

    get simulation() {
        return this._simulation3D.simulation;
    }

    constructor(
        simulation3D: Simulation3D,
        interaction: BaseInteractionManager,
        bot: Bot,
        bot3D: AuxBot3D | ContextGroup3D | null,
        vrController: VRController3D | null
    ) {
        this._simulation3D = simulation3D;
        this._interaction = interaction;
        this._bot = bot;
        this._bot3D = bot3D;
        this._vrController = vrController;

        if (this._vrController) {
            // Store the pose of the vr controller when the click occured.
            this._startVRControllerPose = this._vrController.worldPose.clone();
        } else {
            // Store the screen position of the input when the click occured.
            this._startScreenPos = this.game.getInput().getMouseScreenPos();
        }

        this.isMobile =
            !vrController && this.game.getInput().getTouchCount() > 0;
        this.heldTime = 0;
    }

    public update(calc: BotCalculationContext): void {
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

        if (!this._vrController) {
            // If using touch, need to make sure we are only ever using one finger at a time.
            // If a second finger is detected then we cancel this click operation.
            if (this.game.getInput().currentInputType === InputType.Touch) {
                if (this.game.getInput().getTouchCount() >= 2) {
                    this._finished = true;
                    return;
                }
            }
        }

        const buttonHeld: boolean = this._vrController
            ? this._vrController.getPrimaryButtonHeld()
            : this.game.getInput().getMouseButtonHeld(0);

        if (buttonHeld) {
            if (
                this._startBotPos === null &&
                this._bot3D != null &&
                this._bot3D.display != null
            ) {
                let tempPos = getBotPosition(
                    calc,
                    this._bot3D.bot,
                    (this._bot3D as AuxBot3D).context
                );
                this._startBotPos = new Vector2(
                    Math.round(tempPos.x),
                    Math.round(tempPos.y)
                );
            }

            this.heldTime++;
            if (!this._dragOperation) {
                let dragThresholdPassed: boolean = this._vrController
                    ? VRDragThresholdPassed(
                          this._startVRControllerPose,
                          this._vrController.worldPose
                      )
                    : DragThresholdPassed(
                          this._startScreenPos,
                          this.game.getInput().getMouseScreenPos()
                      );

                if (dragThresholdPassed) {
                    // Attempt to start dragging now that we've crossed the threshold.
                    this._triedDragging = true;

                    // Returns true (can drag) if either aux.movable or aux.pickupable are true
                    if (this._canDragBot(calc, this._bot)) {
                        this._dragOperation = this._createDragOperation(
                            calc,
                            this._startBotPos
                        );
                    } else {
                        // Finish the click operation because we tried dragging but could not
                        // actually drag anything.
                        this._finished = true;
                    }
                }
            }
        } else {
            if (!this._dragOperation && !this._triedDragging) {
                // If not mobile, allow click no matter how long you've held on bot, if mobile stop click if held too long
                if (!this.isMobile || this.heldTime < 30) {
                    this._performClick(calc);
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

    protected _canDragBot(calc: BotCalculationContext, bot: Bot): boolean {
        return isBotMovable(calc, bot);
    }

    protected abstract _performClick(calc: BotCalculationContext): void;
    protected abstract _createDragOperation(
        calc: BotCalculationContext,
        fromPos?: Vector2
    ): BaseBotDragOperation;
}
