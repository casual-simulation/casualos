import { Vector3, Intersection, Object3D, OrthographicCamera } from 'three';
import { ContextMenuAction } from '../../shared/interaction/ContextMenuEvent';
import { Bot, BotCalculationContext } from '@casual-simulation/aux-common';
import { IOperation } from '../../shared/interaction/IOperation';
import { BaseInteractionManager } from '../../shared/interaction/BaseInteractionManager';
import { GameObject } from '../../shared/scene/GameObject';
import { AuxBot3D } from '../../shared/scene/AuxBot3D';
import { PlayerBotClickOperation } from './ClickOperation/PlayerBotClickOperation';
import { Input, ControllerData, InputMethod } from '../../shared/scene/Input';
import { appManager } from '../../shared/AppManager';
import { Simulation } from '@casual-simulation/aux-vm';
import { DraggableGroup } from '../../shared/interaction/DraggableGroup';
import flatMap from 'lodash/flatMap';
import { InventoryContextGroup3D } from '../scene/InventoryContextGroup3D';
import { isObjectVisible } from '../../shared/scene/SceneUtils';
import { CameraRigControls } from '../../shared/interaction/CameraRigControls';
import { CameraControls } from '../../shared/interaction/CameraControls';
import {
    Orthographic_MinZoom,
    Orthographic_MaxZoom,
} from '../../shared/scene/CameraRigFactory';
import { PlayerEmptyClickOperation } from './ClickOperation/PlayerEmptyClickOperation';
import { PlayerGame } from '../scene/PlayerGame';
import { DimensionGroup3D } from '../../shared/scene/DimensionGroup3D';

export class PlayerInteractionManager extends BaseInteractionManager {
    // This overrides the base class Game.
    protected _game: PlayerGame;

    constructor(game: PlayerGame) {
        super(game);
        let calc = appManager.simulationManager.primary.helper.createContext();
    }

    protected _updateAdditionalNormalInputs(input: Input) {
        super._updateAdditionalNormalInputs(input);

        const frame = this._game.getTime().frameCount;
        const simulations = appManager.simulationManager.simulations.values();

        let keysDown: string[] = [];
        let keysUp: string[] = [];
        for (let key of input.getKeys()) {
            if (key.state.isDownOnFrame(frame)) {
                keysDown.push(key.key);
            } else if (key.state.isUpOnFrame(frame)) {
                keysUp.push(key.key);
            }
        }

        for (let sim of simulations) {
            if (keysDown.length > 0) {
                sim.helper.action('onKeyDown', null, {
                    keys: keysDown,
                });
            }
            if (keysUp.length > 0) {
                sim.helper.action('onKeyUp', null, {
                    keys: keysUp,
                });
            }
        }
    }

    createGameObjectClickOperation(
        gameObject: GameObject,
        hit: Intersection,
        method: InputMethod
    ): IOperation {
        if (gameObject instanceof AuxBot3D) {
            let faceValue: string = 'Unknown Face';

            // Based on the normals of the bot the raycast hit, determine side of the cube
            if (hit.face) {
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
            }

            let botClickOp = new PlayerBotClickOperation(
                gameObject.dimensionGroup.simulation3D,
                this,
                gameObject,
                faceValue,
                method
            );
            return botClickOp;
        } else {
            return null;
        }
    }

    getDraggableGroups(): DraggableGroup[] {
        if (this._draggableGroupsDirty) {
            const contexts = flatMap(
                this._game.getSimulations(),
                s => s.dimensions
            );
            if (contexts && contexts.length > 0) {
                // Sort between inventory colliders and other colliders.
                let inventoryColliders: Object3D[] = [];
                let otherColliders: Object3D[] = [];

                for (let i = 0; i < contexts.length; i++) {
                    const dimension = contexts[i];
                    const colliders =
                        dimension instanceof DimensionGroup3D
                            ? dimension.colliders.filter(c =>
                                  isObjectVisible(c)
                              )
                            : [];

                    if (dimension instanceof InventoryContextGroup3D) {
                        inventoryColliders.push(...colliders);
                    } else {
                        otherColliders.push(...colliders);
                    }

                    // Put inventory colliders in front of other colliders so that they take priority in input testing.
                    this._draggableGroups = [
                        {
                            objects: inventoryColliders,
                            camera: this._game.getInventoryCameraRig()
                                .mainCamera,
                            viewport: this._game.getInventoryCameraRig()
                                .viewport,
                        },
                        {
                            objects: otherColliders,
                            camera: this._game.getMainCameraRig().mainCamera,
                            viewport: this._game.getMainCameraRig().viewport,
                        },
                    ];
                }
            }

            this._draggableGroupsDirty = false;
        }

        return this._draggableGroups || [];
    }

    handlePointerEnter(
        bot3D: AuxBot3D,
        bot: Bot,
        simulation: Simulation
    ): void {
        simulation.helper.action('onPointerEnter', [bot], {
            dimension: [...bot3D.dimensionGroup.dimensions.values()][0],
            bot: bot,
        });
    }

    handlePointerExit(bot3D: AuxBot3D, bot: Bot, simulation: Simulation): void {
        simulation.helper.action('onPointerExit', [bot], {
            dimension: [...bot3D.dimensionGroup.dimensions.values()][0],
            bot: bot,
        });
    }

    handlePointerDown(bot3D: AuxBot3D, bot: Bot, simulation: Simulation): void {
        simulation.helper.action('onPointerDown', [bot], {
            dimension: [...bot3D.dimensionGroup.dimensions.values()][0],
            bot: bot,
        });
    }

    handlePointerUp(bot3D: AuxBot3D, bot: Bot, simulation: Simulation): void {
        simulation.helper.action('onPointerUp', [bot], {
            dimension: [...bot3D.dimensionGroup.dimensions.values()][0],
            bot: bot,
        });
    }

    createEmptyClickOperation(inputMethod: InputMethod): IOperation {
        return new PlayerEmptyClickOperation(this._game, this, inputMethod);
    }

    createHtmlElementClickOperation(element: HTMLElement): IOperation {
        return null;
    }

    protected _createControlsForCameraRigs(): CameraRigControls[] {
        // Main camera
        let mainCameraRigControls: CameraRigControls = {
            rig: this._game.getMainCameraRig(),
            controls: new CameraControls(
                this._game.getMainCameraRig().mainCamera,
                this._game,
                this._game.getMainCameraRig().viewport
            ),
        };

        mainCameraRigControls.controls.minZoom = Orthographic_MinZoom;
        mainCameraRigControls.controls.maxZoom = Orthographic_MaxZoom;

        if (
            mainCameraRigControls.rig.mainCamera instanceof OrthographicCamera
        ) {
            mainCameraRigControls.controls.screenSpacePanning = true;
        }

        // Inventory camera
        let invCameraRigControls: CameraRigControls = {
            rig: this._game.getInventoryCameraRig(),
            controls: new CameraControls(
                this._game.getInventoryCameraRig().mainCamera,
                this._game,
                this._game.getInventoryCameraRig().viewport
            ),
        };

        invCameraRigControls.controls.minZoom = Orthographic_MinZoom;
        invCameraRigControls.controls.maxZoom = Orthographic_MaxZoom;

        if (invCameraRigControls.rig.mainCamera instanceof OrthographicCamera) {
            invCameraRigControls.controls.screenSpacePanning = true;
        }

        return [mainCameraRigControls, invCameraRigControls];
    }

    protected _contextMenuActions(
        calc: BotCalculationContext,
        gameObject: GameObject,
        point: Vector3
    ): ContextMenuAction[] {
        return null;
    }
}
