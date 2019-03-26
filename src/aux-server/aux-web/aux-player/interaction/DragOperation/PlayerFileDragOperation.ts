import { BaseFileDragOperation } from "../../../shared/interaction/DragOperation/BaseFileDragOperation";
import { File, FileCalculationContext } from "@yeti-cgi/aux-common";
import { PlayerInteractionManager } from "../PlayerInteractionManager";
import GameView from "../../GameView/GameView";
import { Intersection } from "three";
import { Physics } from "../../../shared/scene/Physics";

export class PlayerFileDragOperation extends BaseFileDragOperation {

    // This overrides the base class BaseInteractionManager
    protected _interaction: PlayerInteractionManager;
    // This overrides the base class IGameView
    protected _gameView: GameView;


    /**
     * Create a new drag rules.
     */
    constructor(gameView: GameView, interaction: PlayerInteractionManager, hit: Intersection, files: File[], context: string) {
        super(gameView, interaction, files, context);
    }

    protected _onDrag(calc: FileCalculationContext): void {
        const mouseDir = Physics.screenPosToRay(this._gameView.input.getMouseScreenPos(), this._gameView.mainCamera);
        const { good, gridTile } = this._interaction.pointOnGrid(calc, mouseDir);

        if (this._files.length > 0 && good) {
            const result = this._calculateFileDragPosition(calc, this._context, gridTile.tileCoordinate, ...this._files);

            this._combine = result.combine;
            this._other = result.other;

            if (result.stackable || result.index === 0) {
                this._updateFilesPositions(this._files, gridTile.tileCoordinate, 0, result.index);
            }
        }
    }    
    
    protected _onDragReleased(): void {
    }
}