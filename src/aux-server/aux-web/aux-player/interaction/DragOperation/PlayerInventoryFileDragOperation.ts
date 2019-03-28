import { Physics } from '../../../shared/scene/Physics';
import { File, PartialFile, fileAdded, FileEvent } from '@yeti-cgi/aux-common/Files';
import { createFile, FileCalculationContext } from '@yeti-cgi/aux-common/Files/FileCalculations';
import { appManager } from '../../../shared/AppManager';
import { merge } from '@yeti-cgi/aux-common/utils';
import { AuxFile3D } from '../../../shared/scene/AuxFile3D';
import GameView from '../../GameView/GameView';
import { BaseFileDragOperation } from '../../../shared/interaction/DragOperation/BaseFileDragOperation';
import { PlayerInteractionManager } from '../PlayerInteractionManager';
import { Input } from '../../../shared/scene/Input';
import InventoryFile from '../../InventoryFile/InventoryFile';
import { Vector2 } from 'three';

/**
 * Inventory File Drag Operation handles dragging of files from the inventory.
 */
export class PlayerInventoryFileDragOperation extends BaseFileDragOperation {

    // This overrides the base class BaseInteractionManager
    protected _interaction: PlayerInteractionManager;
    // This overrides the base class IGameView
    protected _gameView: GameView;

    /**
     * Create a new drag rules.
     */
    constructor(gameView: GameView, interaction: PlayerInteractionManager, file: File, context: string) {
        super(gameView, interaction, [file], context);
    }

    protected _onDrag(calc: FileCalculationContext): void {
        const targetData = this._gameView.input.getTargetData();
        const vueElement = Input.getVueParent(targetData.inputOver);

        if (vueElement) {
            if (vueElement instanceof InventoryFile) {
                if (!vueElement.file) {
                    // Over empty slot, update the files context and context position to match the slot's index.
                    if (this._context !== vueElement.context) {
                        this._previousContext = this._context;
                        this._context = vueElement.context;
                    }

                    const x = vueElement.slotIndex;
                    const y = 0;

                    this._updateFilesPositions(this._files, new Vector2(x, y), 0);
                }
            } else {
                if (this._context !== this._gameView.context) {
                    this._previousContext = this._context;
                    this._context = this._gameView.context;
                }

                const mouseDir = Physics.screenPosToRay(this._gameView.input.getMouseScreenPos(), this._gameView.mainCamera);
                const { good, gridTile } = this._interaction.pointOnGrid(calc, mouseDir);
                
                if (good) {
                    const result = this._calculateFileDragStackPosition(calc, this._context, gridTile.tileCoordinate, ...this._files);

                    this._combine = result.combine;
                    this._other = result.other;
    
                    if (result.stackable || result.index === 0) {
                        this._updateFilesPositions(this._files, gridTile.tileCoordinate, result.index);
                    }
                }


            }
        }
    }

    protected _updateFile(file: File, data: PartialFile): FileEvent {
        return super._updateFile(this._file, data);
    }

    protected _onDragReleased(): void {
        // Do nothing.
    }
}