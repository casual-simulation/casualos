import { Vector2, Vector3, Intersection } from 'three';
import { ContextMenuAction } from '../../shared/interaction/ContextMenuEvent';
import {
    FileCalculationContext,
} from '@yeti-cgi/aux-common';
import { IOperation } from '../../shared/interaction/IOperation';
import { BaseInteractionManager } from '../../shared/interaction/BaseInteractionManager';
import GameView from '../GameView/GameView';
import { GameObject } from '../../shared/scene/GameObject';
import { AuxFile3D } from '../../shared/scene/AuxFile3D';
import { appManager } from '../../shared/AppManager';

export class PlayerInteractionManager extends BaseInteractionManager {

    // This overrides the base class IGameView
    protected _gameView: GameView;

    constructor(gameView: GameView) {
        super(gameView)
    }

    createGameObjectClickOperation(gameObject: GameObject, hit: Intersection): IOperation {

        if (gameObject instanceof AuxFile3D) {
            appManager.fileManager.action('onClick', [gameObject.file]);
        }

        return null;
    }

    createEmptyClickOperation(): IOperation {
        return null;
    }

    createHtmlElementClickOperation(element: HTMLElement): IOperation {
        return null;
    }

    protected _contextMenuActions(calc: FileCalculationContext, gameObject: GameObject, point: Vector3, pagePos: Vector2): ContextMenuAction[] {
        return null;
    }
}