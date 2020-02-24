import { BaseBotDragOperation } from '../../../shared/interaction/DragOperation/BaseBotDragOperation';
import {
    Bot,
    BotCalculationContext,
    getBotDragMode,
    BotDragMode,
    objectsAtDimensionGridPosition,
    calculateBotDragStackPosition,
    BotTags,
} from '@casual-simulation/aux-common';
import { PlayerInteractionManager } from '../PlayerInteractionManager';
import { Intersection, Vector2, Ray } from 'three';
import { Physics } from '../../../shared/scene/Physics';
import { Input, InputMethod } from '../../../shared/scene/Input';
import { PlayerSimulation3D } from '../../scene/PlayerSimulation3D';
import { InventorySimulation3D } from '../../scene/InventorySimulation3D';
import { PlayerGame } from '../../scene/PlayerGame';
import take from 'lodash/take';
import drop from 'lodash/drop';
import { IOperation } from '../../../shared/interaction/IOperation';
import { PlayerModDragOperation } from './PlayerModDragOperation';
import { objectForwardRay } from '../../../shared/scene/SceneUtils';

export class PlayerBotDragOperation extends BaseBotDragOperation {
    // This overrides the base class BaseInteractionManager
    protected _interaction: PlayerInteractionManager;
    // This overrides the base class Simulation3D
    protected _simulation3D: PlayerSimulation3D;

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

    protected get game(): PlayerGame {
        return <PlayerGame>this._simulation3D.game;
    }

    /**
     * Create a new drag rules.
     */
    constructor(
        playerSimulation3D: PlayerSimulation3D,
        inventorySimulation3D: InventorySimulation3D,
        interaction: PlayerInteractionManager,
        bots: Bot[],
        dimension: string,
        inputMethod: InputMethod,
        fromCoord?: Vector2,
        skipOnDragEvents: boolean = false,
        clickedFace?: string
    ) {
        super(
            playerSimulation3D,
            interaction,
            take(bots, 1),
            dimension,
            inputMethod,
            fromCoord,
            skipOnDragEvents,
            clickedFace
        );

        this._botsInStack = drop(bots, 1);
        this._inventorySimulation3D = inventorySimulation3D;
        this._originalDimension = dimension;
        this._originallyInInventory = this._inInventory =
            dimension &&
            this._inventorySimulation3D.inventoryDimension === dimension;
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
            this._clickedFace
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

        // Get grid tile from correct simulation grid.
        const grid3D = this._inInventory
            ? this._inventorySimulation3D.grid3D
            : this._simulation3D.grid3D;
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
