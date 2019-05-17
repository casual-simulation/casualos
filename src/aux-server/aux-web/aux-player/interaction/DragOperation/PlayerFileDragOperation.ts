import { BaseFileDragOperation } from '../../../shared/interaction/DragOperation/BaseFileDragOperation';
import {
    File,
    FileCalculationContext,
    DRAG_OUT_OF_INVENTORY_ACTION_NAME,
    DROP_IN_INVENTORY_ACTION_NAME,
    FileEvent,
    DRAG_ANY_OUT_OF_CONTEXT_ACTION_NAME,
    convertToFormulaObject,
    DROP_ANY_IN_INVENTORY_ACTION_NAME,
    DRAG_ANY_OUT_OF_INVENTORY_ACTION_NAME,
    isPickupable,
    isFileMovable,
    getFileDragMode,
    FileDragMode,
} from '@casual-simulation/aux-common';
import { PlayerInteractionManager } from '../PlayerInteractionManager';
import GameView from '../../GameView/GameView';
import { Intersection, Vector2, Ray } from 'three';
import { Physics } from '../../../shared/scene/Physics';
import { Input } from '../../../shared/scene/Input';
import { PlayerSimulation3D } from '../../scene/PlayerSimulation3D';
import next from 'vhost';
import { InventorySimulation3D } from '../../scene/InventorySimulation3D';

export class PlayerFileDragOperation extends BaseFileDragOperation {
    // This overrides the base class BaseInteractionManager
    protected _interaction: PlayerInteractionManager;
    // This overrides the base class IGameView
    protected _simulation3D: PlayerSimulation3D;

    protected _inventorySimulation3D: InventorySimulation3D;

    // Determines if the file is in the inventory currently
    protected _inInventory: boolean;

    // Determines if the file was in the inventory at the beginning of the drag operation
    protected _originallyInInventory: boolean;

    protected _originalContext: string;

    /**
     * Create a new drag rules.
     */
    constructor(
        playerSimulation3D: PlayerSimulation3D,
        inventorySimulation3D: InventorySimulation3D,
        interaction: PlayerInteractionManager,
        files: File[],
        context: string
    ) {
        super(playerSimulation3D, interaction, files, context);
        this._inventorySimulation3D = inventorySimulation3D;
        this._originalContext = context;
        this._originallyInInventory = this._inInventory =
            context && this._inventorySimulation3D.inventoryContext === context;
    }

    protected _onDrag(calc: FileCalculationContext): void {
        const mode = getFileDragMode(calc, this._files[0]);

        let nextContext = this._simulation3D.context;

        // TODO: Detect that we are hovering over the inventory simulation scene.
        // if (vueElement && vueElement instanceof InventoryFile) {
        //     nextContext = this._simulation3D.inventoryContext.context;
        // }

        let changingContexts = this._originalContext !== nextContext;
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

        // Get input ray from correct camera based on which context we are in.
        let mouseDir: Ray;
        if (this._context === this._inventorySimulation3D.inventoryContext) {
            mouseDir = Physics.screenPosToRay(
                this.gameView.getInput().getMouseScreenPos(),
                this._inventorySimulation3D.getMainCamera()
            );
        } else {
            mouseDir = Physics.screenPosToRay(
                this.gameView.getInput().getMouseScreenPos(),
                this._simulation3D.getMainCamera()
            );
        }

        const { good, gridTile } = this._interaction.pointOnGrid(
            calc,
            mouseDir
        );

        if (good) {
            const result = this._calculateFileDragStackPosition(
                calc,
                this._context,
                gridTile.tileCoordinate,
                ...this._files
            );

            this._combine = result.combine;
            this._other = result.other;

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

    protected _onDragReleased(calc: FileCalculationContext): void {
        super._onDragReleased(calc);

        if (this._originallyInInventory && !this._inInventory) {
            let events: FileEvent[] = [];
            let result = this.simulation.helper.actionEvents(
                DRAG_OUT_OF_INVENTORY_ACTION_NAME,
                this._files
            );
            events.push(...result.events);
            result = this.simulation.helper.actionEvents(
                DRAG_ANY_OUT_OF_INVENTORY_ACTION_NAME,
                null,
                this._files
            );
            events.push(...result.events);

            this.simulation.helper.transaction(...events);
        } else if (!this._originallyInInventory && this._inInventory) {
            let events: FileEvent[] = [];
            let result = this.simulation.helper.actionEvents(
                DROP_IN_INVENTORY_ACTION_NAME,
                this._files
            );
            events.push(...result.events);
            result = this.simulation.helper.actionEvents(
                DROP_ANY_IN_INVENTORY_ACTION_NAME,
                null,
                this._files
            );
            events.push(...result.events);

            this.simulation.helper.transaction(...events);
        }
    }
}
