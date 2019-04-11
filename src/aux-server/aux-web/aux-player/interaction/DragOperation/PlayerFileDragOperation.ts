import { BaseFileDragOperation } from "../../../shared/interaction/DragOperation/BaseFileDragOperation";
import { File, FileCalculationContext } from "@yeti-cgi/aux-common";
import { PlayerInteractionManager } from "../PlayerInteractionManager";
import GameView from "../../GameView/GameView";
import { Intersection, Vector2 } from "three";
import { Physics } from "../../../shared/scene/Physics";
import { Input } from "../../../shared/scene/Input";
import InventoryFile from "../../InventoryFile/InventoryFile";

export class PlayerFileDragOperation extends BaseFileDragOperation {

    // This overrides the base class BaseInteractionManager
    protected _interaction: PlayerInteractionManager;
    // This overrides the base class IGameView
    protected _gameView: GameView;


    /**
     * Create a new drag rules.
     */
    constructor(gameView: GameView, interaction: PlayerInteractionManager, files: File[], context: string) {
        super(gameView, interaction, files, context);
    }

    protected _onDrag(calc: FileCalculationContext): void {
        const targetData = this._gameView.getInput().getTargetData();
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

                const mouseDir = Physics.screenPosToRay(this._gameView.getInput().getMouseScreenPos(), this._gameView.getMainCamera());
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
    
    protected _onDragReleased(): void {
    }
}