import {
    InputType,
    ControllerData,
    InputMethod,
    InputModality,
} from '../../../shared/scene/Input';
import {
    Vector2,
    Object3D,
    Intersection,
    Sphere,
} from '@casual-simulation/three';
import { IOperation } from '../IOperation';
import { BaseInteractionManager } from '../BaseInteractionManager';
import { Bot, BotCalculationContext } from '@casual-simulation/aux-common';
import { BaseBotDragOperation } from '../DragOperation/BaseBotDragOperation';
import { AuxBot3D } from '../../../shared/scene/AuxBot3D';
import { DimensionGroup3D } from '../../../shared/scene/DimensionGroup3D';
import { Simulation3D } from '../../scene/Simulation3D';
import {
    VRDragThresholdPassed,
    DragThresholdPassed,
    FingerClickThreshold,
    MaxFingerClickTimeMs,
} from './ClickOperationUtils';

/**
 * Base Click Operation handles clicks in the 3D scene.
 */
export abstract class BaseClickOperation implements IOperation {
    protected _simulation3D: Simulation3D;
    protected _interaction: BaseInteractionManager;
    protected _finished: boolean;
    protected _triedDragging: boolean;
    protected _controller: ControllerData;
    protected _inputMethod: InputMethod;
    protected _inputModality: InputModality;

    protected _startScreenPos: Vector2;
    protected _startVRControllerPose: Object3D;
    protected _startFingerPose: Sphere;
    protected _dragOperation: IOperation;
    protected _hit: Intersection;

    protected _heldTimeMs: number;
    protected _heldFrames: number;
    protected isMobile: boolean;

    get modality() {
        return this._inputModality;
    }

    protected get game() {
        return this._simulation3D.game;
    }

    get simulation() {
        return this._simulation3D.simulation;
    }

    /**
     * Gets whether this click operation has been replaced by a drag operation.
     */
    get replaced() {
        return !!this._dragOperation;
    }

    constructor(
        simulation3D: Simulation3D,
        interaction: BaseInteractionManager,
        inputMethod: InputMethod,
        inputModality: InputModality,
        hit?: Intersection
    ) {
        this._simulation3D = simulation3D;
        this._interaction = interaction;
        this._inputMethod = inputMethod;
        this._inputModality = inputModality;
        this._controller =
            inputMethod.type === 'controller' ? inputMethod.controller : null;
        this._hit = hit;

        if (this._controller) {
            // Store the pose of the vr controller when the click occured.
            this._startVRControllerPose = this._controller.ray.clone();
        } else {
            // Store the screen position of the input when the click occured.
            this._startScreenPos = this.game.getInput().getMouseScreenPos();
        }

        if (this._inputModality.type === 'finger') {
            this._startFingerPose = this._inputModality.pose.clone();
        }

        this.isMobile =
            inputMethod.type === 'mouse_or_touch' &&
            this.game.getInput().getTouchCount() > 0;
        this._heldTimeMs = 0;
        this._heldFrames = 0;
    }

    public update(calc: BotCalculationContext): void {
        if (this._finished) return;

        // Update drag operation if one is active.
        if (this._dragOperation) {
            if (this._dragOperation.isFinished()) {
                this._dragOperation.dispose();
                this._dragOperation = null;
                this._finished = true;
                return;
            } else {
                this._dragOperation.update(calc);
            }
        }

        if (!this._controller) {
            // If using touch, need to make sure we are only ever using one finger at a time.
            // If a second finger is detected then we cancel this click operation.
            if (this.game.getInput().currentInputType === InputType.Touch) {
                if (this.game.getInput().getTouchCount() >= 2) {
                    this._finished = true;
                    return;
                }
            }
        }

        const input = this.game.getInput();

        const buttonHeld: boolean = this._controller
            ? input.getControllerPrimaryButtonHeld(this._controller)
            : input.getMouseButtonHeld(0);

        this._heldTimeMs += this.game.getTime().deltaTime * 1000;
        if (buttonHeld && this._inputModality.type !== 'finger') {
            this._heldFrames++;
            if (!this._dragOperation) {
                let dragThresholdPassed: boolean = this._controller
                    ? VRDragThresholdPassed(
                          this._startVRControllerPose,
                          this._controller.ray
                      )
                    : DragThresholdPassed(
                          this._startScreenPos,
                          this.game.getInput().getMouseScreenPos()
                      );

                if (dragThresholdPassed) {
                    this._interaction.hideContextMenu();

                    // Attempt to start dragging now that we've crossed the threshold.
                    this._triedDragging = true;

                    // Returns true (can drag) if either draggable or aux.pickupable are true
                    if (this._canDrag(calc)) {
                        this._dragOperation =
                            this._baseCreateDragOperation(calc);

                        if (!this._dragOperation) {
                            this._finished = true;
                        }
                    } else {
                        // Finish the click operation because we tried dragging but could not
                        // actually drag anything.
                        this._finished = true;
                    }
                }
            }
        } else {
            if (this._inputModality.type === 'finger') {
                const finger = this._controller.fingerTips.get(
                    `${this._inputModality.finger}-finger-tip` as any
                );
                if (!finger) {
                    // We lost tracking on the finger. This click operation is finished.
                    this._finished = true;
                    console.log('[BaseClickOperation] Finger lost track!');
                } else {
                    const deactivationSphere = new Sphere(
                        finger.center.clone(),
                        finger.radius + FingerClickThreshold
                    );
                    const intersections =
                        this._interaction.findIntersectedGameObject(
                            deactivationSphere,
                            (obj) =>
                                obj.id ===
                                this._interaction.findGameObjectForHit(
                                    this._hit
                                )?.id
                        );

                    if (!intersections.gameObject) {
                        if (this._heldTimeMs < MaxFingerClickTimeMs) {
                            this._performClick(calc);
                        } else {
                            console.log(
                                '[BaseClickOperation] Click took too long!'
                            );
                        }
                        this._finished = true;
                    }
                }
            } else {
                if (!this._dragOperation && !this._triedDragging) {
                    // If not mobile, allow click no matter how long you've held on bot, if mobile stop click if held too long
                    if (!this.isMobile || this._heldFrames < 30) {
                        this._performClick(calc);
                    }
                }

                // Button has been released. This click operation is finished.
                this._finished = true;
            }
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

    protected _canDrag(calc: BotCalculationContext): boolean {
        return true;
    }

    protected abstract _performClick(calc: BotCalculationContext): void;
    protected abstract _baseCreateDragOperation(
        calc: BotCalculationContext
    ): IOperation;
}
