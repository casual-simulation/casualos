import { BaseFileDragOperation } from '../../../shared/interaction/DragOperation/BaseFileDragOperation';
import {
    Bot,
    BotCalculationContext,
    isPickupable,
    isBotMovable,
    getBotDragMode,
    FileDragMode,
    objectsAtContextGridPosition,
} from '@casual-simulation/aux-common';
import { PlayerInteractionManager } from '../PlayerInteractionManager';
import PlayerGameView from '../../PlayerGameView/PlayerGameView';
import { Intersection, Vector2, Ray } from 'three';
import { Physics } from '../../../shared/scene/Physics';
import { Input } from '../../../shared/scene/Input';
import { PlayerSimulation3D } from '../../scene/PlayerSimulation3D';
import { InventorySimulation3D } from '../../scene/InventorySimulation3D';
import { PlayerGame } from '../../scene/PlayerGame';
import { VRController3D } from '../../../shared/scene/vr/VRController3D';
import { differenceBy, take, drop } from 'lodash';

export class PlayerFileDragOperation extends BaseFileDragOperation {
    // This overrides the base class BaseInteractionManager
    protected _interaction: PlayerInteractionManager;
    // This overrides the base class Simulation3D
    protected _simulation3D: PlayerSimulation3D;

    protected _inventorySimulation3D: InventorySimulation3D;

    // Determines if the file is in the inventory currently
    protected _inInventory: boolean;

    // Determines if the file was in the inventory at the beginning of the drag operation
    protected _originallyInInventory: boolean;

    protected _originalContext: string;

    protected _initialCombine: boolean;

    protected _filesUsed: Bot[];

    /**
     * The list of files that were in the stack but were not dragged.
     */
    protected _filesInStack: Bot[];

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
        files: Bot[],
        context: string,
        vrController: VRController3D | null,
        fromCoord?: Vector2
    ) {
        super(
            playerSimulation3D,
            interaction,
            take(files, 1),
            context,
            vrController,
            fromCoord
        );

        this._filesInStack = drop(files, 1);
        this._inventorySimulation3D = inventorySimulation3D;
        this._originalContext = context;
        this._originallyInInventory = this._inInventory =
            context && this._inventorySimulation3D.inventoryContext === context;
    }

    protected _onDrag(calc: BotCalculationContext): void {
        const mode = getBotDragMode(calc, this._files[0]);

        let nextContext = this._simulation3D.context;

        if (!this._vrController) {
            // Test to see if we are hovering over the inventory simulation view.
            const pagePos = this.game.getInput().getMousePagePos();
            const inventoryViewport = this.game.getInventoryViewport();
            if (Input.pagePositionOnViewport(pagePos, inventoryViewport)) {
                nextContext = this._inventorySimulation3D.inventoryContext;
            }
        }

        const changingContexts = this._originalContext !== nextContext;
        let canDrag = false;

        if (!changingContexts && this._canDragWithinContext(mode)) {
            canDrag = true;
        } else if (changingContexts && this._canDragOutOfContext(mode)) {
            canDrag = true;
        }

        if (!canDrag) {
            return;
        }

        if (nextContext !== this._context) {
            this._previousContext = this._context;
            this._context = nextContext;
            this._inInventory =
                nextContext === this._inventorySimulation3D.inventoryContext;
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

            const result = this._calculateFileDragStackPosition(
                calc,
                this._context,
                gridTile.tileCoordinate,
                ...this._files
            );

            this._combine = result.combine;
            this._other = result.other;
            this._merge = result.merge;

            let sim = this._simulation3D.simulation;

            if (this._combine && !this._initialCombine) {
                this._initialCombine = true;

                const objs = differenceBy(
                    objectsAtContextGridPosition(
                        calc,
                        this._context,
                        gridTile.tileCoordinate
                    ),
                    this._files,
                    f => f.id
                );

                this._filesUsed = [this._files[0], objs[0]];

                sim.helper.action(
                    'onCombineEnter',
                    [this._filesUsed[0]],
                    this._filesUsed[1]
                );

                sim.helper.action(
                    'onCombineEnter',
                    [this._filesUsed[1]],
                    this._filesUsed[0]
                );
            } else if (!this._combine && this._initialCombine) {
                this._initialCombine = false;

                sim.helper.action(
                    'onCombineExit',
                    [this._filesUsed[0]],
                    this._filesUsed[1]
                );

                sim.helper.action(
                    'onCombineExit',
                    [this._filesUsed[1]],
                    this._filesUsed[0]
                );
            }

            if (result.stackable || result.index === 0) {
                this._updateFilesPositions(
                    this._files,
                    gridTile.tileCoordinate,
                    result.index
                );
            }
        }
    }

    protected _canDragWithinContext(mode: FileDragMode): boolean {
        return this._isDraggable(mode);
    }

    protected _canDragOutOfContext(mode: FileDragMode): boolean {
        return this._isPickupable(mode);
    }

    private _isPickupable(mode: FileDragMode): boolean {
        return mode === 'all' || mode === 'pickup';
    }

    private _isDraggable(mode: FileDragMode): boolean {
        return mode === 'all' || mode === 'drag';
    }

    protected _onDragReleased(calc: BotCalculationContext): void {
        super._onDragReleased(calc);
    }
}
