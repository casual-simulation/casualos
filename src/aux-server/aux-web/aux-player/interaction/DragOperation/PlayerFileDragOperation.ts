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
} from '@casual-simulation/aux-common';
import { PlayerInteractionManager } from '../PlayerInteractionManager';
import GameView from '../../GameView/GameView';
import { Intersection, Vector2 } from 'three';
import { Physics } from '../../../shared/scene/Physics';
import { Input } from '../../../shared/scene/Input';
import InventoryFile from '../../InventoryFile/InventoryFile';
import { appManager } from '../../../shared/AppManager';

export class PlayerFileDragOperation extends BaseFileDragOperation {
    // This overrides the base class BaseInteractionManager
    protected _interaction: PlayerInteractionManager;
    // This overrides the base class IGameView
    protected _gameView: GameView;

    private _inInventory: boolean;
    private _originallyInInventory: boolean;

    /**
     * Create a new drag rules.
     */
    constructor(
        gameView: GameView,
        interaction: PlayerInteractionManager,
        files: File[],
        context: string
    ) {
        super(gameView, interaction, files, context);
        this._originallyInInventory = this._inInventory =
            context &&
            appManager.simulationManager.primary.helper.userFile.tags[
                'aux._userInventoryContext'
            ] === context;
    }

    protected _onDrag(calc: FileCalculationContext): void {
        const targetData = this._gameView.getInput().getTargetData();
        const vueElement = Input.getVueParent(targetData.inputOver);

        if (vueElement) {
            if (
                vueElement instanceof InventoryFile &&
                isPickupable(calc, this._file)
            ) {
                if (!vueElement.item) {
                    // Over empty slot, update the files context and context position to match the slot's index.
                    // TODO: Fix
                    // if (this._context !== vueElement.item.context) {
                    //     this._previousContext = this._context;
                    //     this._context = vueElement.item.context;
                    //     this._inInventory = true;
                    // }

                    const x = vueElement.slotIndex;
                    const y = 0;

                    this._updateFilesPositions(
                        this._files,
                        new Vector2(x, y),
                        0
                    );
                }
            } else {
                if (this._context !== this._gameView.context) {
                    this._previousContext = this._context;
                    this._context = this._gameView.context;
                    this._inInventory = false;
                }

                const mouseDir = Physics.screenPosToRay(
                    this._gameView.getInput().getMouseScreenPos(),
                    this._gameView.getMainCamera()
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
            let result = appManager.simulationManager.primary.helper.actionEvents(
                DRAG_OUT_OF_INVENTORY_ACTION_NAME,
                this._files
            );
            events.push(...result.events);
            result = appManager.simulationManager.primary.helper.actionEvents(
                DRAG_ANY_OUT_OF_INVENTORY_ACTION_NAME,
                null,
                this._files
            );
            events.push(...result.events);

            appManager.simulationManager.primary.helper.transaction(...events);
        } else if (!this._originallyInInventory && this._inInventory) {
            let events: FileEvent[] = [];
            let result = appManager.simulationManager.primary.helper.actionEvents(
                DROP_IN_INVENTORY_ACTION_NAME,
                this._files
            );
            events.push(...result.events);
            result = appManager.simulationManager.primary.helper.actionEvents(
                DROP_ANY_IN_INVENTORY_ACTION_NAME,
                null,
                this._files
            );
            events.push(...result.events);

            appManager.simulationManager.primary.helper.transaction(...events);
        }
    }
}
