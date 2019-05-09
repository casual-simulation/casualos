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
import { Intersection, Vector2 } from 'three';
import { Physics } from '../../../shared/scene/Physics';
import { Input } from '../../../shared/scene/Input';
import InventoryFile from '../../InventoryFile/InventoryFile';
import { PlayerSimulation3D } from '../../scene/PlayerSimulation3D';
import next from 'vhost';

export class BasePlayerFileDragOperation extends BaseFileDragOperation {
    // This overrides the base class BaseInteractionManager
    protected _interaction: PlayerInteractionManager;
    // This overrides the base class IGameView
    protected _simulation3D: PlayerSimulation3D;

    // Determines if the file is in the inventory currently
    protected _inInventory: boolean;

    // Determines if the file was in the inventory at the beginning of the drag operation
    protected _originallyInInventory: boolean;

    protected _originalContext: string;

    /**
     * Create a new drag rules.
     */
    constructor(
        simulation: PlayerSimulation3D,
        interaction: PlayerInteractionManager,
        files: File[],
        context: string
    ) {
        super(simulation, interaction, files, context);
        this._originalContext = context;
        this._originallyInInventory = this._inInventory =
            context &&
            this.simulation.helper.userFile.tags[
                'aux._userInventoryContext'
            ] === context;
    }

    protected _onDrag(calc: FileCalculationContext): void {
        const targetData = this.gameView.getInput().getTargetData();
        const vueElement = Input.getVueParent(targetData.inputOver);

        const mode = getFileDragMode(calc, this._files[0]);

        let nextContext = this._simulation3D.context;
        if (vueElement && vueElement instanceof InventoryFile) {
            nextContext = this._simulation3D.inventoryContext.context;
        }

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
                nextContext === this._simulation3D.inventoryContext.context;
        }

        if (nextContext === this._simulation3D.inventoryContext.context) {
            const x = (<InventoryFile>vueElement).slotIndex;
            const y = 0;

            this._updateFilesPositions(this._files, new Vector2(x, y), 0);
        } else {
            const mouseDir = Physics.screenPosToRay(
                this.gameView.getInput().getMouseScreenPos(),
                this.gameView.getMainCamera()
            );
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
