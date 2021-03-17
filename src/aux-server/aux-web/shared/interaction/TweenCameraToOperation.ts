import { IOperation } from './IOperation';
import { BaseInteractionManager } from './BaseInteractionManager';
import { Vector3, Vector2 } from '@casual-simulation/three';
import {
    asyncError,
    asyncResult,
    BotCalculationContext,
    getEasing,
    hasValue,
    TweenToOptions,
} from '@casual-simulation/aux-common';
import { Simulation } from '@casual-simulation/aux-vm';
import { CameraRig } from '../scene/CameraRigFactory';
import { CameraRigControls } from './CameraRigControls';
import TWEEN, { Tween } from '@tweenjs/tween.js';
import { Time } from '../scene/Time';
import { thresholdFreedmanDiaconis } from 'd3-array';

/**
 * Class that is able to tween the main camera to a given location.
 */
export class TweenCameraToOperation implements IOperation {
    private _rigControls: CameraRigControls;
    private _interaction: BaseInteractionManager;
    private _target: Vector3;
    private _cameraTarget: Vector3;
    private _finished: boolean;
    private _zoomValue: number;
    private _rotValue: Vector2;
    private _duration: number;
    private _instant: boolean;
    private _taskId: string | number;
    private _simulation: Simulation;
    private _tween: any;
    private _canceled: boolean;

    get simulation(): Simulation {
        return this._simulation;
    }

    /**
     * Create a new drag rules.
     * @param cameraRig The camera rig to perform tween for.
     * @param time The object that manages time.
     * @param interaction The interaction manager.
     * @param target The target location to tween to.
     * @param options The options for the tween.
     * @param simulation The simulation that the async task should be completed in.
     * @param taskId The async task ID.
     */
    constructor(
        cameraRig: CameraRig,
        time: Time,
        interaction: BaseInteractionManager,
        target: Vector3,
        options: TweenToOptions,
        simulation: Simulation,
        taskId: string | number
    ) {
        this._interaction = interaction;
        this._finished = false;
        this._zoomValue = options.zoom;
        this._rotValue = hasValue(options.rotation)
            ? new Vector2(options.rotation.x, options.rotation.y)
            : null;
        this._duration = options.duration ?? 1;
        this._target = target;
        this._simulation = simulation;
        this._taskId = taskId;

        // TODO: Implement proper duration
        this._instant = this._duration <= 0;

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

        const controlsTarget = this._rigControls.controls.target;
        const controlsTargetToTweenTarget = this._target
            .clone()
            .sub(controlsTarget);
        const cameraToControlsTarget = this._rigControls.rig.mainCamera.position
            .clone()
            .sub(controlsTarget);
        const finalPosition = controlsTarget
            .clone()
            .add(controlsTargetToTweenTarget)
            .add(cameraToControlsTarget);
        let intermediateTarget = this._target.clone();
        this._cameraTarget = finalPosition;

        const easing = getEasing(options.easing);
        const cameraPosition = this._rigControls.rig.mainCamera.position.clone();
        this._tween = new TWEEN.Tween<any>(cameraPosition)
            .to(<any>this._cameraTarget)
            .duration(this._duration * 1000)
            .easing(easing)
            .onUpdate(() => {
                this._rigControls.rig.mainCamera.position.copy(cameraPosition);
                this._rigControls.rig.cameraParent.worldToLocal(
                    this._rigControls.rig.mainCamera.position
                );
                this._rigControls.rig.mainCamera.updateMatrixWorld();

                intermediateTarget.copy(cameraPosition);
                intermediateTarget.sub(cameraToControlsTarget);
                this._rigControls.controls.target.copy(intermediateTarget);
            })
            .onComplete(() => {
                this._rigControls.rig.mainCamera.position.copy(cameraPosition);
                this._rigControls.rig.cameraParent.worldToLocal(
                    this._rigControls.rig.mainCamera.position
                );
                this._rigControls.rig.mainCamera.updateMatrixWorld();
                this._rigControls.controls.target.copy(this._target);
                this._finished = true;
            });

        const currentTime = time.timeSinceStart * 1000;
        this._tween.start(currentTime);
    }

    update(calc: BotCalculationContext): void {
        if (!this._rigControls.controls.isEmptyState()) {
            this._finished = true;
            this._canceled = true;
        }

        if (this._finished) return;

        // const camPos = this._rigControls.rig.mainCamera.position.clone();
        // const dist = camPos.distanceToSquared(this._target);

        // if (dist > 0.001) {
        //     let dir;
        //     if (this._instant) {
        //         dir = this._target.clone().sub(camPos).multiplyScalar(1);
        //     } else {
        //         dir = this._target.clone().sub(camPos).multiplyScalar(0.1);
        //     }

        //     this._rigControls.controls.cameraFrameOffset.copy(dir);
        // } else {
        //     // This tween operation is finished.
        //     this._finished = true;

        //     // Set camera offset value so that camera snaps to final target destination.
        //     const dir = this._target.clone().sub(camPos);
        //     this._rigControls.controls.cameraFrameOffset.copy(dir);

        //     if (this._rotValue != null) {
        //         this._rigControls.controls.setRotValues = this._rotValue;
        //         this._rotValue = null;
        //         if (this._instant) {
        //             this._rigControls.controls.tweenNum = 0.99;
        //         } else {
        //             this._rigControls.controls.tweenNum = 0.1;
        //         }
        //         this._rigControls.controls.setRot = true;
        //     }

        //     if (
        //         this._zoomValue !== null &&
        //         this._zoomValue !== undefined &&
        //         this._zoomValue >= 0
        //     ) {
        //         if (this._instant) {
        //             this._rigControls.controls.dollySet(this._zoomValue, true);
        //         } else {
        //             this._rigControls.controls.dollySet(this._zoomValue);
        //         }
        //     }

        //     this._zoomValue = null;
        // }
    }

    isFinished(): boolean {
        return this._finished;
    }

    dispose(): void {
        if (this._tween) {
            this._tween.stop();
            this._tween = null;
        }
        if (hasValue(this._simulation) && hasValue(this._taskId)) {
            if (this._canceled) {
                this._simulation.helper.transaction(
                    asyncError(
                        this._taskId,
                        'The user canceled the camera focus operation.'
                    )
                );
            } else {
                this._simulation.helper.transaction(
                    asyncResult(this._taskId, null)
                );
            }
        }
    }
}
