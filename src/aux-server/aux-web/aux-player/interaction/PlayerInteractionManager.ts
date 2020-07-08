import {
    Vector3,
    Intersection,
    Object3D,
    OrthographicCamera,
    Quaternion,
    Euler,
    Matrix4,
} from 'three';
import { ContextMenuAction } from '../../shared/interaction/ContextMenuEvent';
import {
    Bot,
    BotCalculationContext,
    ON_FOCUS_EXIT_ACTION_NAME,
    ON_FOCUS_ENTER_ACTION_NAME,
    ON_ANY_FOCUS_ENTER_ACTION_NAME,
    ON_ANY_FOCUS_EXIT_ACTION_NAME,
    PortalType,
    calculateGridScale,
    BotTags,
} from '@casual-simulation/aux-common';
import { IOperation } from '../../shared/interaction/IOperation';
import { BaseInteractionManager } from '../../shared/interaction/BaseInteractionManager';
import { GameObject } from '../../shared/scene/GameObject';
import { AuxBot3D } from '../../shared/scene/AuxBot3D';
import { PlayerBotClickOperation } from './ClickOperation/PlayerBotClickOperation';
import {
    Input,
    ControllerData,
    InputMethod,
    InputState,
    MouseButtonId,
} from '../../shared/scene/Input';
import { appManager } from '../../shared/AppManager';
import { Simulation } from '@casual-simulation/aux-vm';
import { DraggableGroup } from '../../shared/interaction/DraggableGroup';
import flatMap from 'lodash/flatMap';
import { InventoryContextGroup3D } from '../scene/InventoryContextGroup3D';
import {
    isObjectVisible,
    objectForwardRay,
} from '../../shared/scene/SceneUtils';
import { CameraRigControls } from '../../shared/interaction/CameraRigControls';
import { CameraControls } from '../../shared/interaction/CameraControls';
import {
    Orthographic_MinZoom,
    Orthographic_MaxZoom,
} from '../../shared/scene/CameraRigFactory';
import { PlayerEmptyClickOperation } from './ClickOperation/PlayerEmptyClickOperation';
import { PlayerGame } from '../scene/PlayerGame';
import { DimensionGroup3D } from '../../shared/scene/DimensionGroup3D';
import { Grid3D } from '../Grid3D';
import { PlayerPageSimulation3D } from '../scene/PlayerPageSimulation3D';
import { PlayerSimulation3D } from '../scene/PlayerSimulation3D';
import { InventorySimulation3D } from '../scene/InventorySimulation3D';
import { Physics } from '../../shared/scene/Physics';
import { Simulation3D } from '../../shared/scene/Simulation3D';

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
                method,
                hit
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
            // Sort between inventory colliders and other colliders.
            let inventoryColliders: Object3D[] = [];
            let otherColliders: Object3D[] = [];
            if (contexts && contexts.length > 0) {
                for (let i = 0; i < contexts.length; i++) {
                    const dimension = contexts[i];
                    const colliders = (dimension instanceof DimensionGroup3D
                        ? dimension.colliders
                        : []
                    ).filter(c => !!c);

                    if (dimension instanceof InventoryContextGroup3D) {
                        inventoryColliders.push(...colliders);
                    } else {
                        otherColliders.push(...colliders);
                    }
                }
            }

            // Put inventory colliders in front of other colliders so that they take priority in input testing.
            this._draggableGroups = [
                {
                    objects: inventoryColliders,
                    camera: this._game.getInventoryCameraRig().mainCamera,
                    viewport: this._game.getInventoryCameraRig().viewport,
                },
                {
                    objects: otherColliders,
                    camera: this._game.getMainCameraRig().mainCamera,
                    viewport: this._game.getMainCameraRig().viewport,
                },
            ];

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

    handleFocusEnter(bot3D: AuxBot3D, bot: Bot, simulation: Simulation): void {
        const arg = {
            dimension: [...bot3D.dimensionGroup.dimensions.values()][0],
            bot: bot,
        };
        const actions = simulation.helper.actions([
            { eventName: ON_FOCUS_ENTER_ACTION_NAME, bots: [bot], arg },
            { eventName: ON_ANY_FOCUS_ENTER_ACTION_NAME, bots: null, arg },
        ]);
        simulation.helper.transaction(...actions);
    }

    handleFocusExit(bot3D: AuxBot3D, bot: Bot, simulation: Simulation): void {
        const arg = {
            dimension: [...bot3D.dimensionGroup.dimensions.values()][0],
            bot: bot,
        };
        const actions = simulation.helper.actions([
            { eventName: ON_FOCUS_EXIT_ACTION_NAME, bots: [bot], arg },
            { eventName: ON_ANY_FOCUS_EXIT_ACTION_NAME, bots: null, arg },
        ]);
        simulation.helper.transaction(...actions);
    }

    createEmptyClickOperation(inputMethod: InputMethod): IOperation {
        return new PlayerEmptyClickOperation(this._game, this, inputMethod);
    }

    createHtmlElementClickOperation(element: HTMLElement): IOperation {
        return null;
    }

    getDefaultGrid3D(): Grid3D {
        const sim = <PlayerPageSimulation3D>(
            this._game
                .getSimulations()
                .find(sim3D => sim3D instanceof PlayerPageSimulation3D)
        );
        if (sim) {
            return sim.grid3D;
        }
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

    // This function is kinda the worst but should be fine
    // as long as performance doesn't become an issue.
    protected _updatePlayerBotTags() {
        for (let sim of this._game.getSimulations()) {
            const rig = sim.getMainCameraRig();
            const cameraWorld = new Vector3();
            cameraWorld.setFromMatrixPosition(rig.mainCamera.matrixWorld);
            const cameraRotation = new Euler();
            cameraRotation.setFromRotationMatrix(rig.mainCamera.matrixWorld);
            const [portal, gridScale, inverseScale] = portalInfoForSim(sim);

            if (portal) {
                sim.simulation.helper.updateBot(sim.simulation.helper.userBot, {
                    tags: {
                        [`${portal}CameraPositionX`]:
                            cameraWorld.x * inverseScale,
                        [`${portal}CameraPositionY`]:
                            -cameraWorld.z * inverseScale,
                        [`${portal}CameraPositionZ`]:
                            cameraWorld.y * inverseScale,
                        [`${portal}CameraRotationX`]: cameraRotation.x,
                        [`${portal}CameraRotationY`]: cameraRotation.z,
                        [`${portal}CameraRotationZ`]: cameraRotation.y,
                    },
                });
            }
        }

        const input = this._game.getInput();
        const pagePos = this._game.getInput().getMousePagePos();
        const draggableGroups = this.getDraggableGroups();
        const viewports = this._game.getViewports();

        for (let i = 0; i < draggableGroups.length; i++) {
            const group = draggableGroups[i];
            const objects = group.objects;
            const camera = group.camera;
            const viewport = group.viewport;

            if (!Input.pagePositionOnViewport(pagePos, viewport, viewports)) {
                // Page position is not on or is being obstructed by other viewports.
                // Ignore this draggable group.
                continue;
            }

            const screenPos = Input.screenPositionForViewport(
                pagePos,
                viewport
            );
            const ray = Physics.rayAtScreenPos(screenPos, camera);
            const mat = new Matrix4();
            mat.lookAt(
                ray.origin,
                ray.direction.add(ray.origin),
                new Vector3(0, 1, 0)
            );
            const worldRotation = new Euler();
            worldRotation.setFromRotationMatrix(mat);

            for (let sim of this._game.getSimulations()) {
                if (sim.getMainCameraRig().viewport !== group.viewport) {
                    continue;
                }
                const [portal, gridScale, inverseScale] = portalInfoForSim(sim);

                if (portal) {
                    sim.simulation.helper.updateBot(
                        sim.simulation.helper.userBot,
                        {
                            tags: {
                                [`mousePointerPositionX`]:
                                    ray.origin.x * inverseScale,
                                [`mousePointerPositionY`]:
                                    -ray.origin.z * inverseScale,
                                [`mousePointerPositionZ`]:
                                    ray.origin.y * inverseScale,
                                [`mousePointerRotationX`]: worldRotation.x,
                                [`mousePointerRotationY`]: worldRotation.z,
                                [`mousePointerRotationZ`]: worldRotation.y,
                                [`mousePointerPortal`]: portal,
                            },
                        }
                    );
                }
            }
        }

        for (let controller of input.controllers) {
            const ray = objectForwardRay(controller.ray);
            const mat = new Matrix4();
            mat.lookAt(
                ray.origin,
                ray.direction.add(ray.origin),
                new Vector3(0, 1, 0)
            );
            const worldRotation = new Euler();
            worldRotation.setFromRotationMatrix(mat);
            const hand = controller.inputSource.handedness;

            let inputStates = {};
            checkInput(
                controller.primaryInputState,
                `${hand}Pointer_primary`,
                inputStates
            );
            checkInput(
                controller.squeezeInputState,
                `${hand}Pointer_squeeze`,
                inputStates
            );

            for (let sim of this._game.getSimulations()) {
                if (!(sim instanceof PlayerPageSimulation3D)) {
                    continue;
                }
                const [portal, gridScale, inverseScale] = portalInfoForSim(sim);

                if (portal) {
                    sim.simulation.helper.updateBot(
                        sim.simulation.helper.userBot,
                        {
                            tags: {
                                ...inputStates,
                                [`${hand}PointerPositionX`]:
                                    ray.origin.x * inverseScale,
                                [`${hand}PointerPositionY`]:
                                    -ray.origin.z * inverseScale,
                                [`${hand}PointerPositionZ`]:
                                    ray.origin.y * inverseScale,
                                [`${hand}PointerRotationX`]: worldRotation.x,
                                [`${hand}PointerRotationY`]: worldRotation.z,
                                [`${hand}PointerRotationZ`]: worldRotation.y,
                                [`${hand}PointerPortal`]: portal,
                            },
                        }
                    );
                }
            }
        }

        let inputUpdate = {} as BotTags;
        let hasInputUpdate = false;
        for (let key of input.getKeys()) {
            if (checkInput(key.state, `keyboard_${key.key}`, inputUpdate)) {
                hasInputUpdate = true;
            }
        }

        const leftState = input.getButtonInputState(MouseButtonId.Left);
        const rightState = input.getButtonInputState(MouseButtonId.Right);
        const middleState = input.getButtonInputState(MouseButtonId.Middle);
        if (checkInput(leftState, 'mousePointer_left', inputUpdate)) {
            hasInputUpdate = true;
        }
        if (checkInput(rightState, 'mousePointer_right', inputUpdate)) {
            hasInputUpdate = true;
        }
        if (checkInput(middleState, 'mousePointer_middle', inputUpdate)) {
            hasInputUpdate = true;
        }

        let inputList = [
            'keyboard',
            'mousePointer',
            'touch',
            ...input.controllers.map(c => `${c.inputSource.handedness}Pointer`),
        ];

        for (let i = 0; i < 5; i++) {
            const touch = input.getTouchData(i);
            if (touch) {
                if (checkInput(touch.state, `touch_${i}`, inputUpdate)) {
                    hasInputUpdate = true;
                }
            } else {
                inputUpdate[`touch_${i}`] = null;
            }
        }

        if (hasInputUpdate) {
            inputUpdate['inputList'] = inputList;
            for (let sim of appManager.simulationManager.simulations.values()) {
                sim.helper.updateBot(sim.helper.userBot, {
                    tags: inputUpdate,
                });
            }
        }

        function portalInfoForSim(sim: Simulation3D) {
            let portal: PortalType;
            let gridScale: number;
            if (sim instanceof PlayerPageSimulation3D) {
                portal = 'page';
                gridScale = sim.pageConfig.gridScale;
            } else if (sim instanceof InventorySimulation3D) {
                portal = 'inventory';
                gridScale = sim.inventoryConfig.gridScale;
            }
            let inverseScale = 1 / gridScale;

            return [portal, gridScale, inverseScale] as const;
        }

        function checkInput(state: InputState, name: string, update: any) {
            if (state.isDownOnFrame(input.time.frameCount)) {
                inputUpdate[name] = 'down';
                return true;
            } else if (state.isHeldOnFrame(input.time.frameCount)) {
                inputUpdate[name] = 'held';
                return true;
            } else if (state.isUpOnFrame(input.time.frameCount)) {
                inputUpdate[name] = null;
                return true;
            }
            return false;
        }
    }

    protected _contextMenuActions(
        calc: BotCalculationContext,
        gameObject: GameObject,
        point: Vector3
    ): ContextMenuAction[] {
        return null;
    }
}
