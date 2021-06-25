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
    Easing,
    EaseType,
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
export class FocusCameraRigOnOperation implements IOperation {
    private _rigControls: CameraRigControls;
    private _cameraRig: CameraRig;
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
    private _canceled: boolean;
    private _errorMessage: string;
    private _easing: EaseType | Easing;
    private _focusing: boolean;

    get cameraRig() {
        return this._cameraRig;
    }

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
        if (!cameraRig.focusOnPosition || !cameraRig.cancelFocus) {
            throw new Error(
                'Unable to perform a focus camera operation on a camera rig that does not have focusOnPosition() or cancelFocus()'
            );
        }

        this._interaction = interaction;
        this._cameraRig = cameraRig;
        this._finished = false;
        this._zoomValue = options.zoom;
        this._rotValue = hasValue(options.rotation)
            ? {
                  x: normalizeAngle(options.rotation.x),
                  y: normalizeAngle(options.rotation.y),
              }
            : null;
        this._duration = options.duration ?? 1;
        this._easing = options.easing;
        this._target = target;
        this._simulation = simulation;
        this._focusing = false;
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

        this._tryFocus();
    }

    update(calc: BotCalculationContext): void {
        if (!this._rigControls.controls.isEmptyState()) {
            this._finished = true;
            this._canceled = true;
        }

        if (this._finished) return;

        if (!this._focusing) {
            this._tryFocus();
        }
    }

    isFinished(): boolean {
        return this._finished;
    }

    dispose(): void {
        if (!this._finished && !this._canceled) {
            this._canceled = true;
            this._cameraRig.cancelFocus();
        }
        if (hasValue(this._simulation) && hasValue(this._taskId)) {
            if (this._canceled || !this._finished) {
                this._simulation.helper.transaction(
                    asyncError(
                        this._taskId,
                        this._errorMessage ??
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

    private _tryFocus() {
        const easing = getEasing(this._easing);
        try {
            const promise = this._cameraRig.focusOnPosition(this._target, {
                duration: this._duration,
                easing,
                rotation: this._rotValue,
                zoom: this._zoomValue,
            });
            if (promise) {
                this._focusing = true;
                promise.then(
                    () => {
                        this._finished = true;
                    },
                    (err) => {
                        this._finished = true;
                        this._canceled = true;
                    }
                );
            }
        } catch (err) {
            this._finished = true;
            this._canceled = true;
            this._errorMessage = 'Unable to focus on the given position/bot.';
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
