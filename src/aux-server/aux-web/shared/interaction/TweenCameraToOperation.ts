import { IOperation } from './IOperation';
import { BaseInteractionManager } from './BaseInteractionManager';
import { Vector3 } from 'three';
import { FileCalculationContext } from '@casual-simulation/aux-common';
import { Simulation } from '../Simulation';
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
        zoomValue?: number
    ) {
        this._interaction = interaction;
        this._finished = false;
        this._zoomValue = zoomValue;

        this._rigControls = this._interaction.cameraRigControllers.find(
            c => c.rig === cameraRig
        );

        // If rig controls could not be found for the given camera, just exit this operation early.
        if (!this._rigControls) {
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
