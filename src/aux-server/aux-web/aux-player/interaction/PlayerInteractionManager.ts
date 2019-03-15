import { Vector2, Vector3, Intersection, Raycaster, Object3D, Ray } from 'three';
import { ContextMenuEvent, ContextMenuAction } from '../../shared/interaction/ContextMenuEvent';
import { 
    File, 
    Object, 
    Workspace, 
    DEFAULT_WORKSPACE_HEIGHT_INCREMENT, 
    DEFAULT_WORKSPACE_MIN_HEIGHT, 
    DEFAULT_USER_MODE, 
    UserMode, 
    DEFAULT_WORKSPACE_HEIGHT, 
    objectsAtWorkspace,
    tagsMatchingFilter,
    isMinimized,
    FileCalculationContext,
    getContextMinimized,
    getContextGrid,
    getContextSize,
    getContextScale,
    getContextDefaultHeight,
    getContextColor
} from '@yeti-cgi/aux-common';
import { BuilderFileClickOperation } from '../../aux-projector/interaction/ClickOperation/BuilderFileClickOperation';
import { Physics } from '../../shared/scene/Physics';
import { flatMap, minBy, keys, union } from 'lodash';
import { Axial, realPosToGridPos, gridDistance, keyToPos, posToKey } from '../../shared/scene/hex';
import { Input } from '../../shared/scene/Input';
import { ColorPickerEvent } from '../../aux-projector/interaction/ColorPickerEvent';
import { EventBus } from '../../shared/EventBus';
import { appManager } from '../../shared/AppManager';
import { IOperation } from '../../shared/interaction/IOperation';
import { BuilderEmptyClickOperation } from '../../aux-projector/interaction/ClickOperation/BuilderEmptyClickOperation';
import { BuilderNewFileClickOperation } from '../../aux-projector/interaction/ClickOperation/BuilderNewFileClickOperation';
import { AuxFile3D } from '../../shared/scene/AuxFile3D';
import { ContextGroup3D } from '../../shared/scene/ContextGroup3D';
import { BaseInteractionManager } from '../../shared/interaction/BaseInteractionManager';
import GameView from '../GameView/GameView';

export class PlayerInteractionManager extends BaseInteractionManager {

    // This overrides the base class IGameView
    protected _gameView: GameView;

    constructor(gameView: GameView) {
        super(gameView)
    }

    createFileClickOperation(file: AuxFile3D, hit: Intersection): IOperation {
        return null;
    }

    createEmptyClickOperation(): IOperation {
        return null;
    }

    createHtmlElementClickOperation(element: HTMLElement): IOperation {
        return null;
    }

    protected _contextMenuActions(calc: FileCalculationContext, file: AuxFile3D | ContextGroup3D, point: Vector3, pagePos: Vector2): ContextMenuAction[] {
        return null;
    }
}