import { Vector3, Euler, OrthographicCamera } from 'three';
import {
    BotCalculationContext,
    AuxObject,
    calculateGridScale,
    getBotRotation,
    getBotPosition,
    normalize,
    lerp,
} from '@casual-simulation/aux-common';
import { AuxFile3DDecorator } from '../AuxFile3DDecorator';
import { AuxFile3D } from '../AuxFile3D';
import { calculateScale } from '../SceneUtils';
import {
    Orthographic_DefaultZoom,
    Orthographic_MinZoom,
    Orthographic_MaxZoom,
} from '../CameraRigFactory';
import { Game } from '../Game';

/**
 * The amount of time between checking a user's mouse for activity.
 */
export const DEFAULT_USER_ACTIVE_CHECK_INTERVAL = 1000 * 10;

/**
 * The distance that the user needs to move before updating their position.
 */
export const DEFAULT_USER_MOVEMENT_INCREMENT = 0.5;

/**
 * The angle that the user needs to rotate before updating their position.
 */
export const DEFAULT_USER_ROTATION_INCREMENT = 2 * (Math.PI / 180);

/**
 * The number of updates per second that the user control is allowed to make.
 */
export const MAX_UPDATE_RATE = 2;

/**
 * The number of miliseconds to wait between updates in order to not violate MAX_UPDATE_RATE.
 */
export const TIME_BETWEEN_UPDATES = 1000 / MAX_UPDATE_RATE;

/**
 * Defines a class that represents the controls for an "user" file.
 */
export class UserControlsDecorator extends AuxFile3DDecorator {
    private _lastActiveCheckTime: number;
    private _lastPositionUpdateTime: number = -1000;

    /**
     * The aux file 3d that this decorator is for.
     */
    file3D: AuxFile3D;

    private _game: Game;

    constructor(file3D: AuxFile3D, game: Game) {
        super(file3D);
        this._game = game;
    }

    fileUpdated(calc: BotCalculationContext): void {
        // Do nothing.
    }

    frameUpdate(calc: BotCalculationContext) {
        let file = <AuxObject>this.file3D.file;
        const time = Date.now();

        if (time > this._lastPositionUpdateTime + TIME_BETWEEN_UPDATES) {
            const mainCamera = this._game.getMainCameraRig().mainCamera;
            const camRotation = mainCamera.rotation.clone();
            const camRotationVector = new Vector3(0, 0, 1).applyEuler(
                camRotation
            );

            // Handle camera position differently based on the type camera it is.
            let camPosition: Vector3 = mainCamera.position.clone();

            // Scale camera's local position so that it maps to the context positioning.
            const gridScale = calculateGridScale(
                calc,
                this.file3D.contextGroup.file
            );
            const scale = calculateScale(calc, this.file3D.file, gridScale);
            camPosition.x /= scale.x;
            camPosition.y /= scale.y;
            camPosition.z /= scale.z;

            if (mainCamera instanceof OrthographicCamera) {
                // Use orthographic camera's rotation and zoom level to 'move' the camera position
                // to mimic what perspective camera positioning looks like.

                const orthoDollyRange = {
                    max: 425,
                    base: 415,
                    min: 360,
                };

                let dollyDist: number;

                if (mainCamera.zoom >= Orthographic_DefaultZoom) {
                    let t = normalize(
                        mainCamera.zoom,
                        Orthographic_DefaultZoom,
                        Orthographic_MaxZoom
                    );
                    dollyDist = lerp(
                        orthoDollyRange.base,
                        orthoDollyRange.max,
                        t
                    );
                } else {
                    let t = normalize(
                        mainCamera.zoom,
                        Orthographic_MinZoom,
                        Orthographic_DefaultZoom
                    );
                    dollyDist = lerp(
                        orthoDollyRange.min,
                        orthoDollyRange.base,
                        t
                    );
                }

                let newCamPos = new Vector3();
                let direction = camRotationVector
                    .clone()
                    .normalize()
                    .multiplyScalar(-1);
                newCamPos.addVectors(
                    camPosition,
                    direction.multiplyScalar(dollyDist)
                );
                // console.log(`zoom: ${mainCamera.zoom},\ndollyDist: ${dollyDist}\nnewCamPos: (${newCamPos.x}, ${newCamPos.y}, ${newCamPos.z})`);

                camPosition = newCamPos.clone();
            }

            const filePosition = getBotPosition(
                calc,
                file,
                this.file3D.context
            );
            const fileRotation = getBotRotation(
                calc,
                file,
                this.file3D.context
            );

            const fileRotationVector = new Vector3(0, 0, 1).applyEuler(
                new Euler(fileRotation.x, fileRotation.z, fileRotation.y)
            );
            const distance = camPosition.distanceTo(
                new Vector3(filePosition.x, filePosition.z, -filePosition.y)
            );
            const angle = camRotationVector.angleTo(fileRotationVector);
            if (
                distance > DEFAULT_USER_MOVEMENT_INCREMENT ||
                angle > DEFAULT_USER_ROTATION_INCREMENT
            ) {
                this._lastPositionUpdateTime = time;

                this.file3D.contextGroup.simulation3D.simulation.helper.updateBot(
                    file,
                    {
                        tags: {
                            [`${this.file3D.context}.x`]: camPosition.x,

                            // Mirror the Y coordinate so it works with ContextPositionDecorator
                            [`${this.file3D.context}.y`]: -camPosition.z,

                            [`${this.file3D.context}.z`]: camPosition.y,
                            [`${
                                this.file3D.context
                            }.rotation.x`]: camRotation.x,
                            [`${
                                this.file3D.context
                            }.rotation.y`]: camRotation.z,
                            [`${
                                this.file3D.context
                            }.rotation.z`]: camRotation.y,
                        },
                    }
                );
            }
        }

        this._checkIsActive();
    }

    dispose() {
        // Do nothing.
    }

    private _checkIsActive() {
        const timeBetweenChecks = Date.now() - this._lastActiveCheckTime;
        if (
            !this._lastActiveCheckTime ||
            timeBetweenChecks > DEFAULT_USER_ACTIVE_CHECK_INTERVAL
        ) {
            this._lastActiveCheckTime = Date.now();
            this.file3D.contextGroup.simulation3D.simulation.helper.updateBot(
                <AuxObject>this.file3D.file,
                {
                    tags: {
                        [`aux._lastActiveTime`]: Date.now(),
                    },
                }
            );
        }
    }
}
