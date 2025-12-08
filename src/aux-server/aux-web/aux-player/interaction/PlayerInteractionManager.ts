/* CasualOS is a set of web-based tools designed to facilitate the creation of real-time, multi-user, context-aware interactive experiences.
 *
 * Copyright (c) 2019-2025 Casual Simulation, Inc.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */
import type { Intersection, Object3D, Ray } from '@casual-simulation/three';
import {
    Vector3,
    OrthographicCamera,
    Quaternion,
    Euler,
    Vector2,
} from '@casual-simulation/three';
import type { ContextMenuAction } from '../../shared/interaction/ContextMenuEvent';
import type {
    Bot,
    BotCalculationContext,
    BotTags,
} from '@casual-simulation/aux-common';
import {
    ON_FOCUS_EXIT_ACTION_NAME,
    ON_FOCUS_ENTER_ACTION_NAME,
    ON_ANY_FOCUS_ENTER_ACTION_NAME,
    ON_ANY_FOCUS_EXIT_ACTION_NAME,
    hasValue,
    ON_POINTER_ENTER,
    ON_POINTER_EXIT,
    onPointerEnterExitArg,
    ON_ANY_POINTER_ENTER,
    ON_ANY_POINTER_EXIT,
    calculateNumericalTagValue,
    getBotPosition,
    isBot,
    addDebugApi,
    onPointerUpDownArg,
    getBotTransformer,
    ON_POINTER_DOWN,
    ON_POINTER_UP,
    ON_ANY_POINTER_DOWN,
    ON_ANY_POINTER_UP,
    formatBotVector,
    formatBotRotation,
    getTagPosition,
    getTagRotation,
} from '@casual-simulation/aux-common';
import {
    Rotation,
    Vector3 as CasualVector3,
} from '@casual-simulation/aux-common/math';
import type { IOperation } from '../../shared/interaction/IOperation';
import { BaseInteractionManager } from '../../shared/interaction/BaseInteractionManager';
import type { GameObject } from '../../shared/scene/GameObject';
import { AuxBot3D } from '../../shared/scene/AuxBot3D';
import { PlayerBotClickOperation } from './ClickOperation/PlayerBotClickOperation';
import type {
    InputMethod,
    InputState,
    InputModality,
} from '../../shared/scene/Input';
import {
    Input,
    MouseButtonId,
    getModalityHand,
    getModalityFinger,
    getModalityButtonId,
    getModalityKey,
} from '../../shared/scene/Input';
import { appManager } from '../../shared/AppManager';
import type { Simulation } from '@casual-simulation/aux-vm';
import type { DraggableGroup } from '../../shared/interaction/DraggableGroup';
import { isEqual } from 'es-toolkit/compat';
import { MiniPortalContextGroup3D } from '../scene/MiniPortalContextGroup3D';
import {
    calculateHitFace,
    objectForwardRay,
    cameraUpwardRay,
    safeSetParent,
    objectUpwardRay,
    cameraForwardRay,
} from '../../shared/scene/SceneUtils';
import type { CameraRigControls } from '../../shared/interaction/CameraRigControls';
import { CameraControls } from '../../shared/interaction/CameraControls';
import {
    Orthographic_MinZoom,
    Orthographic_MaxZoom,
} from '../../shared/scene/CameraRigFactory';
import { PlayerEmptyClickOperation } from './ClickOperation/PlayerEmptyClickOperation';
import type { PlayerGame } from '../scene/PlayerGame';
import { DimensionGroup3D } from '../../shared/scene/DimensionGroup3D';
import type { Grid3D } from '../../shared/scene/Grid3D';
import { PlayerPageSimulation3D } from '../scene/PlayerPageSimulation3D';
import { MiniSimulation3D } from '../scene/MiniSimulation3D';
import { Physics } from '../../shared/scene/Physics';
import type { Simulation3D } from '../../shared/scene/Simulation3D';
import { PlayerBotDragOperation } from './DragOperation/PlayerBotDragOperation';
import { PlayerModDragOperation } from './DragOperation/PlayerModDragOperation';
import { getPortalConfigBot } from '@casual-simulation/aux-vm-browser';
import { MapPortalDimensionGroup3D } from '../scene/MapPortalDimensionGroup3D';
import { MiniMapPortalDimensionGroup3D } from '../scene/MiniMapPortalDimensionGroup3D';
import type { Block } from 'three-mesh-ui';
import { MapSimulation3D } from '../scene/MapSimulation3D';
import { MiniMapSimulation3D } from '../scene/MiniMapSimulation3D';

export class PlayerInteractionManager extends BaseInteractionManager {
    // This overrides the base class Game.
    protected _game: PlayerGame;
    private _disablePlayerBotTags: boolean;
    private _lastInputList: string[];

    get disablePlayerBotTags() {
        return this._disablePlayerBotTags;
    }

    constructor(game: PlayerGame) {
        super(game);
        let calc = appManager.simulationManager.primary.helper.createContext();

        addDebugApi('disablePlayerBotTags', (disable: boolean) => {
            if (typeof disable === 'undefined') {
                disable = true;
            }
            this._disablePlayerBotTags = disable;
        });
    }

    protected _updateAdditionalNormalInputs(input: Input) {
        super._updateAdditionalNormalInputs(input);

        const simulations = appManager.simulationManager.simulations.values();

        let keysDown = [] as string[];
        let keysUp = [] as string[];
        let repeatedKeys = [] as string[];

        for (let event of input.getFrameKeyEvents()) {
            if (event.type === 'down') {
                if (event.repeated) {
                    repeatedKeys.push(event.key);
                } else {
                    keysDown.push(event.key);
                }
            } else {
                keysUp.push(event.key);
            }
        }

        for (let sim of simulations) {
            if (keysDown.length > 0) {
                sim.helper.action('onKeyDown', null, {
                    keys: keysDown,
                });
            }
            if (repeatedKeys.length > 0) {
                sim.helper.action('onKeyRepeat', null, {
                    keys: repeatedKeys,
                });
            }
            if (keysUp.length > 0) {
                sim.helper.action('onKeyUp', null, {
                    keys: keysUp,
                });
            }
        }
    }

    createBotDragOperation(
        simulation: Simulation,
        bot: Bot | BotTags,
        dimension: string,
        controller: InputMethod,
        modality: InputModality
    ): IOperation {
        const pageSimulation = this._game.findPlayerSimulation3D(simulation);
        const miniSimulation = this._game.findMiniSimulation3D(simulation);
        const mapSimulation = this._game.findMapSimulation3D(simulation);
        const miniMapSimulation =
            this._game.findMiniMapSimulation3D(simulation);
        if (isBot(bot)) {
            let tempPos = getBotPosition(null, bot, dimension);
            let startBotPos = new Vector2(tempPos.x, tempPos.y);
            let botDragOp = new PlayerBotDragOperation(
                pageSimulation,
                miniSimulation,
                mapSimulation,
                miniMapSimulation,
                this,
                [bot],
                dimension,
                controller,
                modality,
                startBotPos
            );
            return botDragOp;
        } else {
            let modDragOp = new PlayerModDragOperation(
                pageSimulation,
                miniSimulation,
                this,
                bot,
                controller
            );
            return modDragOp;
        }
    }

    createGameObjectClickOperation(
        gameObject: GameObject,
        hit: Intersection,
        method: InputMethod,
        modality: InputModality,
        block: Block | null
    ): IOperation {
        if (gameObject instanceof AuxBot3D) {
            let faceValue: string = calculateHitFace(hit) ?? 'Unknown Face';

            let botClickOp = new PlayerBotClickOperation(
                gameObject.dimensionGroup.simulation3D,
                this,
                gameObject,
                faceValue,
                method,
                modality,
                hit,
                block
            );
            return botClickOp;
        } else {
            return null;
        }
    }

    getDraggableGroups(): DraggableGroup[] {
        if (this._draggableGroupsDirty) {
            const contexts = this._game
                .getSimulations()
                .flatMap((s) => s.dimensions);
            // Sort between miniGridPortal colliders and other colliders.
            let miniPortalColliders: Object3D[] = [];
            let otherColliders: Object3D[] = [];
            let mapPortalColliders: Object3D[] = [];
            let miniMapPortalColliders: Object3D[] = [];
            if (contexts && contexts.length > 0) {
                for (let i = 0; i < contexts.length; i++) {
                    const dimension = contexts[i];
                    const colliders = (
                        dimension instanceof DimensionGroup3D
                            ? dimension.colliders
                            : []
                    ).filter((c) => !!c);

                    if (dimension instanceof MiniPortalContextGroup3D) {
                        miniPortalColliders.push(...colliders);
                    } else if (dimension instanceof MapPortalDimensionGroup3D) {
                        mapPortalColliders.push(...colliders);
                    } else if (
                        dimension instanceof MiniMapPortalDimensionGroup3D
                    ) {
                        miniMapPortalColliders.push(...colliders);
                    } else {
                        otherColliders.push(...colliders);
                    }
                }
            }

            // Put miniGridPortal colliders in front of other colliders so that they take priority in input testing.
            this._draggableGroups = [
                {
                    objects: miniMapPortalColliders,
                    camera: this._game.getMiniMapPortalCameraRig().mainCamera,
                    viewport: this._game.getMiniMapPortalCameraRig().viewport,
                },
                {
                    objects: miniPortalColliders,
                    camera: this._game.getMiniPortalCameraRig().mainCamera,
                    viewport: this._game.getMiniPortalCameraRig().viewport,
                },
                {
                    objects: mapPortalColliders,
                    camera: this._game.getMapPortalCameraRig().mainCamera,
                    viewport: this._game.getMapPortalCameraRig().viewport,
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
        simulation: Simulation,
        modality: InputModality
    ): void {
        const dimension = [...bot3D.dimensionGroup.dimensions.values()][0];
        const arg = onPointerEnterExitArg(
            bot,
            dimension,
            modality.type,
            getModalityHand(modality),
            getModalityFinger(modality),
            getModalityButtonId(modality)
        );
        const actions = simulation.helper.actions([
            {
                eventName: ON_POINTER_ENTER,
                bots: [bot],
                arg,
            },
            {
                eventName: ON_ANY_POINTER_ENTER,
                bots: null,
                arg,
            },
        ]);
        simulation.helper.transaction(...actions);
    }

    handlePointerExit(
        bot3D: AuxBot3D,
        bot: Bot,
        simulation: Simulation,
        modality: InputModality
    ): void {
        const dimension = [...bot3D.dimensionGroup.dimensions.values()][0];
        const arg = onPointerEnterExitArg(
            bot,
            dimension,
            modality.type,
            getModalityHand(modality),
            getModalityFinger(modality),
            getModalityButtonId(modality)
        );
        const actions = simulation.helper.actions([
            {
                eventName: ON_POINTER_EXIT,
                bots: [bot],
                arg,
            },
            {
                eventName: ON_ANY_POINTER_EXIT,
                bots: null,
                arg,
            },
        ]);
        simulation.helper.transaction(...actions);
    }

    handleBlockPointerEnter(
        bot3D: AuxBot3D,
        bot: Bot,
        simulation: Simulation,
        modality: InputModality,
        block: Block
    ) {
        let b = block as any;
        if (b.states['hovered']) {
            b.setState('hovered');
            b.isHovered = true;
        }
    }

    handleBlockPointerExit(
        bot3D: AuxBot3D,
        bot: Bot,
        simulation: Simulation,
        modality: InputModality,
        block: Block
    ) {
        let b = block as any;
        if (b.states['idle']) {
            b.setState('idle');
            b.isHovered = false;
        }
    }

    handlePointerDown(
        bot3D: AuxBot3D,
        bot: Bot,
        simulation: Simulation,
        modality: InputModality,
        block: Block | null
    ): void {
        if (modality.type !== 'finger') {
            let arg = onPointerUpDownArg(
                bot,
                [...bot3D.dimensionGroup.dimensions.values()][0],
                getModalityKey(modality),
                getModalityHand(modality),
                getModalityFinger(modality),
                getModalityButtonId(modality)
            );
            simulation.helper.transaction(
                ...simulation.helper.actions([
                    {
                        eventName: ON_POINTER_DOWN,
                        bots: [bot],
                        arg,
                    },
                    {
                        eventName: ON_ANY_POINTER_DOWN,
                        bots: null,
                        arg,
                    },
                ])
            );
        }

        if (block) {
            let b = block as any;
            if (b.states['selected']) {
                b.setState('selected');
            }
        }
    }

    handlePointerUp(
        bot3D: AuxBot3D,
        bot: Bot,
        simulation: Simulation,
        modality: InputModality,
        block: Block | null
    ): void {
        if (modality.type !== 'finger') {
            let arg = onPointerUpDownArg(
                bot,
                [...bot3D.dimensionGroup.dimensions.values()][0],
                getModalityKey(modality),
                getModalityHand(modality),
                getModalityFinger(modality),
                getModalityButtonId(modality)
            );
            simulation.helper.transaction(
                ...simulation.helper.actions([
                    {
                        eventName: ON_POINTER_UP,
                        bots: [bot],
                        arg,
                    },
                    {
                        eventName: ON_ANY_POINTER_UP,
                        bots: null,
                        arg,
                    },
                ])
            );
        }

        if (block) {
            let b = block as any;
            let state = b.isHovered ? 'hovered' : 'idle';
            if (b.states[state]) {
                b.setState(state);
            }
        }
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

    createEmptyClickOperation(
        inputMethod: InputMethod,
        inputModality: InputModality
    ): IOperation {
        return new PlayerEmptyClickOperation(
            this._game,
            this,
            inputMethod,
            inputModality
        );
    }

    createHtmlElementClickOperation(element: HTMLElement): IOperation {
        return null;
    }

    getDefaultGrid3D(): Grid3D {
        const sim = <PlayerPageSimulation3D>(
            this._game
                .getSimulations()
                .find((sim3D) => sim3D instanceof PlayerPageSimulation3D)
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

        // miniGridPortal camera
        let invCameraRigControls: CameraRigControls = {
            rig: this._game.getMiniPortalCameraRig(),
            controls: new CameraControls(
                this._game.getMiniPortalCameraRig().mainCamera,
                this._game,
                this._game.getMiniPortalCameraRig().viewport
            ),
        };

        invCameraRigControls.controls.minZoom = Orthographic_MinZoom;
        invCameraRigControls.controls.maxZoom = Orthographic_MaxZoom;

        if (invCameraRigControls.rig.mainCamera instanceof OrthographicCamera) {
            invCameraRigControls.controls.screenSpacePanning = true;
        }

        // map portal camera
        let mapPortalCameraRigControls: CameraRigControls = {
            rig: this._game.getMapPortalCameraRig(),
            controls: new CameraControls(
                this._game.getMapPortalCameraRig().mainCamera,
                this._game,
                this._game.getMapPortalCameraRig().viewport
            ),
        };

        mapPortalCameraRigControls.controls.passthroughEvents = true;
        mapPortalCameraRigControls.controls.minZoom = Orthographic_MinZoom;
        mapPortalCameraRigControls.controls.maxZoom = Orthographic_MaxZoom;

        if (
            mapPortalCameraRigControls.rig.mainCamera instanceof
            OrthographicCamera
        ) {
            mapPortalCameraRigControls.controls.screenSpacePanning = true;
        }

        // mini map portal camera
        let miniMapPortalCameraRigControls: CameraRigControls = {
            rig: this._game.getMiniMapPortalCameraRig(),
            controls: new CameraControls(
                this._game.getMiniMapPortalCameraRig().mainCamera,
                this._game,
                this._game.getMiniMapPortalCameraRig().viewport
            ),
        };

        miniMapPortalCameraRigControls.controls.passthroughEvents = true;
        miniMapPortalCameraRigControls.controls.minZoom = Orthographic_MinZoom;
        miniMapPortalCameraRigControls.controls.maxZoom = Orthographic_MaxZoom;

        if (
            miniMapPortalCameraRigControls.rig.mainCamera instanceof
            OrthographicCamera
        ) {
            miniMapPortalCameraRigControls.controls.screenSpacePanning = true;
        }

        return [
            mainCameraRigControls,
            invCameraRigControls,
            mapPortalCameraRigControls,
            miniMapPortalCameraRigControls,
        ];
    }

    protected _updateCameraOffsets() {
        for (let sim of this._game.getSimulations()) {
            const rig = sim.getMainCameraRig();
            const [portal, gridScale] = portalInfoForSim(sim);
            const portalBot = getPortalConfigBot(
                sim.simulation,
                `${portal}Portal`
            );
            if (!portalBot) {
                continue;
            }

            const targetPos = getTagPosition(portalBot, 'cameraPositionOffset');
            const targetRot = getTagRotation(portalBot, 'cameraRotationOffset');

            const targetXPos = targetPos.x * gridScale;
            const targetYPos = targetPos.y * gridScale;
            const targetZPos = targetPos.z * gridScale;

            const targetQuat = targetRot.quaternion;

            const offsetZoom = calculateNumericalTagValue(
                null,
                portalBot,
                `cameraZoomOffset`,
                0
            );

            const transformer = getBotTransformer(null, portalBot);
            let hasParent = false;
            if (transformer) {
                const bots = sim.findBotsById(transformer);

                if (bots.length > 0) {
                    const parentBot = bots[0];
                    if (parentBot instanceof AuxBot3D) {
                        if (
                            safeSetParent(
                                rig.cameraParent,
                                parentBot.transformContainer
                            )
                        ) {
                            hasParent = true;
                        }
                    }
                }
            }
            if (!hasParent) {
                safeSetParent(rig.cameraParent, sim.scene);
            }

            if (
                rig.cameraParent.position.x !== targetXPos ||
                rig.cameraParent.position.y !== targetYPos ||
                rig.cameraParent.position.z !== targetZPos ||
                rig.cameraParent.quaternion.x !== targetQuat.x ||
                rig.cameraParent.quaternion.y !== targetQuat.y ||
                rig.cameraParent.quaternion.z !== targetQuat.z ||
                rig.cameraParent.quaternion.w !== targetQuat.w
            ) {
                const deltaX = targetXPos - rig.cameraParent.position.x;
                const deltaY = targetYPos - rig.cameraParent.position.y;
                const deltaZ = targetZPos - rig.cameraParent.position.z;

                const controls = this.cameraRigControllers.find(
                    (c) => c.rig === rig
                );

                if (controls) {
                    controls.controls.cameraFrameOffset.set(
                        deltaX,
                        deltaY,
                        deltaZ
                    );
                }

                rig.cameraParent.position.set(
                    targetXPos,
                    targetYPos,
                    targetZPos
                );

                rig.cameraParent.quaternion.set(
                    targetQuat.x,
                    targetQuat.y,
                    targetQuat.z,
                    targetQuat.w
                );
                rig.cameraParent.updateMatrixWorld();
            }

            if (offsetZoom !== 0 && !isNaN(offsetZoom)) {
                const controls = this.cameraRigControllers.find(
                    (c) => c.rig === rig
                );

                const delta = offsetZoom - controls.controls.zoomOffset;

                if (Math.abs(delta) >= 0.01) {
                    controls.controls.zoomOffset = offsetZoom;
                    if (offsetZoom > 0) {
                        controls.controls.dollyInAmount(delta, false);
                    } else {
                        controls.controls.dollyOutAmount(delta, false);
                    }
                }
            }
        }
    }

    // This function is kinda the worst but should be fine
    // as long as performance doesn't become an issue.
    protected _updatePlayerBotTags() {
        if (this._disablePlayerBotTags) {
            return;
        }

        const input = this._game.getInput();
        const pagePos = input.getMousePagePos();
        const draggableGroups = this.getDraggableGroups();
        const viewports = this._game.getViewports();

        let inputList = [
            'keyboard',
            'mousePointer',
            'touch',
            ...input.controllers.map(
                (c) => `${c.inputSource.handedness}Pointer`
            ),
        ];

        let inputUpdate = {} as BotTags;

        let inputListChanged = false;
        if (!this._lastInputList) {
            this._lastInputList = inputList;
            inputListChanged = true;
        } else if (this._lastInputList.length !== inputList.length) {
            this._lastInputList = inputList;
            inputListChanged = true;
        } else {
            for (let i = 0; i < inputList.length; i++) {
                if (inputList[i] !== this._lastInputList[i]) {
                    inputListChanged = true;
                    break;
                }
            }
        }

        if (inputListChanged) {
            inputUpdate.inputList = inputList;
            this._lastInputList = inputList;
        }

        for (let key of input.getKeys()) {
            checkInput(key.state, `keyboard_${key.key}`, inputUpdate);
        }

        const leftState = input.getButtonInputState(MouseButtonId.Left);
        const rightState = input.getButtonInputState(MouseButtonId.Right);
        const middleState = input.getButtonInputState(MouseButtonId.Middle);
        checkInput(leftState, 'mousePointer_left', inputUpdate);
        checkInput(rightState, 'mousePointer_right', inputUpdate);
        checkInput(middleState, 'mousePointer_middle', inputUpdate);

        for (let i = 0; i < 5; i++) {
            const touch = input.getTouchData(i);
            if (touch) {
                checkInput(touch.state, `touch_${i}`, inputUpdate);
            } else {
                inputUpdate[`touch_${i}`] = null;
            }
        }

        for (let sim of this._game.getSimulations()) {
            const rig = sim.getMainCameraRig();
            const controls = this.cameraRigControllers.find(
                (c) => c.rig === rig
            );
            const cameraWorld = new Vector3();
            rig.mainCamera.getWorldPosition(cameraWorld);
            const cameraForward = cameraForwardRay(rig.mainCamera);
            const cameraUp = cameraUpwardRay(rig.mainCamera);
            const { euler: cameraRotation, quaternion: cameraQuaternion } =
                lookRotation(cameraForward, cameraUp);
            const [portal, gridScale, inverseScale] = portalInfoForSim(sim);

            cameraWorld.multiplyScalar(inverseScale);

            let focusWorld: Vector3;
            if (controls) {
                focusWorld = controls.controls.target.clone();
                rig.cameraParent.localToWorld(focusWorld);
                focusWorld.multiplyScalar(inverseScale);
            } else {
                focusWorld = new Vector3();
            }

            let update: BotTags = {
                [`cameraPositionX`]: cameraWorld.x,
                [`cameraPositionY`]: cameraWorld.y,
                [`cameraPositionZ`]: cameraWorld.z,
                [`cameraRotationX`]: cameraRotation.x,
                [`cameraRotationY`]: cameraRotation.y,
                [`cameraRotationZ`]: cameraRotation.z,
                [`cameraFocusX`]: focusWorld.x ?? 0,
                [`cameraFocusY`]: focusWorld.y ?? 0,
                [`cameraFocusZ`]: focusWorld.z ?? 0,

                [`cameraZoom`]: controls?.controls.currentZoom ?? 0,

                [`cameraPosition`]: formatBotVector(cameraWorld),
                [`cameraRotation`]: formatBotRotation(cameraQuaternion),
                [`cameraFocus`]: formatBotVector(focusWorld ?? new Vector3()),
            };

            for (let i = 0; i < draggableGroups.length; i++) {
                const group = draggableGroups[i];
                const objects = group.objects;
                const camera = group.camera;
                const viewport = group.viewport;

                if (sim.getMainCameraRig().viewport !== group.viewport) {
                    continue;
                }

                if (
                    !Input.pagePositionOnViewport(pagePos, viewport, viewports)
                ) {
                    // Page position is not on or is being obstructed by other viewports.
                    // Ignore this draggable group.
                    continue;
                }

                try {
                    const screenPos = Input.screenPositionForViewport(
                        pagePos,
                        viewport
                    );
                    const ray = Physics.rayAtScreenPos(screenPos, camera);
                    const up = cameraUpwardRay(camera);
                    const {
                        euler: worldRotation,
                        quaternion: worldQuaternion,
                    } = lookRotation(ray, up);

                    const mousePosition = new Vector3(
                        ray.origin.x * inverseScale,
                        ray.origin.y * inverseScale,
                        ray.origin.z * inverseScale
                    );

                    Object.assign(inputUpdate, {
                        [`mousePointerPositionX`]: mousePosition.x,
                        [`mousePointerPositionY`]: mousePosition.y,
                        [`mousePointerPositionZ`]: mousePosition.z,
                        [`mousePointerRotationX`]: worldRotation.x,
                        [`mousePointerRotationY`]: worldRotation.y,
                        [`mousePointerRotationZ`]: worldRotation.z,
                        [`mousePointerPortal`]: portal,

                        [`mousePointerPosition`]:
                            formatBotVector(mousePosition),
                        [`mousePointerRotation`]:
                            formatBotRotation(worldQuaternion),
                    });
                } catch (err) {
                    console.warn(
                        '[PlayerInteractionManager] Unable to set mousePointer tags:',
                        err
                    );
                }
            }

            if (sim instanceof PlayerPageSimulation3D) {
                for (let controller of input.controllers) {
                    const hand = controller.inputSource.handedness;
                    try {
                        const ray = objectForwardRay(controller.ray);
                        const up = objectUpwardRay(controller.ray);
                        const {
                            euler: worldRotation,
                            quaternion: worldQuaternion,
                        } = lookRotation(ray, up);

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

                        const pointerPosition = new Vector3(
                            ray.origin.x * inverseScale,
                            ray.origin.y * inverseScale,
                            ray.origin.z * inverseScale
                        );

                        Object.assign(inputUpdate, {
                            ...inputStates,
                            [`${hand}PointerPositionX`]: pointerPosition.x,
                            [`${hand}PointerPositionY`]: pointerPosition.y,
                            [`${hand}PointerPositionZ`]: pointerPosition.z,
                            [`${hand}PointerRotationX`]: worldRotation.x,
                            [`${hand}PointerRotationY`]: worldRotation.y,
                            [`${hand}PointerRotationZ`]: worldRotation.z,
                            [`${hand}PointerPortal`]: portal,

                            [`${hand}PointerPosition`]:
                                formatBotVector(pointerPosition),
                            [`${hand}PointerRotation`]:
                                formatBotRotation(worldQuaternion),
                        });
                    } catch (err) {
                        console.warn(
                            `[PlayerInteractionManager] Unable to set ${hand} controller tags:`,
                            err
                        );
                    }
                }
            }

            if (sim instanceof MapSimulation3D) {
                const view = sim.mapView;
                if (view?.camera?.position) {
                    const gridPosition =
                        sim.grid3D.getGridPosition(cameraWorld);
                    gridPosition.setZ(gridPosition.z * -1);
                    update[`cameraMapPosition`] = formatBotVector(gridPosition);
                } else {
                    update[`cameraMapPosition`] = null;
                }

                delete update[`cameraFocusX`];
                delete update[`cameraFocusY`];
                delete update[`cameraFocusZ`];
                delete update[`cameraFocus`];
            }

            // We have to postfix with "Portal" because the portal names are "gridPortal"
            // and "miniGridPortal" but are abbreviated to 'grid' and "mini".
            const portalBot = getPortalConfigBot(
                sim.simulation,
                `${portal}Portal`
            );

            if (portalBot) {
                applyUpdateToBot(sim.simulation, update, portalBot);
            }

            const userBot = sim.simulation.helper.userBot;
            if (userBot && sim instanceof PlayerPageSimulation3D) {
                applyUpdateToBot(sim.simulation, inputUpdate, userBot);
            }
        }

        function checkInput(state: InputState, name: string, update: any) {
            if (!state) {
                return false;
            }
            if (state.isDownOnFrame(input.time.frameCount)) {
                inputUpdate[name] = 'down';
                return true;
            } else if (state.isHeldOnFrame(input.time.frameCount)) {
                inputUpdate[name] = 'held';
                return true;
            } else if (state.isUpByFrame(input.time.frameCount)) {
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

function portalInfoForSim(sim: Simulation3D) {
    let portal: 'grid' | 'miniGrid' | 'map' | 'miniMap';
    let gridScale: number;
    if (sim instanceof PlayerPageSimulation3D) {
        portal = 'grid';
        gridScale = sim.pageConfig.gridScale;
    } else if (sim instanceof MiniSimulation3D) {
        portal = 'miniGrid';
        gridScale = sim.miniConfig.gridScale;
    } else if (sim instanceof MiniMapSimulation3D) {
        portal = 'miniMap';
        gridScale = sim.mapConfig.gridScale;
    } else if (sim instanceof MapSimulation3D) {
        portal = 'map';
        gridScale = sim.mapConfig.gridScale;
    }
    let inverseScale = 1 / gridScale;

    return [portal, gridScale, inverseScale] as const;
}

async function applyUpdateToBot(
    simulation: Simulation,
    update: BotTags,
    bot: Bot
) {
    for (let key in update) {
        const portalValue = bot.tags[key];
        const updateValue = update[key];
        if (
            portalValue === updateValue ||
            (!hasValue(portalValue) && !hasValue(updateValue)) ||
            (hasValue(portalValue) &&
                hasValue(updateValue) &&
                isEqual(portalValue, updateValue)) ||
            (typeof portalValue === 'number' &&
                typeof updateValue === 'number' &&
                isNaN(portalValue) &&
                isNaN(updateValue))
        ) {
            delete update[key];
        }
    }

    if (Object.keys(update).length > 0) {
        await simulation.helper.updateBot(bot, {
            tags: update,
        });
    }
}

function lookRotation(forward: Ray, up: Ray) {
    const rotation = new Rotation({
        direction: new CasualVector3(
            forward.direction.x,
            forward.direction.y,
            forward.direction.z
        ),
        upwards: new CasualVector3(
            up.direction.x,
            up.direction.y,
            up.direction.z
        ),
        errorHandling: 'error',
    });
    const rotationQuaternion = new Quaternion(
        rotation.quaternion.x,
        rotation.quaternion.y,
        rotation.quaternion.z,
        rotation.quaternion.w
    );

    return {
        euler: new Euler().setFromQuaternion(rotationQuaternion),
        quaternion: rotationQuaternion,
    };
}
