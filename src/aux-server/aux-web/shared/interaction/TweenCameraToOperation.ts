import { IOperation } from './IOperation';
import { BaseInteractionManager } from './BaseInteractionManager';
import { Vector3, Vector2 } from '@casual-simulation/three';
import { BotCalculationContext } from '@casual-simulation/aux-common';
import { Simulation } from '@casual-simulation/aux-vm';
import { CameraRig } from '../scene/CameraRigFactory';
import { CameraRigControls } from './CameraRigControls';

/**
 * Class that is able to tween the main camera to a given location.
 */
export class TweenCameraToOperation implements IOperation {
    private _rigControls: CameraRigControls;
    private _interaction: BaseInteractionManager;
    private _target: Vector3;
    private _finished: boolean;
    private _zoomValue: number;
    private _rotValue: Vector2;
    private _duration: number;
    private _instant: boolean;

    get simulation(): Simulation {
        return null;
    }

    /**
     * Create a new drag rules.
     * @param gameView The game view.
     * @param cameraRig The camera rig to perform tween for.
     * @param interaction The interaction manager.
     * @param target The target location to tween to.
     * @param zoomValue The zoom amount the camera sets to the bot.
     * @param duration The duration in seconds that the tween should take.
     */
    constructor(
        cameraRig: CameraRig,
        interaction: BaseInteractionManager,
        target: Vector3,
        zoomValue?: number,
        rotationValue?: Vector2,
        duration?: number
    ) {
        this._interaction = interaction;
        this._finished = false;
        this._zoomValue = zoomValue;
        this._rotValue = rotationValue;
        this._target = target;

        // TODO: Implement proper duration
        this._instant = duration <= 0;

        this._rigControls = this._interaction.cameraRigControllers.find(
            (c) => c.rig.name === cameraRig.name
        );

        // If rig controls could not be found for the given camera, just exit this operation early.
        if (!this._rigControls) {
            console.warn(
                '[TweenCameraToOperation] Could not find camera rig controls for the camera in the interaction manager.'
            );
            this._finished = true;
            return;
        }

        const currentPivotPoint = this._rigControls.controls.target;
        const rayPointToTargetPosition = target.clone().sub(currentPivotPoint);
        const rayPointToCamera = this._rigControls.rig.mainCamera.position
            .clone()
            .sub(currentPivotPoint);
        const finalPosition = currentPivotPoint
            .clone()
            .add(rayPointToTargetPosition)
            .add(rayPointToCamera);
        this._target = finalPosition;
    }

    update(calc: BotCalculationContext): void {
        if (!this._rigControls.controls.isEmptyState()) {
            this._finished = true;
        }

        if (this._finished) return;

        const camPos = this._rigControls.rig.mainCamera.position.clone();
        const dist = camPos.distanceToSquared(this._target);

        if (dist > 0.001) {
            let dir;
            if (this._instant) {
                dir = this._target.clone().sub(camPos).multiplyScalar(1);
            } else {
                dir = this._target.clone().sub(camPos).multiplyScalar(0.1);
            }

            this._rigControls.controls.cameraFrameOffset.copy(dir);
        } else {
            // This tween operation is finished.
            this._finished = true;

            // Set camera offset value so that camera snaps to final target destination.
            const dir = this._target.clone().sub(camPos);
            this._rigControls.controls.cameraFrameOffset.copy(dir);

            if (this._rotValue != null) {
                this._rigControls.controls.setRotValues = this._rotValue;
                this._rotValue = null;
                if (this._instant) {
                    this._rigControls.controls.tweenNum = 0.99;
                } else {
                    this._rigControls.controls.tweenNum = 0.1;
                }
                this._rigControls.controls.setRot = true;
            }

            if (
                this._zoomValue !== null &&
                this._zoomValue !== undefined &&
                this._zoomValue >= 0
            ) {
                if (this._instant) {
                    this._rigControls.controls.dollySet(this._zoomValue, true);
                } else {
                    this._rigControls.controls.dollySet(this._zoomValue);
                }
            }

            this._zoomValue = null;
        }
    }

    isFinished(): boolean {
        return this._finished;
    }

    dispose(): void {}
}
