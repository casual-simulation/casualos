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
} from '@casual-simulation/aux-common';
import { PlayerInteractionManager } from '../PlayerInteractionManager';
import GameView from '../../GameView/GameView';
import { Intersection, Vector2 } from 'three';
import { Physics } from '../../../shared/scene/Physics';
import { Input } from '../../../shared/scene/Input';
import InventoryFile from '../../InventoryFile/InventoryFile';
import { PlayerSimulation3D } from '../../scene/PlayerSimulation3D';

export class BasePlayerFileDragOperation extends BaseFileDragOperation {
    // This overrides the base class BaseInteractionManager
    protected _interaction: PlayerInteractionManager;
    // This overrides the base class IGameView
    protected _simulation3D: PlayerSimulation3D;

    // Determines if the file is in the inventory currently
    protected _inInventory: boolean;

    // Determines if the file was in the inventory at the beginning of the drag operation
    protected _originallyInInventory: boolean;

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
        this._originallyInInventory = this._inInventory =
            context &&
            this.simulation.helper.userFile.tags[
                'aux._userInventoryContext'
            ] === context;
    }

    protected _onDrag(calc: FileCalculationContext): void {
        const targetData = this.gameView.getInput().getTargetData();
        const vueElement = Input.getVueParent(targetData.inputOver);

        if (vueElement) {
            if (
                vueElement instanceof InventoryFile &&
                isPickupable(calc, this._files[0])
            ) {
                if (!vueElement.item) {
                    // Over empty slot, update the files context and context position to match the slot's index.
                    if (
                        this._context !==
                        this._simulation3D.inventoryContext.context
                    ) {
                        this._previousContext = this._context;
                        this._context = this._simulation3D.inventoryContext.context;
                        this._inInventory = true;
                    }

                    const x = vueElement.slotIndex;
                    const y = 0;

                    this._updateFilesPositions(
                        this._files,
                        new Vector2(x, y),
                        0
                    );
                }
            } else if (
                isFileMovable(calc, this._files[0]) ||
                this._originallyInInventory
            ) {
                if (this._context !== this._simulation3D.context) {
                    this._previousContext = this._context;
                    this._context = this._simulation3D.context;
                    this._inInventory = false;
                }

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
