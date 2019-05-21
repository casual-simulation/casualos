import {
    Vector2,
    Vector3,
    Intersection,
    Ray,
    Raycaster,
    Object3D,
} from 'three';
import { ContextMenuAction } from '../../shared/interaction/ContextMenuEvent';
import {
    File,
    FileCalculationContext,
    calculateGridScale,
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
import { appManager } from '../../shared/AppManager';
import { PlayerSimulation3D } from '../scene/PlayerSimulation3D';
import { Simulation } from '../../shared/Simulation';
import { DraggableGroup } from '../../shared/interaction/DraggableGroup';
import { flatMap } from 'lodash';
import { InventoryContextGroup3D } from '../scene/InventoryContextGroup3D';
import { isObjectVisible } from '../../shared/scene/SceneUtils';

export class PlayerInteractionManager extends BaseInteractionManager {
    // This overrides the base class IGameView
    protected _gameView: GameView;

    private _grid: PlayerGrid;

    constructor(gameView: GameView) {
        super(gameView);
        let calc = appManager.simulationManager.primary.helper.createContext();
        let gridScale = calculateGridScale(calc, null);
        this._grid = new PlayerGrid(gridScale);
    }

    createGameObjectClickOperation(
        gameObject: GameObject,
        hit: Intersection
    ): IOperation {
        if (gameObject instanceof AuxFile3D) {
            let faceValue: string = 'Unknown Face';

            // Based on the normals of the file the raycast hit, determine side of the cube
            if (hit.face.normal.x != 0) {
                if (hit.face.normal.x > 0) {
                    faceValue = 'left';
                } else {
                    faceValue = 'right';
                }
            } else if (hit.face.normal.y != 0) {
                if (hit.face.normal.y > 0) {
                    faceValue = 'top';
                } else {
                    faceValue = 'bottom';
                }
            } else if (hit.face.normal.z != 0) {
                if (hit.face.normal.z > 0) {
                    faceValue = 'front';
                } else {
                    faceValue = 'back';
                }
            }

            let fileClickOp = new PlayerFileClickOperation(
                gameObject.contextGroup.simulation3D,
                this,
                gameObject,
                faceValue
            );
            return fileClickOp;
        } else {
            return null;
        }
    }

    getDraggableGroups(): DraggableGroup[] {
        if (this._draggableGroupsDirty) {
            const contexts = flatMap(
                this._gameView.getSimulations(),
                s => s.contexts
            );
            if (contexts && contexts.length > 0) {
                // Sort between inventory colliders and other colliders.
                let inventoryColliders: Object3D[] = [];
                let otherColliders: Object3D[] = [];

                for (let i = 0; i < contexts.length; i++) {
                    const context = contexts[i];
                    const colliders = context.colliders.filter(c =>
                        isObjectVisible(c)
                    );

                    if (context instanceof InventoryContextGroup3D) {
                        inventoryColliders.push(...colliders);
                    } else {
                        otherColliders.push(...colliders);
                    }

                    // Put inventory colliders in front of other colliders so that they take priority in input testing.
                    this._draggableGroups = [
                        {
                            objects: inventoryColliders,
                            camera: this._gameView.getInventoryCamera(),
                            viewport: this._gameView.getInventoryViewport(),
                        },
                        {
                            objects: otherColliders,
                            camera: this._gameView.getMainCamera(),
                        },
                    ];
                }
            }

            this._draggableGroupsDirty = false;
        }

        return this._draggableGroups;
    }

    handlePointerEnter(file: File, simulation: Simulation): IOperation {
        simulation.helper.action('onPointerEnter', [file]);
        return null;
    }

    handlePointerExit(file: File, simulation: Simulation): IOperation {
        simulation.helper.action('onPointerExit', [file]);
        return null;
    }

    handlePointerDown(file: File, simulation: Simulation): IOperation {
        simulation.helper.action('onPointerDown', [file]);
        return null;
    }

    createEmptyClickOperation(): IOperation {
        return null;
    }

    createHtmlElementClickOperation(element: HTMLElement): IOperation {
        return null;
    }

    /**
     * Calculates the grid location that the given ray intersects with.
     * @param ray The ray to test.
     */
    pointOnGrid(calc: FileCalculationContext, ray: Ray) {
        let planeHit = Physics.pointOnPlane(ray, Physics.GroundPlane);
        // We need to flip the sign of the z coordinate here.
        planeHit.z = -planeHit.z;

        if (planeHit) {
            let gridTile = this._grid.getTileFromPosition(planeHit);
            if (gridTile) {
                return {
                    good: true,
                    gridTile: gridTile,
                };
            }
        }

        return {
            good: false,
        };
    }

    protected _contextMenuActions(
        calc: FileCalculationContext,
        gameObject: GameObject,
        point: Vector3,
        pagePos: Vector2
    ): ContextMenuAction[] {
        return null;
    }
}
