import { BaseBotDragOperation } from '../../../shared/interaction/DragOperation/BaseBotDragOperation';
import {
    Bot,
    BotCalculationContext,
    getBotDragMode,
    BotDragMode,
    objectsAtDimensionGridPosition,
    calculateBotDragStackPosition,
    BotTags,
    BotPositioningMode,
    getBotPositioningMode,
    getBotPosition,
    getBotIndex,
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
} from 'three';
import { Physics } from '../../../shared/scene/Physics';
import { Input, InputMethod } from '../../../shared/scene/Input';
import { PlayerPageSimulation3D } from '../../scene/PlayerPageSimulation3D';
import { InventorySimulation3D } from '../../scene/InventorySimulation3D';
import { PlayerGame } from '../../scene/PlayerGame';
import take from 'lodash/take';
import drop from 'lodash/drop';
import { IOperation } from '../../../shared/interaction/IOperation';
import { PlayerModDragOperation } from './PlayerModDragOperation';
import { objectForwardRay } from '../../../shared/scene/SceneUtils';
import { DebugObjectManager } from '../../../shared/scene/debugobjectmanager/DebugObjectManager';
import { AuxBot3D } from '../../../shared/scene/AuxBot3D';
import { Grid3D, GridTile } from '../../Grid3D';

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
        hit?: Intersection
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
            hit
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
            this._hit
        );
    }

    protected _createModDragOperation(mod: BotTags): IOperation {
        return new PlayerModDragOperation(
            this._simulation3D,
            this._inventorySimulation3D,
            this._interaction,
            mod,
            this._inputMethod
        );
    }

    protected _onDrag(calc: BotCalculationContext): void {
        this._updateCurrentViewport();

        // Get input ray for grid ray cast.
        let inputRay: Ray = this._getInputRay();

        const grid3D = this._inInventory
            ? this._inventorySimulation3D.grid3D
            : this._simulation3D.grid3D;

        if (
            this._controller &&
            this._getBotsPositioningMode(calc) === 'absolute'
        ) {
            // Drag in free space
            this._dragFreeSpace(calc, grid3D, inputRay);
            return;
        }

        this._dragInGridSpace(calc, grid3D, inputRay);
    }

    /**
     * Drags the bot(s) in grid space using the raycasting mode configured on the portal.
     * @param calc
     * @param grid3D
     * @param inputRay
     */
    private _dragInGridSpace(
        calc: BotCalculationContext,
        grid3D: Grid3D,
        inputRay: Ray
    ) {
        const gridTile = grid3D.getTileFromRay(inputRay);

        if (!gridTile) {
            return;
        }

        const raycastMode = this._calculateRaycastMode(gridTile);

        if (raycastMode === 'grid') {
            this._dragOnGrid(calc, gridTile);
        } else {
            const viewport = (this._inInventory
                ? this._inventorySimulation3D.getMainCameraRig()
                : this._simulation3D.getMainCameraRig()
            ).viewport;
            const {
                gameObject,
                hit,
            } = this._interaction.findHoveredGameObjectFromRay(
                inputRay,
                hit => {
                    const obj = this._interaction.findGameObjectForHit(hit);
                    return (
                        obj &&
                        obj instanceof AuxBot3D &&
                        !this._bots.find(b => b.id === obj.bot.id)
                    );
                },
                viewport
            );

            if (gameObject instanceof AuxBot3D) {
                const nextContext = gameObject.dimension;
                const canDragIntoDimension = this._canDragInDimension(
                    calc,
                    nextContext
                );

                if (!canDragIntoDimension) {
                    return;
                }

                this._updateCurrentDimension(nextContext);

                // Drag on the grid
                const botPosition = getBotPosition(
                    calc,
                    gameObject.bot,
                    nextContext
                );
                const botIndex = getBotIndex(calc, gameObject.bot, nextContext);
                const coord = (this._toCoord = new Vector2(
                    botPosition.x,
                    botPosition.y
                ));
                this._other = gameObject.bot;
                this._sendDropEnterExitEvents(this._other);

                this._updateBotsPositions(
                    this._bots,
                    coord,
                    botIndex + 1,
                    calc
                );
            } else {
                this._dragOnGrid(calc, gridTile);
            }
        }
    }

    private _dragOnGrid(calc: BotCalculationContext, gridTile: GridTile) {
        // Update the next context
        const nextContext = this._calculateNextDimension(gridTile);

        const canDragIntoDimension = this._canDragInDimension(
            calc,
            nextContext
        );

        if (!canDragIntoDimension) {
            return;
        }

        this._updateCurrentDimension(nextContext);

        // Drag on the grid
        this._dragOnGridTile(calc, gridTile);
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

    private _canDragInDimension(
        calc: BotCalculationContext,
        nextContext: string
    ) {
        const mode = getBotDragMode(calc, this._bots[0]);
        const changingContexts = this._originalDimension !== nextContext;
        let canDrag = false;

        if (!changingContexts && this._canDragWithinContext(mode)) {
            canDrag = true;
        } else if (changingContexts && this._canDragOutOfContext(mode)) {
            canDrag = true;
        }

        return canDrag;
    }

    /**
     * Calculates the raycast mode for the portal that contains the given grid tile.
     * @param tile
     */
    private _calculateRaycastMode(tile: GridTile) {
        const config =
            this._simulation3D.getPortalConfigForGrid(tile.grid) ||
            this._inventorySimulation3D.getPortalConfigForGrid(tile.grid);
        return config.raycastMode;
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
        const finalWorldPosition = new Vector3();
        attachPoint.getWorldPosition(finalWorldPosition);
        const quaternion = new Quaternion();
        attachPoint.getWorldQuaternion(quaternion);
        this._controller.ray.remove(attachPoint);

        const gridPosition = grid3D.getGridPosition(finalWorldPosition);
        const threeSpaceRotation: Euler = new Euler().setFromQuaternion(
            quaternion
        );
        const auxSpaceRotation = new Euler(
            threeSpaceRotation.x,
            threeSpaceRotation.z,
            threeSpaceRotation.y
        );
        this._updateBotsPositions(
            this._bots,
            gridPosition,
            0,
            calc,
            auxSpaceRotation
        );
    }

    /**
     * Drags the bot(s) on the grid to the given tile.
     * @param calc
     * @param grid3D
     * @param gridTile
     */
    private _dragOnGridTile(calc: BotCalculationContext, gridTile: GridTile) {
        if (gridTile) {
            this._toCoord = gridTile.tileCoordinate;
            const result = calculateBotDragStackPosition(
                calc,
                this._dimension,
                gridTile.tileCoordinate,
                ...this._bots
            );
            this._other = result.other;
            this._sendDropEnterExitEvents(this._other);
            if (result.stackable || result.index === 0) {
                this._updateBotsPositions(
                    this._bots,
                    gridTile.tileCoordinate,
                    result.index,
                    calc
                );
            } else if (!result.stackable) {
                this._updateBotsPositions(
                    this._bots,
                    gridTile.tileCoordinate,
                    0,
                    calc
                );
            }
        }
    }

    private _getBotsPositioningMode(
        calc: BotCalculationContext
    ): BotPositioningMode {
        if (this._bots.length === 1) {
            return getBotPositioningMode(calc, this._bots[0]);
        } else {
            return 'stack';
        }
    }

    protected _canDragWithinContext(mode: BotDragMode): boolean {
        return this._isDraggable(mode);
    }

    protected _canDragOutOfContext(mode: BotDragMode): boolean {
        return this._isPickupable(mode);
    }

    private _isPickupable(mode: BotDragMode): boolean {
        return mode === 'all' || mode === 'pickupOnly';
    }

    private _isDraggable(mode: BotDragMode): boolean {
        return mode === 'all' || mode === 'moveOnly';
    }

    protected _onDragReleased(calc: BotCalculationContext): void {
        super._onDragReleased(calc);
    }
}
