import {
    Vector3,
    Euler,
    OrthographicCamera,
    Quaternion,
} from '@casual-simulation/three';
import {
    BotCalculationContext,
    calculateGridScale,
    getBotRotation,
    getBotPosition,
    normalize,
    lerp,
} from '@casual-simulation/aux-common';
import { AuxBot3DDecorator, AuxBot3DDecoratorBase } from '../AuxBot3DDecorator';
import { AuxBot3D } from '../AuxBot3D';
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
 * Whether to update the _auxLastActiveTime tags.
 */
const UPDATE_LAST_ACTIVE_TIME = true;

/**
 * Defines a class that represents the controls for an "user" bot.
 */
export class UserControlsDecorator extends AuxBot3DDecoratorBase {
    private _lastActiveCheckTime: number;
    private _lastPositionUpdateTime: number = -1000;

    /**
     * The aux bot 3d that this decorator is for.
     */
    bot3D: AuxBot3D;

    private _game: Game;

    constructor(bot3D: AuxBot3D, game: Game) {
        super(bot3D);
        this._game = game;
    }

    botUpdated(calc: BotCalculationContext): void {
        // Do nothing.
    }

    frameUpdate(calc: BotCalculationContext) {
        let bot = this.bot3D.bot;
        const time = Date.now();

        if (time > this._lastPositionUpdateTime + TIME_BETWEEN_UPDATES) {
            const mainCamera = this._game.getMainCameraRig().mainCamera;
            const camRotation = mainCamera.rotation.clone();
            const camRotationVector = new Vector3(0, 0, 1).applyEuler(
                camRotation
            );

            // Handle camera position differently based on the type camera it is.
            let camPosition: Vector3 = mainCamera.position.clone();

            // Scale camera's local position so that it maps to the dimension positioning.
            const gridScale = calculateGridScale(
                calc,
                this.bot3D.dimensionGroup.bot
            );
            const scale = calculateScale(calc, this.bot3D.bot, gridScale);
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

            const botPosition = getBotPosition(calc, bot, this.bot3D.dimension);
            const botRotation = getBotRotation(calc, bot, this.bot3D.dimension);
            const q = botRotation.quaternion;

            const botRotationVector = new Vector3(0, 0, 1).applyQuaternion(
                new Quaternion(q.x, q.y, q.z, q.w)
            );
            const distance = camPosition.distanceTo(
                new Vector3(botPosition.x, botPosition.z, -botPosition.y)
            );
            const angle = camRotationVector.angleTo(botRotationVector);
            if (
                distance > DEFAULT_USER_MOVEMENT_INCREMENT ||
                angle > DEFAULT_USER_ROTATION_INCREMENT
            ) {
                this._lastPositionUpdateTime = time;

                this.bot3D.dimensionGroup.simulation3D.simulation.helper.updateBot(
                    bot,
                    {
                        tags: {
                            [`${this.bot3D.dimension}X`]: camPosition.x,

                            // Mirror the Y coordinate so it works with DimensionPositionDecorator
                            [`${this.bot3D.dimension}Y`]: -camPosition.z,

                            [`${this.bot3D.dimension}Z`]: camPosition.y,
                            [`${this.bot3D.dimension}RotationX`]: camRotation.x,
                            [`${this.bot3D.dimension}RotationY`]: camRotation.z,
                            [`${this.bot3D.dimension}RotationZ`]: camRotation.y,
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
        if (!UPDATE_LAST_ACTIVE_TIME) {
            return;
        }
    }
}
