import { IOperation } from './IOperation';
import { BaseInteractionManager } from './BaseInteractionManager';
import { Vector3, Vector2 } from '@casual-simulation/three';
import {
    asyncError,
    asyncResult,
    BotCalculationContext,
    getEasing,
    hasValue,
    FocusOnOptions,
} from '@casual-simulation/aux-common';
import { Simulation } from '@casual-simulation/aux-vm';
import { CameraRig } from '../scene/CameraRigFactory';
import { CameraRigControls } from './CameraRigControls';
import TWEEN, { Tween } from '@tweenjs/tween.js';
import { Time } from '../scene/Time';
import { objectForwardRay } from '../scene/SceneUtils';

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
    private _rotValue: { x: number; y: number };
    private _duration: number;
    private _instant: boolean;
    private _taskId: string | number;
    private _simulation: Simulation;
    private _positionTween: any;
    private _rotationTween: any;
    private _zoomTween: any;
    private _lookTween: any;
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
        options: FocusOnOptions,
        simulation: Simulation,
        taskId: string | number
    ) {
        this._interaction = interaction;
        this._finished = false;
        this._zoomValue = options.zoom;
        this._rotValue = hasValue(options.rotation)
            ? {
                  x: normalizeAngle(options.rotation.x),
                  y: normalizeAngle(options.rotation.y),
              }
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

        const controlsTarget = this._rigControls.controls.target.clone();

        const easing = getEasing(options.easing);
        const tweenDuration = this._duration * 1000;
        this._positionTween = new TWEEN.Tween<any>(controlsTarget)
            .to(<any>this._target)
            .duration(tweenDuration)
            .easing(easing)
            .onUpdate(() => {
                this._rigControls.controls.target.copy(controlsTarget);
            })
            .onComplete(() => {
                this._rigControls.controls.target.copy(this._target);
                this._finished = true;
            });

        if (this._rotValue) {
            const currentRotation = this._rigControls.controls.getRotation();
            const normalizedRotation = {
                x: normalizeAngle(currentRotation.x),
                y: normalizeAngle(currentRotation.y),
            };

            if (!hasValue(this._rotValue.x)) {
                this._rotValue.x = normalizedRotation.x;
            }
            if (!hasValue(this._rotValue.y)) {
                this._rotValue.y = normalizedRotation.y;
            }

            const xDelta = normalizedRotation.x - this._rotValue.x;
            const yDelta = normalizedRotation.y - this._rotValue.y;

            if (Math.abs(xDelta) > Math.PI) {
                this._rotValue.x += Math.sign(xDelta) * Math.PI * 2;
            }
            if (Math.abs(yDelta) > Math.PI) {
                this._rotValue.y += Math.sign(yDelta) * Math.PI * 2;
            }

            this._rotationTween = new TWEEN.Tween<any>(normalizedRotation)
                .to(<any>this._rotValue)
                .duration(tweenDuration)
                .easing(easing)
                .onUpdate(() => {
                    this._rigControls.controls.setRotation(normalizedRotation);
                })
                .onComplete(() => {
                    this._rigControls.controls.setRotation(normalizedRotation);
                    this._finished = true;
                });
        }

        if (hasValue(this._zoomValue)) {
            const currentZoom = {
                zoom: this._rigControls.controls.currentZoom,
            };
            this._zoomTween = new TWEEN.Tween<any>(currentZoom)
                .to(<any>{ zoom: this._zoomValue })
                .duration(tweenDuration)
                .easing(easing)
                .onUpdate(() => {
                    this._rigControls.controls.dollySet(currentZoom.zoom, true);
                })
                .onComplete(() => {
                    this._rigControls.controls.dollySet(currentZoom.zoom, true);
                    this._finished = true;
                });
        }

        if (this._rigControls.controls.usingImmersiveControls) {
            // animate the camera look point to look at the focus point
            const targetLookPoint = this._target.clone();
            let currentLookPoint = this._rigControls.controls.immersiveLookPosition?.clone();
            if (!currentLookPoint) {
                const forward = objectForwardRay(
                    this._rigControls.rig.mainCamera
                );
                currentLookPoint = forward.origin.clone();
                currentLookPoint.add(forward.direction);
            }

            this._lookTween = new TWEEN.Tween<any>(currentLookPoint)
                .to(<any>targetLookPoint)
                .duration(tweenDuration)
                .easing(easing)
                .onUpdate(() => {
                    this._rigControls.controls.immersiveLookPosition = currentLookPoint;
                })
                .onComplete(() => {
                    this._rigControls.controls.immersiveLookPosition = currentLookPoint;
                    this._finished = true;
                });
        }

        const currentTime = time.timeSinceStart * 1000;
        this._positionTween.start(currentTime);
        this._rotationTween?.start(currentTime);
        this._zoomTween?.start(currentTime);
        this._lookTween?.start(currentTime);
    }

    update(calc: BotCalculationContext): void {
        if (!this._rigControls.controls.isEmptyState()) {
            this._finished = true;
            this._canceled = true;
        }

        if (this._finished) return;
    }

    isFinished(): boolean {
        return this._finished;
    }

    dispose(): void {
        if (this._positionTween) {
            this._positionTween.stop();
            this._positionTween = null;
        }
        if (this._rotationTween) {
            this._rotationTween.stop();
            this._rotationTween = null;
        }
        if (this._zoomTween) {
            this._zoomTween.stop();
            this._zoomTween = null;
        }
        if (this._lookTween) {
            this._lookTween.stop();
            this._lookTween = null;
        }
        if (hasValue(this._simulation) && hasValue(this._taskId)) {
            if (this._canceled || !this._finished) {
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

export function normalizeAngle(angle: number) {
    const pi_sqr = Math.PI * 2;
    while (angle < 0) {
        angle += pi_sqr;
    }
    while (angle > pi_sqr) {
        angle -= pi_sqr;
    }
    return angle;
}
