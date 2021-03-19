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
import { InventorySimulation3D } from '../../scene/InventorySimulation3D';
import { PlayerGame } from '../../scene/PlayerGame';
import { take, drop } from 'lodash';
import { IOperation } from '../../../shared/interaction/IOperation';
import { PlayerModDragOperation } from './PlayerModDragOperation';
import {
    calculateHitFace,
    objectForwardRay,
} from '../../../shared/scene/SceneUtils';
import { DebugObjectManager } from '../../../shared/scene/debugobjectmanager/DebugObjectManager';
import { AuxBot3D } from '../../../shared/scene/AuxBot3D';
import { Grid3D, GridTile } from '../../Grid3D';
import { BoundedGrid3D } from '../../BoundedGrid3D';
import { CompoundGrid3D } from '../../CompoundGrid3D';
import {
    SnapBotsInterface,
    SnapOptions,
} from '../../../shared/interaction/DragOperation/SnapInterface';

export class PlayerBotDragOperation extends BaseBotDragOperation {
    // This overrides the base class BaseInteractionManager
    protected _interaction: PlayerInteractionManager;
    // This overrides the base class Simulation3D
    protected _simulation3D: PlayerPageSimulation3D;

    protected _inventorySimulation3D: InventorySimulation3D;

    // Determines if the bot is in the inventory currently
    protected _inInventory: boolean;

    // Determines if the bot was in the inventory at the beginning of the drag operation
    protected _originallyInInventory: boolean;

    protected _originalDimension: string;

    protected _initialCombine: boolean;

    protected _botsUsed: Bot[];

    /**
     * The list of bots that were in the stack but were not dragged.
     */
    protected _botsInStack: Bot[];

    protected _hitBot: AuxBot3D;
    protected _gridOffset: Vector2 = new Vector2(0, 0);
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
        inventorySimulation3D: InventorySimulation3D,
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
        this._inventorySimulation3D = inventorySimulation3D;
        this._originalDimension = dimension;
        this._originallyInInventory = this._inInventory =
            dimension &&
            this._inventorySimulation3D.inventoryDimension === dimension;

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
            this._inventorySimulation3D,
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
            this._inventorySimulation3D,
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

        const grid3D = this._inInventory
            ? this._inventorySimulation3D.grid3D
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
                this._other,
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
                this._other,
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
        const viewport = (this._inInventory
            ? this._inventorySimulation3D.getMainCameraRig()
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
                    !this._bots.find((b) => b.id === obj.bot.id)
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

    private _dragWithOptions(
        calc: BotCalculationContext,
        grid3D: Grid3D,
        inputRay: Ray,
        other: Bot,
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
                    options.snapPoints
                )
            ) {
                return true;
            }
        }

        if (options.snapFace) {
            if (hit) {
                const face = calculateHitFace(hit);
                if (face) {
                    console.log('snap to face');
                    // TODO: make sure to update grid offsets too
                }
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

    private _dragInGroundSpace(
        calc: BotCalculationContext,
        grid3D: Grid3D,
        inputRay: Ray
    ) {
        const point = grid3D.getPointFromRay(inputRay);
        const gridTile = grid3D.getTileFromRay(inputRay);
        if (point && gridTile) {
            const position = grid3D.getGridPosition(point);

            // Update the next dimension
            const nextContext = this._calculateNextDimension(gridTile);

            this._updateCurrentDimension(nextContext);

            // update the grid offset for the current bot
            this._updateGridOffset(calc);

            // Drag on the grid
            this._toCoord = new Vector2(position.x, position.y).clone();
            this._toCoord.add(this._gridOffset);

            this._updateBotsPositions(this._bots, position);
            return true;
        }
        return false;
    }

    private _dragWithSnapPoints(
        calc: BotCalculationContext,
        inputRay: Ray,
        grid3D: Grid3D,
        snapPoints: SnapOptions['snapPoints']
    ): boolean {
        let closestPoint: Vector3 = null;
        let closestSqrDistance = Infinity;
        for (let point of snapPoints) {
            const targetDistance = point.distance * point.distance;
            const convertedPoint = grid3D.getGridPosition(point.point);
            const sqrDistance = inputRay.distanceSqToPoint(convertedPoint);

            if (sqrDistance > targetDistance) {
                continue;
            }
            if (sqrDistance < closestSqrDistance) {
                closestPoint = new Vector3(
                    point.point.x,
                    point.point.y,
                    point.point.z
                );
                closestSqrDistance = sqrDistance;
            }
        }

        if (closestPoint) {
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
            const nextContext = this._calculateNextDimension(gridTile);

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
            // Test to see if we are hovering over the inventory simulation view.
            const pagePos = this.game.getInput().getMousePagePos();
            const inventoryViewport = this.game.getInventoryViewport();
            this._inInventory = Input.pagePositionOnViewport(
                pagePos,
                inventoryViewport
            );
        } else {
            this._inInventory = false;
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
        this._gridOffset.set(0, 0);
        const transformer = getBotTransformer(calc, this._bots[0]);
        if (hasValue(transformer)) {
            this._hasGridOffset = true;
            let parent = calc.objects.find((bot) => bot.id === transformer);
            while (parent) {
                const pos = getBotPosition(calc, parent, this._dimension);
                this._gridOffset.sub(new Vector2(pos.x, pos.y));

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

    private _calculateNextDimension(tile: GridTile) {
        const dimension =
            this._simulation3D.getDimensionForGrid(tile.grid) ||
            this._inventorySimulation3D.getDimensionForGrid(tile.grid);
        return dimension;
    }

    private _getInputRay() {
        let inputRay: Ray;
        if (this._controller) {
            inputRay = objectForwardRay(this._controller.ray);
        } else {
            // Get input ray from correct camera based on which dimension we are in.
            const pagePos = this.game.getInput().getMousePagePos();
            const inventoryViewport = this.game.getInventoryViewport();
            if (this._inInventory) {
                inputRay = Physics.screenPosToRay(
                    Input.screenPositionForViewport(pagePos, inventoryViewport),
                    this._inventorySimulation3D.getMainCameraRig().mainCamera
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
            const parents = this.game.findBotsById(transformer);
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
            this._toCoord = gridTile.tileCoordinate.clone();
            this._toCoord.add(this._gridOffset);
            this._updateBotsPositions(this._bots, this._toCoord);
        }
    }

    protected async _updateBotsPositions(
        bots: Bot[],
        gridPosition: Vector3 | Vector2,
        rotation?: Euler
    ) {
        this._sendDropEnterExitEvents(this._other);
        super._updateBotsPositions(bots, gridPosition, rotation);
    }

    protected _onDragReleased(calc: BotCalculationContext): void {
        super._onDragReleased(calc);
    }
}
