import { AuxBot3DDecoratorBase } from '../AuxBot3DDecorator';
import { AuxBot3D } from '../AuxBot3D';
import type {
    BotCalculationContext,
    Bot,
    BotOrientationMode,
    LocalActions,
    BotAction,
    LocalRotationTweenAction,
    LocalPositionTweenAction,
} from '@casual-simulation/aux-common';
import {
    calculateNumericalTagValue,
    getBotPosition,
    getBotRotation,
    cacheFunction,
    getBotOrientationMode,
    getBotIndex,
    getAnchorPointOffset,
    hasValue,
    enqueueAsyncResult,
    enqueueAsyncError,
    getEasing,
    getBotTransformer,
} from '@casual-simulation/aux-common';
import {
    Rotation,
    Vector3 as CasualVector3,
} from '@casual-simulation/aux-common/math';
import type { Object3D } from '@casual-simulation/three';
import {
    Vector3,
    Quaternion,
    Euler,
    MathUtils as ThreeMath,
    Matrix4,
} from '@casual-simulation/three';
import { calculateGridTileLocalCenter } from '../grid/Grid';
import { calculateScale } from '../SceneUtils';
import type { Game } from '../Game';
import TWEEN from '@tweenjs/tween.js';
import { DimensionGroup3D } from '../DimensionGroup3D';

const tempVector3 = new Vector3();
const tempQuaternion = new Quaternion();

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
    private _parentWorldPos: Vector3;
    private _parentWorldRot: Quaternion;

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
        this.bot3D.display.position.set(
            anchorPointOffset.x,
            anchorPointOffset.y,
            anchorPointOffset.z
        );

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

                        rot.premultiply(coordinateTransform);
                        const q = new Quaternion().setFromRotationMatrix(rot);
                        this._rotationObj.quaternion.set(q.x, q.y, q.z, q.w);
                    } else {
                        const result = this._nextRot.quaternion;
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

    botRemoved(calc: BotCalculationContext): void {}

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
                const result = this._nextRot.quaternion;
                const q = new Quaternion(
                    result.x,
                    result.y,
                    result.z,
                    result.w
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

                if (this._game && this._game.isImmersive) {
                    // Use the World UP in VR/AR so that billboarded items don't
                    // rotate with the player's head
                    this._rotationObj.up.set(0, 0, 1);
                    // errorHandlingMode = 'nudge';
                } else {
                    const cameraRotation =
                        new Quaternion().setFromRotationMatrix(
                            cameraRig.mainCamera.matrixWorld
                        );
                    const cameraUp = new Vector3(0, 1, 0);
                    cameraUp.applyQuaternion(cameraRotation);

                    this._rotationObj.up = cameraUp;
                }

                const objWorld = new Vector3();
                this._rotationObj.getWorldPosition(objWorld);
                const direction = new CasualVector3(
                    objWorld.x,
                    objWorld.y,
                    objWorld.z
                ).subtract(
                    new CasualVector3(
                        cameraWorld.x,
                        cameraWorld.y,
                        cameraWorld.z
                    )
                );
                const lookRotation = new Rotation({
                    direction: direction,
                    upwards: new CasualVector3(
                        this._rotationObj.up.x,
                        this._rotationObj.up.y,
                        this._rotationObj.up.z
                    ),
                    errorHandling: 'nudge',
                });

                const parentRotationWorld = new Quaternion();
                this._rotationObj.parent.getWorldQuaternion(
                    parentRotationWorld
                );
                parentRotationWorld.invert();

                this._rotationObj.quaternion.set(
                    lookRotation.quaternion.x,
                    lookRotation.quaternion.y,
                    lookRotation.quaternion.z,
                    lookRotation.quaternion.w
                );
                this._rotationObj.quaternion.premultiply(parentRotationWorld);

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
                        'ZXY'
                    );
                    euler.x = ThreeMath.degToRad(90);
                    euler.y = 0;
                    this._rotationObj.setRotationFromEuler(euler);
                } else if (this._orientationMode === 'billboardFront') {
                    const euler = new Euler().setFromQuaternion(
                        this._rotationObj.quaternion,
                        'ZXY'
                    );
                    euler.x = 0;
                    euler.y = 0;
                    this._rotationObj.setRotationFromEuler(euler);
                }
            }

            if (update) {
                this.bot3D.updateMatrixWorld(true);
            }
        }

        // Update bounding objects if parent moves.
        // If this bot is parented to a bot or dimension group, crawl up the parent tree until we find it.
        let parent3D: AuxBot3D | DimensionGroup3D;

        if (
            this.bot3D.parent.userData.isBotTransformContainer ||
            this.bot3D.parent.userData.isDimensionGroupDisplay
        ) {
            let grandparent = this.bot3D.parent;

            while (!parent3D && grandparent) {
                if (
                    grandparent instanceof AuxBot3D ||
                    grandparent instanceof DimensionGroup3D
                ) {
                    parent3D = grandparent;
                }

                grandparent = grandparent.parent;
            }
        }

        if (parent3D) {
            if (!this._parentWorldPos || !this._parentWorldRot) {
                this._parentWorldPos = new Vector3();
                this._parentWorldRot = new Quaternion();
                parent3D.display.getWorldPosition(this._parentWorldPos);
                parent3D.display.getWorldQuaternion(this._parentWorldRot);
                this.bot3D.forceComputeBoundingObjects();
            } else {
                this._parentWorldPos.copy(tempVector3);
                this._parentWorldRot.copy(tempQuaternion);

                parent3D.display.getWorldPosition(this._parentWorldPos);
                parent3D.display.getWorldQuaternion(this._parentWorldRot);

                const parentMoved =
                    !this._parentWorldPos.equals(tempVector3) ||
                    !this._parentWorldRot.equals(tempQuaternion);

                if (parentMoved) {
                    this.bot3D.forceComputeBoundingObjects();
                }
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
