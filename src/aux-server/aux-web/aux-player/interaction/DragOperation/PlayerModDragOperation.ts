import { Physics } from '../../../shared/scene/Physics';
import {
    Bot,
    PartialBot,
    botAdded,
    BotAction,
    BotTags,
    calculateBotDragStackPosition,
    objectsAtContextGridPosition,
} from '@casual-simulation/aux-common/bots';
import {
    createBot,
    BotCalculationContext,
    CREATE_ACTION_NAME,
} from '@casual-simulation/aux-common';
import { Simulation3D } from '../../../shared/scene/Simulation3D';
import { VRController3D } from '../../../shared/scene/vr/VRController3D';
import { BaseModDragOperation } from '../../../shared/interaction/DragOperation/BaseModDragOperation';
import { WorkspaceMesh } from '../../../shared/scene/WorkspaceMesh';
import { Vector2, Ray } from 'three';
import { PlayerInteractionManager } from '../PlayerInteractionManager';
import { InventorySimulation3D } from '../../scene/InventorySimulation3D';
import { PlayerSimulation3D } from '../../scene/PlayerSimulation3D';
import { PlayerGame } from '../../scene/PlayerGame';
import { Input } from '../../../shared/scene/Input';
import differenceBy from 'lodash/differenceBy';
import { ContextGroup3D } from '../../../shared/scene/ContextGroup3D';

/**
 * Mod drag operation handles dragging mods
 */
export class PlayerModDragOperation extends BaseModDragOperation {
    public static readonly FreeDragDistance: number = 6;

    protected _interaction: PlayerInteractionManager;
    protected _simulation3D: PlayerSimulation3D;
    protected _inventorySimulation3D: InventorySimulation3D;
    // Determines if the bot is in the inventory currently
    protected _inInventory: boolean;

    // Determines if the bot was in the inventory at the beginning of the drag operation
    protected _originallyInInventory: boolean;

    protected _originalContext: string;

    protected _sentDropEnter: boolean;
    protected _dropEnterBot: Bot;

    protected get game(): PlayerGame {
        return <PlayerGame>this._simulation3D.game;
    }

    /**
     * Create a new drag rules.
     */
    constructor(
        simulation3D: PlayerSimulation3D,
        inventorySimulation3D: InventorySimulation3D,
        interaction: PlayerInteractionManager,
        mod: BotTags,
        vrController: VRController3D | null
    ) {
        super(simulation3D, interaction, mod, vrController);
        this._inventorySimulation3D = inventorySimulation3D;
    }

    _onDrag(calc: BotCalculationContext) {
        // TODO: This needs a refactor to share more code with
        //       PlayerBotDragOperation.

        let nextContext = this._simulation3D.context;

        if (!this._vrController) {
            // Test to see if we are hovering over the inventory simulation view.
            const pagePos = this.game.getInput().getMousePagePos();
            const inventoryViewport = this.game.getInventoryViewport();
            if (Input.pagePositionOnViewport(pagePos, inventoryViewport)) {
                nextContext = this._inventorySimulation3D.inventoryContext;
            }
        }

        let canDrag = true;

        if (!canDrag) {
            return;
        }

        if (nextContext !== this._context) {
            this._previousContext = this._context;
            this._context = nextContext;
            this._inInventory =
                nextContext === this._inventorySimulation3D.inventoryContext;
        }

        if (this._inInventory) {
            const context = this._inventorySimulation3D.inventoryContext;
            this.contextGroup = <ContextGroup3D>(
                this._inventorySimulation3D.contexts.find(c =>
                    c.contexts.has(context)
                )
            );
        } else {
            const context = this._simulation3D.context;
            this.contextGroup = <ContextGroup3D>(
                this._simulation3D.contexts.find(c => c.contexts.has(context))
            );
        }

        // Get input ray for grid ray cast.
        let inputRay: Ray;
        if (this._vrController) {
            inputRay = this._vrController.pointerRay.clone();
        } else {
            // Get input ray from correct camera based on which context we are in.
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
                this._context,
                gridTile.tileCoordinate,
                this._mod
            );

            this._other = result.other;
            this._merge = result.merge;

            this._sendDropEnterExitEvents(this._merge ? this._other : null);

            if (result.stackable || result.index === 0) {
                this._updateModPosition(
                    calc,
                    gridTile.tileCoordinate,
                    result.index
                );
            }
        }
    }
}
