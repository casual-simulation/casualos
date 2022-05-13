import { AuxBot3DDecorator, AuxBot3DDecoratorBase } from '../AuxBot3DDecorator';
import { AuxBot3D } from '../AuxBot3D';
import {
    calculateNumericalTagValue,
    BotCalculationContext,
    Bot,
    calculateGridScale,
    objectsAtDimensionGridPosition,
    getBotPosition,
    getBotRotation,
    getDimensionScale,
    getDimensionGridHeight,
    cacheFunction,
    calculateBooleanTagValue,
    getBotOrientationMode,
    getBotAnchorPoint,
    BotAnchorPoint,
    BotOrientationMode,
    getBotIndex,
    getBotScale,
    getAnchorPointOffset,
    LocalActions,
    RemoteCausalRepoPartitionImpl,
    Easing,
    EaseMode,
    hasValue,
    enqueueAsyncResult,
    BotAction,
    LocalTweenAction,
    LocalRotationTweenAction,
    LocalPositionTweenAction,
    enqueueAsyncError,
    getEasing,
    getBotTransformer,
} from '@casual-simulation/aux-common';
import {
    Rotation,
    AUX_ROTATION_TO_THREEJS,
} from '@casual-simulation/aux-common/math';
import {
    Vector3,
    Quaternion,
    Euler,
    Vector2,
    Object3D,
    MathUtils as ThreeMath,
    Matrix4,
} from '@casual-simulation/three';
import { calculateGridTileLocalCenter } from '../grid/Grid';
import { realPosToGridPos, Axial, posToKey } from '../hex';
import { BuilderGroup3D } from '../BuilderGroup3D';
import { calculateScale, objectForwardRay } from '../SceneUtils';
import { Game } from '../Game';
import TWEEN, { Tween } from '@tweenjs/tween.js';
import { MapSimulation3D } from '../../../aux-player/scene/MapSimulation3D';
import { CoordinateSystem } from '../CoordinateSystem';

/**
 * Defines an interface that contains possible options for DimensionPositionDecorator objects.
 */
export interface DimensionPositionDecoratorOptions {
    /**
     * Whether to linear interpolate between positions.
     */
    lerp?: boolean;
}

/**
 * Defines a AuxBot3D decorator that moves the bot to its position inside a dimension.
 */
export class DimensionPositionDecorator extends AuxBot3DDecoratorBase {
    private _lerp: boolean;
    private _atPosition: boolean;
    private _atRotation: boolean;
    private _lastPos: { x: number; y: number; z: number };
    private _lastSortOrder: number;
    private _nextPos: Vector3;
    private _nextRot: Rotation;
    private _lastHeight: number;
    private _orientationMode: BotOrientationMode;
    private _rotationObj: Object3D;
    private _game: Game;
    private _tween: any;

    constructor(
        bot3D: AuxBot3D,
        game: Game,
        options: DimensionPositionDecoratorOptions = {}
    ) {
        super(bot3D);
        this._game = game;
        this._lerp = !!options.lerp;
    }

    botUpdated(calc: BotCalculationContext): void {
        if (!!this._tween) {
            return;
        }
        const nextOrientationMode = getBotOrientationMode(calc, this.bot3D.bot);
        const anchorPointOffset = getAnchorPointOffset(calc, this.bot3D.bot);
        const gridScale = this.bot3D.gridScale;

        this._orientationMode = nextOrientationMode;
        this._rotationObj = this.bot3D.container;

        // Update the offset for the display container
        // so that it rotates around the specified
        // point
        // if (this.bot3D.targetCoordinateSystem === CoordinateSystem.Y_UP) {
        this.bot3D.display.position.set(
            anchorPointOffset.x,
            anchorPointOffset.z,
            anchorPointOffset.y
        );
        // } else {
        // this.bot3D.display.position.set(
        //     anchorPointOffset.x,
        //     anchorPointOffset.y,
        //     anchorPointOffset.z
        // );
        // }

        // The transform container gets the same position as the display but
        // with the anchor point multiplied by 2.
        // This is so that the "grid" for the bot is placed on the bot
        // instead of inside the bot.
        this.bot3D.transformContainer.position
            .copy(this.bot3D.display.position)
            .multiplyScalar(2);

        const userDimension = this.bot3D.dimension;
        if (userDimension) {
            const currentGridPos = getBotPosition(
                calc,
                this.bot3D.bot,
                this.bot3D.dimension
            );
            const currentHeight = calculateVerticalHeight(
                calc,
                this.bot3D.bot,
                this.bot3D.dimension,
                gridScale
            );
            const currentSortOrder = getBotIndex(
                calc,
                this.bot3D.bot,
                this.bot3D.dimension
            );
            const transformer = getBotTransformer(calc, this.bot3D.bot);
            const coordinateTransform =
                this.bot3D.coordinateTransformer && !hasValue(transformer)
                    ? this.bot3D.coordinateTransformer(currentGridPos)
                    : null;
            this._nextPos = calculateObjectPositionInGrid(
                calc,
                currentGridPos,
                this.bot3D,
                gridScale,
                coordinateTransform
            );

            if (
                this._positionUpdated(currentGridPos, currentSortOrder) ||
                this._heightUpdated(currentHeight)
            ) {
                let ids = [] as string[];
                if (this._lastPos) {
                    const objectsAtLastPosition =
                        objectsAtDimensionGridPosition(
                            calc,
                            this.bot3D.dimension,
                            this._lastPos
                        );
                    ids.push(...objectsAtLastPosition.map((b) => b.id));
                }
                if (currentGridPos) {
                    const objectsAtCurrentPosition =
                        objectsAtDimensionGridPosition(
                            calc,
                            this.bot3D.dimension,
                            currentGridPos
                        );
                    ids.push(...objectsAtCurrentPosition.map((b) => b.id));
                }

                this.bot3D.dimensionGroup.simulation3D.ensureUpdate(ids);
            }
            this._lastPos = currentGridPos;
            this._lastSortOrder = currentSortOrder;
            this._lastHeight = currentHeight;
            this._nextRot = getBotRotation(
                calc,
                this.bot3D.bot,
                this.bot3D.dimension
            );

            this._atPosition = false;
            this._atRotation = false;
            if (!this._lerp) {
                this.bot3D.position.copy(this._nextPos);

                if (this._orientationMode === 'absolute') {
                    if (coordinateTransform) {
                        const rot = new Matrix4().makeRotationFromQuaternion(
                            new Quaternion(
                                this._nextRot.quaternion.x,
                                this._nextRot.quaternion.y,
                                this._nextRot.quaternion.z,
                                this._nextRot.quaternion.w
                            )
                        );
                        const adjustment = new Matrix4().makeRotationAxis(
                            new Vector3(1, 0, 0),
                            Math.PI / 2
                        );

                        adjustment.premultiply(coordinateTransform);

                        rot.premultiply(adjustment);
                        const q = new Quaternion().setFromRotationMatrix(rot);
                        // q.multiply(adjustment);

                        this._rotationObj.quaternion.set(q.x, q.y, q.z, q.w);
                    } else {
                        const adjustment = AUX_ROTATION_TO_THREEJS;

                        const result = this._nextRot.quaternion; //.combineWith(adjustment).quaternion;

                        this._rotationObj.quaternion.set(
                            result.x,
                            result.y,
                            result.z,
                            result.w
                        );
                    }
                }
            }
        }
    }

    botRemoved(calc: BotCalculationContext): void {
        if (this._lastPos) {
            const objectsAtPosition = objectsAtDimensionGridPosition(
                calc,
                this.bot3D.dimension,
                this._lastPos
            );
            this.bot3D.dimensionGroup.simulation3D.ensureUpdate(
                objectsAtPosition.map((f) => f.id)
            );
        }
    }

    private _heightUpdated(currentHeight: number): boolean {
        return Math.abs(this._lastHeight - currentHeight) > 0.01;
    }

    private _positionUpdated(
        currentGridPos: {
            x: number;
            y: number;
            z: number;
        },
        currentSortOrder: number
    ): boolean {
        return (
            !this._lastPos ||
            currentGridPos.x !== this._lastPos.x ||
            currentGridPos.y !== this._lastPos.y ||
            currentGridPos.z !== this._lastPos.z ||
            this._lastSortOrder !== currentSortOrder
        );
    }

    frameUpdate(calc: BotCalculationContext): void {
        if (this._lerp && this._nextPos && this._nextRot) {
            if (!this._atPosition) {
                this.bot3D.position.lerp(this._nextPos, 0.1);
                const distance = this.bot3D.position.distanceTo(this._nextPos);
                this._atPosition = distance < 0.01;
            }

            if (!this._atRotation) {
                const result = this._nextRot.combineWith(
                    AUX_ROTATION_TO_THREEJS
                );
                const q = new Quaternion(
                    result.quaternion.x,
                    result.quaternion.y,
                    result.quaternion.z,
                    result.quaternion.w
                );
                this._rotationObj.quaternion.slerp(q, 0.1);

                const angle = this._rotationObj.quaternion.angleTo(q);
                this._atRotation = angle < 0.1;
            }

            if (!this._atPosition || !this._atRotation) {
                this.bot3D.updateMatrixWorld(true);
            }
        } else {
            let update = false;
            if (
                ['billboard', 'billboardTop', 'billboardFront'].indexOf(
                    this._orientationMode
                ) >= 0
            ) {
                const cameraRig =
                    this.bot3D.dimensionGroup.simulation3D.getMainCameraRig();
                const cameraWorld = new Vector3();
                cameraWorld.setFromMatrixPosition(
                    cameraRig.mainCamera.matrixWorld
                );

                if (this._game && !!this._game.xrSession) {
                    this._rotationObj.up = new Vector3(0, 1, 0);
                } else {
                    const cameraRotation =
                        new Quaternion().setFromRotationMatrix(
                            cameraRig.mainCamera.matrixWorld
                        );
                    const cameraUp = new Vector3(0, 1, 0);
                    cameraUp.applyQuaternion(cameraRotation);

                    this._rotationObj.up = cameraUp;
                }

                this._rotationObj.lookAt(cameraWorld);

                if (this._orientationMode !== 'billboardFront') {
                    // Rotate the object 90 degrees around its X axis
                    // so that the top of the bot is facing the camera.
                    const rotationOffset = new Quaternion().setFromAxisAngle(
                        new Vector3(1, 0, 0),
                        ThreeMath.degToRad(90)
                    );
                    this._rotationObj.quaternion.multiply(rotationOffset);
                }

                update = true;
                if (this._orientationMode === 'billboardTop') {
                    const euler = new Euler().setFromQuaternion(
                        this._rotationObj.quaternion,
                        'YXZ'
                    );
                    euler.x = ThreeMath.degToRad(90);
                    euler.z = 0;
                    this._rotationObj.setRotationFromEuler(euler);
                } else if (this._orientationMode === 'billboardFront') {
                    const euler = new Euler().setFromQuaternion(
                        this._rotationObj.quaternion,
                        'YXZ'
                    );
                    euler.x = 0;
                    euler.z = 0;
                    this._rotationObj.setRotationFromEuler(euler);
                }
            }

            if (update) {
                this.bot3D.updateMatrixWorld(true);
            }
        }
    }

    localEvent(event: LocalActions, calc: BotCalculationContext) {
        if (event.type === 'local_tween') {
            this._startTween(event);
        }
    }

    dispose(): void {}

    private _startTween(
        event: LocalPositionTweenAction | LocalRotationTweenAction
    ) {
        try {
            const currentTime = this._game.getTime().timeSinceStart * 1000;
            if (event.tweenType === 'position') {
                const gridScale = this.bot3D.gridScale;
                let targetPosition = {} as any;
                if (hasValue(event.position.x)) {
                    targetPosition.x = event.position.x * gridScale;
                }
                if (hasValue(event.position.y)) {
                    targetPosition.z = event.position.y * -gridScale;
                }
                if (hasValue(event.position.z)) {
                    targetPosition.y = event.position.z * gridScale;
                }
                const easing = getEasing(event.easing);
                this._tween = new TWEEN.Tween<any>(this.bot3D.position)
                    .to(<any>targetPosition)
                    .easing(easing)
                    .duration(event.duration * 1000)
                    .onUpdate(() => this.bot3D.updateMatrixWorld())
                    .onComplete(() => {
                        this._tween = null;

                        let list = [] as BotAction[];
                        enqueueAsyncResult(list, event, undefined);
                        this.bot3D.dimensionGroup.simulation3D.simulation.helper.transaction(
                            ...list
                        );
                    })
                    .start(currentTime);
            } else if (event.tweenType === 'rotation') {
                let targetRotation = {} as any;
                if (hasValue(event.rotation.x)) {
                    targetRotation.x = event.rotation.x;
                }
                if (hasValue(event.rotation.y)) {
                    targetRotation.z = event.rotation.y;
                }
                if (hasValue(event.rotation.z)) {
                    targetRotation.y = event.rotation.z;
                }
                const easing = getEasing(event.easing);
                this._tween = new TWEEN.Tween<any>(
                    this.bot3D.container.rotation
                )
                    .to(<any>targetRotation)
                    .easing(easing)
                    .duration(event.duration * 1000)
                    .onUpdate(() => this.bot3D.updateMatrixWorld())
                    .onComplete(() => {
                        this._tween = null;

                        let list = [] as BotAction[];
                        enqueueAsyncResult(list, event, undefined);
                        this.bot3D.dimensionGroup.simulation3D.simulation.helper.transaction(
                            ...list
                        );
                    })
                    .start(currentTime);
            }
        } catch (ex) {
            let list = [] as BotAction[];
            enqueueAsyncError(list, event, new Error('Unable to play tween.'));
            this.bot3D.dimensionGroup.simulation3D.simulation.helper.transaction(
                ...list
            );
        }
    }
}

/**
 * Calculates the position of the given bot.
 * @param context The bot calculation context to use to calculate forumula values.
 * @param bot The bot to calculate position for.
 * @param gridScale The scale of the grid.
 * @param coordinateTransform If specified, the matrix that should be used to determine the final grid position of the given bot.
 */
export function calculateObjectPositionInGrid(
    context: BotCalculationContext,
    position: { x: number; y: number; z: number },
    bot: AuxBot3D,
    gridScale: number,
    coordinateTransform: Matrix4
): Vector3 {
    if (coordinateTransform) {
        const pos = new Vector3();
        pos.applyMatrix4(coordinateTransform);
        return pos;
    }

    let localPosition = calculateGridTileLocalCenter(
        position.x,
        position.y,
        position.z,
        gridScale
    );

    if (bot.dimensionGroup instanceof BuilderGroup3D) {
        // Offset local position with hex grid height.
        let hexScale = getDimensionScale(context, bot.dimensionGroup.bot);
        let axial = realPosToGridPos(
            new Vector2(localPosition.x, localPosition.z),
            hexScale
        );
        let key = posToKey(axial);
        let height = getDimensionGridHeight(
            context,
            bot.dimensionGroup.bot,
            '0:0'
        );
        localPosition.add(new Vector3(0, height, 0));
    }

    return localPosition;
}

/**
 * Calculates the total vertical height of the given bot.
 * @param calc The calculation context to use.
 * @param bot The bot to use.
 * @param dimension The dimension that the bot's height should be evalulated in.
 * @param gridScale The scale of the grid.
 */
export function calculateVerticalHeight(
    calc: BotCalculationContext,
    bot: Bot,
    dimension: string,
    gridScale: number
) {
    return cacheFunction(
        calc,
        'calculateVerticalHeight',
        () => {
            const height = calculateScale(calc, bot, gridScale).y;
            const offset = calculateNumericalTagValue(
                calc,
                bot,
                `${dimension}Z`,
                0
            );

            return height + offset * gridScale;
        },
        bot.id,
        dimension,
        gridScale
    );
}
