import { BaseBotDragOperation } from '../../../shared/interaction/DragOperation/BaseBotDragOperation';
import {
    Bot,
    BotCalculationContext,
    BotDragMode,
    objectsAtDimensionGridPosition,
    getDropBotFromGridPosition,
    BotTags,
    BotPositioningMode,
    getBotPosition,
    getBotIndex,
    calculateStringTagValue,
    getBotTransformer,
    hasValue,
    isBotMovable,
    SnapPoint,
    getBotScale,
    getAnchorPointOffset,
    createBot,
    getBotRotation,
    SnapAxis,
} from '@casual-simulation/aux-common';
import { PlayerInteractionManager } from '../PlayerInteractionManager';
import {
    Intersection,
    Vector2,
    Ray,
    Vector3,
    Quaternion,
    Euler,
    Color,
    Box3,
    Matrix4,
    Group,
} from '@casual-simulation/three';
import { Physics } from '../../../shared/scene/Physics';
import { Input, InputMethod } from '../../../shared/scene/Input';
import { PlayerPageSimulation3D } from '../../scene/PlayerPageSimulation3D';
import { MiniSimulation3D } from '../../scene/MiniSimulation3D';
import { PlayerGame } from '../../scene/PlayerGame';
import { take, drop } from 'lodash';
import { IOperation } from '../../../shared/interaction/IOperation';
import { PlayerModDragOperation } from './PlayerModDragOperation';
import {
    calculateHitFace,
    convertRotationToAuxCoordinates,
    isBotChildOf,
    objectForwardRay,
} from '../../../shared/scene/SceneUtils';
import { AuxBot3D } from '../../../shared/scene/AuxBot3D';
import { Grid3D, GridTile } from '../../../shared/scene/Grid3D';
import {
    SnapBotsInterface,
    SnapOptions,
} from '../../../shared/interaction/DragOperation/SnapInterface';

export class PlayerBotDragOperation extends BaseBotDragOperation {
    // This overrides the base class BaseInteractionManager
    protected _interaction: PlayerInteractionManager;
    // This overrides the base class Simulation3D
    protected _simulation3D: PlayerPageSimulation3D;

    protected _miniSimulation3D: MiniSimulation3D;

    // Determines if the bot is in the mini portal currently
    protected _inMiniPortal: boolean;

    // Determines if the bot was in the mini portal at the beginning of the drag operation
    protected _originallyInMiniPortal: boolean;

    protected _originalDimension: string;

    protected _initialCombine: boolean;

    protected _botsUsed: Bot[];

    /**
     * The list of bots that were in the stack but were not dragged.
     */
    protected _botsInStack: Bot[];

    protected _hitBot: AuxBot3D;
    protected _gridOffset: Matrix4 = new Matrix4();

    private _hasGridOffset: boolean = false;
    private _targetBot: Bot = undefined;

    protected get game(): PlayerGame {
        return <PlayerGame>this._simulation3D.game;
    }

    /**
     * Create a new drag rules.
     */
    constructor(
        playerPageSimulation3D: PlayerPageSimulation3D,
        miniSimulation3D: MiniSimulation3D,
        interaction: PlayerInteractionManager,
        bots: Bot[],
        dimension: string,
        inputMethod: InputMethod,
        fromCoord?: Vector2,
        skipOnDragEvents: boolean = false,
        clickedFace?: string,
        hit?: Intersection,
        snapInterface?: SnapBotsInterface
    ) {
        super(
            playerPageSimulation3D,
            interaction,
            take(bots, 1),
            dimension,
            inputMethod,
            fromCoord,
            skipOnDragEvents,
            clickedFace,
            hit,
            snapInterface
        );

        this._botsInStack = drop(bots, 1);
        this._miniSimulation3D = miniSimulation3D;
        this._originalDimension = dimension;
        this._originallyInMiniPortal = this._inMiniPortal =
            dimension && this._miniSimulation3D.miniDimension === dimension;

        if (this._hit) {
            const obj = this._interaction.findGameObjectForHit(this._hit);
            if (obj && obj instanceof AuxBot3D) {
                this._hitBot = obj;
            }
        }
    }

    protected _createBotDragOperation(bot: Bot): IOperation {
        return new PlayerBotDragOperation(
            this._simulation3D,
            this._miniSimulation3D,
            this._interaction,
            [bot],
            this._dimension,
            this._inputMethod,
            this._fromCoord,
            true,
            this._clickedFace,
            this._hit,
            this._snapInterface
        );
    }

    protected _createModDragOperation(mod: BotTags): IOperation {
        return new PlayerModDragOperation(
            this._simulation3D,
            this._miniSimulation3D,
            this._interaction,
            mod,
            this._inputMethod,
            this._snapInterface
        );
    }

    protected _onDrag(calc: BotCalculationContext): void {
        this._updateCurrentViewport();

        // Get input ray for grid ray cast.
        let inputRay: Ray = this._getInputRay();

        const grid3D = this._inMiniPortal
            ? this._miniSimulation3D.grid3D
            : this._simulation3D.grid3D;

        const canDrag = this._canDrag(calc);

        if (!canDrag) {
            return;
        }

        this._dragInSnapSpace(calc, grid3D, inputRay);
    }

    /**
     * Drags the bot(s) in "snap" space using the raycasting mode configured on the portal.
     * @param calc
     * @param grid3D
     * @param inputRay
     */
    private _dragInSnapSpace(
        calc: BotCalculationContext,
        grid3D: Grid3D,
        inputRay: Ray
    ) {
        const { bot: other, hit } = this._raycastOtherBots(inputRay);
        this._other = other?.bot ?? null;
        this._updateGridOffset(calc, this._other);

        const botSnapOptions = this._snapInterface.botSnapOptions(
            this._other?.id
        );
        const globalSnapOptions = this._snapInterface.globalSnapOptions();

        // try snapping to bot options first,
        // then global options
        if (
            this._dragWithOptions(
                calc,
                grid3D,
                inputRay,
                other,

                // Use the grid that the target bot is on for snap points which are for this bot.
                // This will put the dragged bot into the correct dimension.
                !!other
                    ? this._simulation3D.getGridForBot(other) ?? grid3D
                    : grid3D,

                hit,
                botSnapOptions
            )
        ) {
            return;
        } else if (
            this._dragWithOptions(
                calc,
                grid3D,
                inputRay,
                other,
                null, // global options should not have a snap point grid.
                hit,
                globalSnapOptions
            )
        ) {
            return;
        }

        // if we cannot snap to anything,
        // then fallback to default positioning.
        if (this._controller) {
            // free space drag for controllers
            this._dragFreeSpace(calc, grid3D, inputRay);
            return;
        } else {
            // ground space drag for everything else
            this._dragInGroundSpace(calc, grid3D, inputRay);
        }
    }

    private _raycastOtherBots(inputRay: Ray) {
        const viewport = (this._inMiniPortal
            ? this._miniSimulation3D.getMainCameraRig()
            : this._simulation3D.getMainCameraRig()
        ).viewport;
        const {
            gameObject,
            hit,
        } = this._interaction.findHoveredGameObjectFromRay(
            inputRay,
            (obj) => {
                return (
                    obj.pointable &&
                    obj instanceof AuxBot3D &&
                    this._bots.every(
                        (b) =>
                            b.id !== obj.bot.id &&
                            !isBotChildOf(this.simulation, obj.bot, b)
                    )
                );
            },
            viewport
        );

        if (gameObject instanceof AuxBot3D) {
            return {
                bot: gameObject,
                hit,
            };
        }

        return {
            bot: null,
            hit: null,
        };
    }

    /**
     * Drags the bot(s) based on the given snap options.
     * @param calc
     * @param grid3D
     * @param inputRay
     * @param target The bot that is being targeted by the input ray. This is used to handle snapping to bot faces.
     * @param snapPointGrid The grid that should be used for snap points.
     * @param hit
     * @param options
     * @returns
     */
    private _dragWithOptions(
        calc: BotCalculationContext,
        grid3D: Grid3D,
        inputRay: Ray,
        target: AuxBot3D,
        snapPointGrid: Grid3D,
        hit: Intersection,
        options: SnapOptions
    ): boolean {
        if (!options) {
            return false;
        }

        if (options.snapPoints.length > 0) {
            if (
                this._dragWithSnapPoints(
                    calc,
                    inputRay,
                    grid3D,
                    snapPointGrid,
                    options.snapPoints
                )
            ) {
                return true;
            }
        }

        if (options.snapAxes.length > 0) {
            if (
                this._dragWithSnapAxes(
                    calc,
                    inputRay,
                    grid3D,
                    snapPointGrid,
                    options.snapAxes
                )
            ) {
                return true;
            }
        }

        if (options.snapFace) {
            if (hit && target) {
                if (this._dragInFaceSpace(calc, hit, target)) {
                    return true;
                }
            }
        }

        if (options.snapBots) {
            if (target) {
                const nextContext = target.dimension;

                this._updateCurrentDimension(nextContext);

                // update the grid offset for the current bot
                this._updateGridOffset(calc);

                const position = getBotPosition(calc, target.bot, nextContext);
                const rotation = getBotRotation(calc, target.bot, nextContext);

                this._toCoord = new Vector2(position.x, position.y);

                this._updateBotsPositions(
                    this._bots,
                    new Vector3(position.x, position.y, position.z),
                    new Euler(rotation.x, rotation.y, rotation.z, 'XYZ')
                );

                return true;
            }
        }

        if (options.snapGrid) {
            if (this._dragOnGrid(calc, grid3D, inputRay)) {
                return true;
            }
        }

        if (options.snapGround) {
            if (this._dragInGroundSpace(calc, grid3D, inputRay)) {
                return true;
            }
        }

        return false;
    }

    private _dragInFaceSpace(
        calc: BotCalculationContext,
        hit: Intersection,
        snapPointTarget: AuxBot3D
    ): boolean {
        const face = calculateHitFace(hit);
        if (face) {
            // Below we do some matrix math to calculate the position that the
            // bot should be placed at. This works by using one matrix to represent
            // the position where the bot should be and continually transforming it until we have
            // the final position.

            // The final position can be found via these steps:
            // 1. Find the offset that the bot should be placed from the center of the target bot.
            //    This offset is needed so that we take bot scales into account when positioning the dragged bot.
            // 2. Create a matrix with the offset from step 1. This is the target matrix.
            // 3. Create a matrix with the grid scale of the target bot. This is the grid scale matrix.
            //    We need this so that the offset can be scaled up/down so that the length of 1 grid unit === 1 scale unit
            // 4. Determine if the grid scale has already been applied to the target bot container object.
            //    We need this because bots apply the grid scale to their scale containers and not the container object.
            //    Child bots (via the transformer tag) have the grid scale in their container object
            //    because their parent already has further up in the chain.
            //    Normally we would just use the scale container, but we cannot because it has both the bot scale and
            //    grid scale applied to it at the same time.
            //    That means we may need to apply the grid scale manually.
            //    Also note that just because the scale has not been applied to the container object that does not mean
            //    the grid scale has not been applied to the bot position. The grid scale is always multiplied into the bot position
            //    separately.
            // 5. If the grid scale has not been applied to the target bot container, then apply the grid scale matrix.
            //    (grid scale matrix) * (target matrix)
            // 6. Invert the grid scale matrix.
            // 7. If the grid scale has not been applied to the target bot container, then apply the grid scale matrix.
            //    We need this step because otherwise the rotations from the target bot would be scaled by the grid scale.
            //    Applying the inverse of the matrix [(grid scale) * (target) * (inverse grid scale)] changes the translation
            //    but restores everything else in the matrix to its identity.
            // 8. Apply the target bot matrix to the target matrix
            //    (target bot matrix) * (target matrix)
            // 9. Get the matrix of the dimension bot and invert it.
            //    We need this because we don't want to get the world position of the bot - we only want the dimension local position.
            //    This is because dimensions themselves can be rotated and in weird orientations. We only need the grid position within the dimension.
            // 10. Apply the inverted dimension matrix to the target matrix.
            //     (inverse dimension matrix) * (target matrix)
            // 11. Apply the grid scale matrix to the target matrix.
            //     We need this because target bot matrix contains the grid scale applied to its position and we need to remove it so it will be
            //     an AUX position.
            // 12. We can now deconstruct the target matrix and convert the rest into AUX coordinates.

            // 1.
            const hitNormal = hit.face.normal.clone();
            hitNormal.normalize();

            // Calculate the relative offset needed
            // to adjust for scale differences between the parent space
            // and the local space. (e.g. if scale is 0.5 then X should be positioned at 0.75 instead of 1)
            const botScale = getBotScale(calc, this._bots[0], 1);
            const snapScale = getBotScale(calc, snapPointTarget.bot, 1);
            const halfBotScale = new Vector3(
                botScale.x * 0.5,
                // Don't offset the Z position of bots when placing on the top of a bot.
                // TODO: Support different anchor points
                0,
                botScale.y * 0.5
            );

            const halfSnapScale = new Vector3(
                snapScale.x * 0.5,
                snapScale.z,
                snapScale.y * 0.5
            );

            let parent = getBotTransformer(calc, snapPointTarget.bot);
            while (parent) {
                const parentBot = this._simulation3D.simulation.helper
                    .botsState[parent];
                if (parentBot) {
                    const parentScale = getBotScale(calc, parentBot, 1);
                    halfSnapScale.x /= parentScale.x;
                    halfSnapScale.y /= parentScale.y;
                    halfSnapScale.z /= parentScale.z;
                    parent = getBotTransformer(calc, parentBot);
                } else {
                    parent = null;
                }
            }

            halfBotScale.multiply(hitNormal);
            halfSnapScale.multiply(hitNormal);
            hitNormal.addVectors(halfBotScale, halfSnapScale);

            // 2.
            const targetMatrix = new Matrix4();
            targetMatrix.makeTranslation(hitNormal.x, hitNormal.y, hitNormal.z);

            // 3.
            const globalGridScale = snapPointTarget.calculateGridScale();
            const gridScaleMatrix = new Matrix4();
            gridScaleMatrix.makeScale(
                globalGridScale,
                globalGridScale,
                globalGridScale
            );

            // 4.
            if (snapPointTarget.isOnGrid) {
                // 5.
                targetMatrix.premultiply(gridScaleMatrix);
            }

            // 6.
            gridScaleMatrix.invert();

            if (snapPointTarget.isOnGrid) {
                // 7.
                targetMatrix.multiply(gridScaleMatrix);
            }

            // 8.
            const snapPointWorld = snapPointTarget.container.matrixWorld.clone();
            targetMatrix.premultiply(snapPointWorld);

            // 9.
            const dimensionMatrix = snapPointTarget.dimensionGroup.matrixWorld
                .clone()
                .invert();

            // 10.
            targetMatrix.premultiply(dimensionMatrix);

            // 11.
            targetMatrix.premultiply(gridScaleMatrix);

            // 12.
            const position = new Vector3();
            const rotation = new Quaternion();
            const worldScale = new Vector3();

            targetMatrix.decompose(position, rotation, worldScale);

            const auxPosition = new Matrix4().makeTranslation(
                position.x,
                -position.z,
                position.y
            );

            const auxRotation = new Matrix4().makeRotationFromQuaternion(
                rotation
            );
            convertRotationToAuxCoordinates(auxRotation);

            const auxScale = new Matrix4().makeScale(
                worldScale.x,
                worldScale.z,
                worldScale.y
            );

            const nextContext = snapPointTarget.dimension;

            this._updateCurrentDimension(nextContext);

            // update the grid offset for the current bot
            this._updateGridOffset(calc);

            const auxMatrix = new Matrix4()
                .multiply(auxPosition)
                .multiply(auxRotation)
                .multiply(auxScale)
                .premultiply(this._gridOffset);

            const finalPosition = new Vector3();
            const finalRotation = new Quaternion();
            const finalScale = new Vector3();
            auxMatrix.decompose(finalPosition, finalRotation, finalScale);

            this._toCoord = new Vector2(finalPosition.x, finalPosition.y);

            this._updateBotsPositions(
                this._bots,
                finalPosition,
                new Euler().setFromQuaternion(finalRotation)
            );

            return true;
        }
        return false;
    }

    private _dragInGroundSpace(
        calc: BotCalculationContext,
        grid3D: Grid3D,
        inputRay: Ray
    ) {
        const gridTile = grid3D.getTileFromRay(inputRay, false);
        if (gridTile) {
            // Update the next dimension
            const nextContext = this._calculateNextDimension(gridTile.grid);

            this._updateCurrentDimension(nextContext);

            // update the grid offset for the current bot
            this._updateGridOffset(calc);

            // Drag on the grid
            const result = new Vector3(
                gridTile.tileCoordinate.x,
                gridTile.tileCoordinate.y,
                0
            );
            result.applyMatrix4(this._gridOffset);
            this._toCoord = new Vector2(result.x, result.y);
            this._updateBotsPositions(this._bots, result);
            return true;
        }
        return false;
    }

    private _dragWithSnapPoints(
        calc: BotCalculationContext,
        inputRay: Ray,
        grid3D: Grid3D,
        snapPointGrid: Grid3D,
        snapPoints: SnapOptions['snapPoints']
    ): boolean {
        const grid = snapPointGrid ?? grid3D;
        let closestPoint: Vector3 = null;
        let closestSqrDistance = Infinity;
        let targetPoint = new Vector3();
        let snapPoint = new Vector3();
        for (let point of snapPoints) {
            snapPoint.set(point.position.x, point.position.y, point.position.z);
            const targetDistance = point.distance * point.distance;

            // use world space for comparing the snap point to the ray
            const convertedPoint = grid.getWorldPosition(snapPoint);
            inputRay.closestPointToPoint(convertedPoint, targetPoint);

            // convert back to grid space for comparing distances
            const closestGridPoint = grid.getGridPosition(targetPoint);
            const sqrDistance = closestGridPoint.distanceToSquared(snapPoint);

            if (sqrDistance > targetDistance) {
                continue;
            }
            if (sqrDistance < closestSqrDistance) {
                closestPoint = new Vector3(
                    point.position.x,
                    point.position.y,
                    point.position.z
                );
                closestSqrDistance = sqrDistance;
            }
        }

        if (closestPoint) {
            const nextContext = this._calculateNextDimension(grid);
            this._updateCurrentDimension(nextContext);
            this._updateGridOffset(calc);

            closestPoint.applyMatrix4(this._gridOffset);
            this._toCoord = new Vector2(closestPoint.x, closestPoint.y);

            this._updateBotsPositions(this._bots, closestPoint);
            return true;
        }

        return false;
    }

    private _dragWithSnapAxes(
        calc: BotCalculationContext,
        inputRay: Ray,
        grid3D: Grid3D,
        snapPointGrid: Grid3D,
        snapAxes: SnapAxis[]
    ): boolean {
        const grid = snapPointGrid ?? grid3D;
        let closestPoint: Vector3 = null;
        let closestSqrDistance = Infinity;
        let snapRay = new Ray();
        for (let axis of snapAxes) {
            snapRay.origin.set(axis.origin.x, axis.origin.y, axis.origin.z);
            snapRay.direction.set(
                axis.direction.x,
                axis.direction.y,
                axis.direction.z
            );

            // snapPoint.set(point.position.x, point.position.y, point.position.z);
            const targetDistance = axis.distance * axis.distance;

            // use world space for comparing the snap point to the ray
            const convertedOrigin = grid.getWorldPosition(snapRay.origin);
            const convertedDirection = grid
                .getWorldPosition(snapRay.direction)
                .normalize();

            // https://stackoverflow.com/questions/58151978/threejs-how-to-calculate-the-closest-point-on-a-three-ray-to-another-three-ray
            let inputToConvertedDirection = inputRay.direction
                .clone()
                .cross(convertedDirection);

            let Na = inputRay.direction
                .clone()
                .cross(inputToConvertedDirection)
                .normalize();
            let Nb = convertedDirection
                .clone()
                .cross(inputToConvertedDirection)
                .normalize();

            let inputDirection = inputRay.direction.clone().normalize();
            let axisDirection = convertedDirection.clone().normalize();

            let da =
                convertedOrigin.clone().sub(inputRay.origin).dot(Nb) /
                inputDirection.dot(Nb);
            let db =
                inputRay.origin.clone().sub(convertedOrigin).dot(Na) /
                axisDirection.dot(Na);

            // point on inputRay
            let inputPoint = inputRay.origin
                .clone()
                .add(inputDirection.multiplyScalar(da));

            // point on axis
            let targetPoint = convertedOrigin
                .clone()
                .add(convertedDirection.multiplyScalar(db));

            // convert back to grid space for comparing distances
            const closestGridPoint = grid.getGridPosition(targetPoint);
            const closestInputPoint = grid.getGridPosition(inputPoint);
            const sqrDistance = closestGridPoint.distanceToSquared(
                closestInputPoint
            );

            if (sqrDistance > targetDistance) {
                continue;
            }
            if (sqrDistance < closestSqrDistance) {
                closestPoint = new Vector3(
                    closestGridPoint.x,
                    closestGridPoint.y,
                    closestGridPoint.z
                );
                closestSqrDistance = sqrDistance;
            }
        }

        if (closestPoint) {
            const nextContext = this._calculateNextDimension(grid);
            this._updateCurrentDimension(nextContext);
            this._updateGridOffset(calc);

            closestPoint.applyMatrix4(this._gridOffset);
            this._toCoord = new Vector2(closestPoint.x, closestPoint.y);

            this._updateBotsPositions(this._bots, closestPoint);
            return true;
        }

        return false;
    }

    private _dragOnGrid(
        calc: BotCalculationContext,
        grid3D: Grid3D,
        inputRay: Ray
    ) {
        const gridTile = grid3D.getTileFromRay(inputRay);
        if (gridTile) {
            // Update the next context
            const nextContext = this._calculateNextDimension(gridTile.grid);

            this._updateCurrentDimension(nextContext);

            this._updateGridOffset(calc);

            // Drag on the grid
            this._dragOnGridTile(calc, gridTile);
            return true;
        }
        return false;
    }

    private _updateCurrentViewport() {
        if (!this._controller) {
            // Test to see if we are hovering over the mini simulation view.
            const pagePos = this.game.getInput().getMousePagePos();
            const miniViewport = this.game.getMiniPortalViewport();
            this._inMiniPortal = Input.pagePositionOnViewport(
                pagePos,
                miniViewport
            );
        } else {
            this._inMiniPortal = false;
        }
    }

    private _updateCurrentDimension(nextContext: string) {
        if (nextContext !== this._dimension) {
            this._previousDimension = this._dimension;
            this._dimension = nextContext;
        }
    }

    private _updateGridOffset(calc: BotCalculationContext, targetBot?: Bot) {
        if (this._hasGridOffset && this._targetBot === targetBot) {
            return;
        }
        this._targetBot = targetBot;
        this._gridOffset.identity();
        const transformer = getBotTransformer(calc, this._bots[0]);
        if (hasValue(transformer)) {
            this._hasGridOffset = true;
            let parent = calc.objects.find((bot) => bot.id === transformer);
            while (parent) {
                const pos = getBotPosition(calc, parent, this._dimension);
                const scale = getBotScale(calc, parent, 1);
                const rotation = getBotRotation(calc, parent, this._dimension);
                const anchorPointOffset = getAnchorPointOffset(calc, parent);
                let temp = new Matrix4();
                temp.makeTranslation(
                    anchorPointOffset.x * 2,
                    anchorPointOffset.y * 2,
                    anchorPointOffset.z * 2
                ).invert();
                this._gridOffset.multiply(temp);
                temp.makeScale(scale.x, scale.y, scale.z).invert();
                this._gridOffset.multiply(temp);
                temp.makeRotationFromEuler(
                    new Euler(rotation.x, rotation.y, rotation.z)
                ).invert();
                this._gridOffset.multiply(temp);
                temp.makeTranslation(pos.x, pos.y, pos.z).invert();
                this._gridOffset.multiply(temp);

                if (parent === targetBot) {
                    break;
                }

                const transformer = getBotTransformer(calc, parent);
                parent = calc.objects.find((bot) => bot.id === transformer);
            }
        }
    }

    private _canDrag(calc: BotCalculationContext) {
        return isBotMovable(calc, this._bots[0]);
    }

    private _calculateNextDimension(grid: Grid3D) {
        const dimension =
            this._simulation3D.getDimensionForGrid(grid) ||
            this._miniSimulation3D.getDimensionForGrid(grid);
        return dimension;
    }

    private _getInputRay() {
        let inputRay: Ray;
        if (this._controller) {
            inputRay = objectForwardRay(this._controller.ray);
        } else {
            // Get input ray from correct camera based on which dimension we are in.
            const pagePos = this.game.getInput().getMousePagePos();
            const miniViewport = this.game.getMiniPortalViewport();
            if (this._inMiniPortal) {
                inputRay = Physics.screenPosToRay(
                    Input.screenPositionForViewport(pagePos, miniViewport),
                    this._miniSimulation3D.getMainCameraRig().mainCamera
                );
            } else {
                inputRay = Physics.screenPosToRay(
                    this.game.getInput().getMouseScreenPos(),
                    this._simulation3D.getMainCameraRig().mainCamera
                );
            }
        }
        return inputRay;
    }

    /**
     * Drags the bot(s) in free space.
     * @param calc
     * @param grid3D
     * @param inputRay
     */
    private _dragFreeSpace(
        calc: BotCalculationContext,
        grid3D: Grid3D,
        inputRay: Ray
    ) {
        const attachPoint = new Group();
        this._controller.ray.add(attachPoint);

        const size = new Vector3();
        this._hitBot.boundingBox.getSize(size);
        attachPoint.position
            .add(new Vector3(0, 0, -0.25))
            .add(new Vector3(0, -(size.y / 2), 0));
        attachPoint.updateMatrixWorld(true);
        const targetMatrix = attachPoint.matrixWorld.clone();
        this._controller.ray.remove(attachPoint);

        const transformer = getBotTransformer(calc, this._bot);
        let hasTransformer = false;
        if (transformer) {
            // TODO: Figure out how to support cases where there are multiple bots for the parent.
            const parents = this._simulation3D.findBotsById(transformer);
            if (parents.length > 0) {
                const parent = parents[0];
                if (parent instanceof AuxBot3D) {
                    hasTransformer = true;
                    const matrixWorldInverse = new Matrix4();
                    matrixWorldInverse
                        .copy(parent.transformContainer.matrixWorld)
                        .invert();

                    targetMatrix.premultiply(matrixWorldInverse);
                }
            }
        }

        const finalWorldPosition = new Vector3();
        const quaternion = new Quaternion();
        const finalWorldScale = new Vector3();
        targetMatrix.decompose(finalWorldPosition, quaternion, finalWorldScale);

        // When we have transformed the target matrix,
        // it automatically includes the grid scale adjustments,
        // but it does not swap the axes.
        const gridPosition = hasTransformer
            ? new Vector3(
                  finalWorldPosition.x,
                  -finalWorldPosition.z,
                  finalWorldPosition.y
              )
            : grid3D.getGridPosition(finalWorldPosition);
        const threeSpaceRotation: Euler = new Euler().setFromQuaternion(
            quaternion
        );
        const auxSpaceRotation = new Euler(
            threeSpaceRotation.x,
            threeSpaceRotation.z,
            threeSpaceRotation.y
        );
        this._updateBotsPositions(this._bots, gridPosition, auxSpaceRotation);
    }

    /**
     * Drags the bot(s) on the grid to the given tile.
     * @param calc
     * @param grid3D
     * @param gridTile
     */
    private _dragOnGridTile(calc: BotCalculationContext, gridTile: GridTile) {
        if (gridTile) {
            const result = new Vector3(
                gridTile.tileCoordinate.x,
                gridTile.tileCoordinate.y,
                0
            );
            result.applyMatrix4(this._gridOffset);
            this._toCoord = new Vector2(result.x, result.y);
            this._updateBotsPositions(this._bots, result);
        }
    }

    protected async _updateBotsPositions(
        bots: Bot[],
        gridPosition: Vector3 | Vector2,
        rotation: Euler = new Euler()
    ) {
        this._sendDropEnterExitEvents(this._other);
        super._updateBotsPositions(bots, gridPosition, rotation);
    }

    protected _onDragReleased(calc: BotCalculationContext): void {
        super._onDragReleased(calc);
    }
}
