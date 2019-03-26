import { BaseFileClickOperation } from "../../../shared/interaction/ClickOperation/BaseFileClickOperation";
import GameView from "../../GameView/GameView";
import { AuxFile3D } from "../../../shared/scene/AuxFile3D";
import { Intersection } from "three";
import { PlayerInteractionManager } from "../PlayerInteractionManager";
import { FileCalculationContext } from "@yeti-cgi/aux-common";
import { appManager } from "../../../shared/AppManager";
import { BaseFileDragOperation } from "../../../shared/interaction/DragOperation/BaseFileDragOperation";

export class PlayerFileClickOperation extends BaseFileClickOperation {

    // This overrides the base class BaseInteractionManager
    protected _interaction: PlayerInteractionManager;
    // This overrides the base class IGameView
    protected _gameView: GameView;

    private _hit: Intersection;

    constructor(gameView: GameView, interaction: PlayerInteractionManager, file: AuxFile3D, hit: Intersection) {
        super(gameView, interaction, file.file, file);
        this._hit = hit;
    }

    protected _performClick(calc: FileCalculationContext): void {
        appManager.fileManager.action('onClick', [this._file]);
    }
    
    protected _createDragOperation(calc: FileCalculationContext): BaseFileDragOperation {
        return null;
    }
}