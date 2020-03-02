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
import { PlayerGrid3D } from '../../PlayerGrid3D';
import { DebugObjectManager } from '../../../shared/scene/debugobjectmanager/DebugObjectManager';
import { AuxBot3D } from '../../../shared/scene/AuxBot3D';

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
        const mode = getBotDragMode(calc, this._bots[0]);

        let nextContext = this._simulation3D.dimension;

        if (!this._controller) {
            // Test to see if we are hovering over the inventory simulation view.
            const pagePos = this.game.getInput().getMousePagePos();
            const inventoryViewport = this.game.getInventoryViewport();
            if (Input.pagePositionOnViewport(pagePos, inventoryViewport)) {
                nextContext = this._inventorySimulation3D.inventoryDimension;
            }
        }

        const changingContexts = this._originalDimension !== nextContext;
        let canDrag = false;

        if (!changingContexts && this._canDragWithinContext(mode)) {
            canDrag = true;
        } else if (changingContexts && this._canDragOutOfContext(mode)) {
            canDrag = true;
        }

        if (!canDrag) {
            return;
        }

        if (nextContext !== this._dimension) {
            this._previousDimension = this._dimension;
            this._dimension = nextContext;
            this._inInventory =
                nextContext === this._inventorySimulation3D.inventoryDimension;
        }

        // Get input ray for grid ray cast.
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

        const grid3D = this._inInventory
            ? this._inventorySimulation3D.primaryPortal.grid3D
            : this._simulation3D.primaryPortal.grid3D;
        if (
            this._controller &&
            this._getBotsPositioningMode(calc) === 'absolute'
        ) {
            this._dragFreeSpace(calc, grid3D, inputRay);
        } else {
            // Get grid tile from correct simulation grid.
            this._dragOnGrid(calc, grid3D, inputRay);
        }
    }

    private _dragFreeSpace(
        calc: BotCalculationContext,
        grid3D: PlayerGrid3D,
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

    private _dragOnGrid(
        calc: BotCalculationContext,
        grid3D: PlayerGrid3D,
        inputRay: Ray
    ) {
        const gridTile = grid3D.getTileFromRay(inputRay);
        if (gridTile) {
            this._toCoord = gridTile.tileCoordinate;
            const result = calculateBotDragStackPosition(
                calc,
                this._dimension,
                gridTile.tileCoordinate,
                ...this._bots
            );
            this._other = result.other;
            this._merge = result.merge;
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
