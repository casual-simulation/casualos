import { Vector2, Vector3, Intersection, Ray, Raycaster } from 'three';
import { ContextMenuAction } from '../../shared/interaction/ContextMenuEvent';
import {
    File, FileCalculationContext, calculateGridScale,
} from '@casual-simulation/aux-common';
import { IOperation } from '../../shared/interaction/IOperation';
import { BaseInteractionManager } from '../../shared/interaction/BaseInteractionManager';
import GameView from '../GameView/GameView';
import { GameObject } from '../../shared/scene/GameObject';
import { AuxFile3D } from '../../shared/scene/AuxFile3D';
import { PlayerFileClickOperation } from './ClickOperation/PlayerFileClickOperation';
import { PlayerGrid } from '../PlayerGrid';
import { Physics } from '../../shared/scene/Physics';
import { Input } from '../../shared/scene/Input';
import InventoryFile from '../InventoryFile/InventoryFile';
import { PlayerInventoryFileClickOperation } from './ClickOperation/PlayerInventoryFileClickOperation';
import { appManager } from '../../shared/AppManager';

export class PlayerInteractionManager extends BaseInteractionManager {

    // This overrides the base class IGameView
    protected _gameView: GameView;

    private _grid: PlayerGrid;

    constructor(gameView: GameView) {
        super(gameView);
        let calc = appManager.fileManager.createContext();
        let gridScale = calculateGridScale(calc, null);
        this._grid = new PlayerGrid(gridScale);
    }

    createGameObjectClickOperation(gameObject: GameObject, hit: Intersection): IOperation {
        if (gameObject instanceof AuxFile3D) {
            let fileClickOp = new PlayerFileClickOperation(this._gameView, this, gameObject);
            return fileClickOp;
        } else {
            return null;
        }
    }

    createEmptyClickOperation(): IOperation {
        return null;
    }

    createHtmlElementClickOperation(element: HTMLElement): IOperation {
        const vueElement: any = Input.getVueParent(element);
        if (vueElement instanceof InventoryFile) {
            if (vueElement.file) {
                let inventoryClickOperation = new PlayerInventoryFileClickOperation(this._gameView, this, vueElement.file, vueElement.context);
                return inventoryClickOperation;
                
            }
        }

        return null;
    }

    /**
     * Calculates the grid location that the given ray intersects with.
     * @param ray The ray to test.
     */
    pointOnGrid(calc: FileCalculationContext, ray: Ray) {
        let planeHit = Physics.pointOnPlane(ray, this._gameView.getGroundPlane());
        // We need to flip the sign of the z coordinate here.
        planeHit.z = -planeHit.z;

        if (planeHit) {
            let gridTile = this._grid.getTileFromPosition(planeHit);
            if (gridTile) {
                return {
                    good: true,
                    gridTile: gridTile
                }
            }
        }

        return {
            good: false
        }
    }

    protected _contextMenuActions(calc: FileCalculationContext, gameObject: GameObject, point: Vector3, pagePos: Vector2): ContextMenuAction[] {
        return null;
    }
}