import { IOperation } from './IOperation';
import { BaseInteractionManager } from './BaseInteractionManager';
import { Vector3, Vector2 } from 'three';
import { FileCalculationContext } from '@casual-simulation/aux-common';
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

    get simulation(): Simulation {
        return null;
    }

    /**
     * Create a new drag rules.
     * @param gameView The game view.
     * @param cameraRig The camera rig to perform tween for.
     * @param interaction The interaction manager.
     * @param target The target location to tween to.
     * @param zoomValue The zoom amount the camera sets to the file.
     */
    constructor(
        cameraRig: CameraRig,
        interaction: BaseInteractionManager,
        target: Vector3,
        zoomValue?: number,
        rotationValue?: Vector2
    ) {
        this._interaction = interaction;
        this._finished = false;
        this._zoomValue = zoomValue;
        this._rotValue = rotationValue;
        this._target = target;

        this._rigControls = this._interaction.cameraRigControllers.find(
            c => c.rig.name === cameraRig.name
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

    update(calc: FileCalculationContext): void {
        if (!this._rigControls.controls.isEmptyState()) {
            this._finished = true;
        }

        if (this._finished) return;

        const camPos = this._rigControls.rig.mainCamera.position.clone();
        const dist = camPos.distanceToSquared(this._target);

        if (dist > 0.001) {
            const dir = this._target
                .clone()
                .sub(camPos)
                .multiplyScalar(0.1);
            this._rigControls.controls.cameraOffset.copy(dir);
        } else {
            // This tween operation is finished.
            this._finished = true;

            // Set camera offset value so that camera snaps to final target destination.
            const dir = this._target.clone().sub(camPos);
            this._rigControls.controls.cameraOffset.copy(dir);

            if (this._rotValue != null) {
                this._rigControls.controls.setRotValues = this._rotValue;
                this._rotValue = null;
                this._rigControls.controls.tweenNum = 0.1;
                this._rigControls.controls.setRot = true;
            }

            if (
                this._zoomValue !== null &&
                this._zoomValue !== undefined &&
                this._zoomValue >= 0
            ) {
                this._rigControls.controls.dollySet(this._zoomValue);
            }

            this._zoomValue = null;
        }
    }

    isFinished(): boolean {
        return this._finished;
    }

    dispose(): void {}
}
