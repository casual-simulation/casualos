import {
    Vector2,
    Vector3,
    Intersection,
    Object3D,
    OrthographicCamera,
    Ray,
    Color,
    Sphere,
} from '@casual-simulation/three';
import { ContextMenuEvent, ContextMenuAction } from './ContextMenuEvent';
import {
    BotCalculationContext,
    Bot,
    BotTags,
    getBotCursor,
    hasValue,
} from '@casual-simulation/aux-common';
import { Physics } from '../scene/Physics';
import { flatMap } from 'lodash';
import { CameraControls } from './CameraControls';
import {
    MouseButtonId,
    InputType,
    Input,
    ControllerData,
    InputMethod,
    MOUSE_INPUT_METHOD_IDENTIFIER,
    InputModality,
    getFingerModality,
    getModalityKey,
    getModalityHand,
    formatModalityButtonId,
    modalityForInputMethod,
} from '../scene/Input';
import { appManager } from '../AppManager';
import { IOperation } from './IOperation';
import { AuxBot3D } from '../scene/AuxBot3D';
import { GameObject } from '../scene/GameObject';
import {
    Orthographic_MinZoom,
    Orthographic_MaxZoom,
    CameraRig,
} from '../scene/CameraRigFactory';
import { TapCodeManager } from './TapCodeManager';
import { Simulation } from '@casual-simulation/aux-vm';
import { DraggableGroup } from './DraggableGroup';
import {
    isObjectVisible,
    objectForwardRay,
    cameraForwardRay,
} from '../scene/SceneUtils';
import { CameraRigControls } from './CameraRigControls';
import { Game } from '../scene/Game';
import { DimensionGroup3D } from '../scene/DimensionGroup3D';
import { DebugObjectManager } from '../scene/debugobjectmanager/DebugObjectManager';
import { Viewport } from '../scene/Viewport';
import { Grid3D } from '../scene/Grid3D';
import { BaseBotDragOperation } from './DragOperation/BaseBotDragOperation';
import { BaseModDragOperation } from './DragOperation/BaseModDragOperation';
import { BaseClickOperation } from './ClickOperation/BaseClickOperation';
import { Block } from 'three-mesh-ui';

interface HoveredBot {
    /**
     * The bot that is being hovered on.
     */
    bot: Bot;

    /**
     * The 3D bot that is being hovered.
     */
    bot3D: AuxBot3D;

    /**
     * The simulation that the hover is occuring in.
     */
    simulation: Simulation;

    /**
     * The last frame that this object was being hovered on.
     */
    frame: number;

    /**
     * The modality that determines the lifecycle of this hovered bot.
     */
    modalityKey: string;

    /**
     * The modality that originally started hovering this bot.
     */
    modality: InputModality;

    /**
     * The UI element that is being hovered.
     * If null, then there is no specific UI element that is being hovered/focused for the bot.
     */
    block: Block;
}

export abstract class BaseInteractionManager {
    protected _game: Game;
    protected _cameraRigControllers: CameraRigControls[];
    protected _tapCodeManager: TapCodeManager;
    protected _maxTapCodeLength: number;
    protected _hoveredBots: HoveredBot[];
    protected _focusedBots: HoveredBot[];

    protected _draggableGroups: DraggableGroup[];
    protected _draggableGroupsDirty: boolean;

    private _operations: IOperation[];
    private _overHtmlMixerIFrame: boolean;
    private _cameraControlsEnabled: boolean;

    // A map for input methods to the bot that they're directly interacting with.
    private _inputMethodMap: Map<
        string,
        { bot: AuxBot3D; modality: InputModality; block: Block | null }[]
    >;

    private _contextMenuOpen: boolean = false;

    constructor(game: Game) {
        this._draggableGroupsDirty = true;
        this._game = game;
        this._cameraRigControllers = this._createControlsForCameraRigs();
        this._operations = [];
        this._tapCodeManager = new TapCodeManager();
        this._maxTapCodeLength = 4;
        this._hoveredBots = [];
        this._focusedBots = [];
        this._inputMethodMap = new Map();
        this._cameraControlsEnabled = true;

        // Bind event handlers to this instance of the class.
        this._handleBotAdded = this._handleBotAdded.bind(this);
        this._handleBotUpdated = this._handleBotUpdated.bind(this);
        this._handleBotRemoved = this._handleBotRemoved.bind(this);
        this._handleCameraRigTypeChanged =
            this._handleCameraRigTypeChanged.bind(this);

        // Listen to bot events from game view.
        this._game.onBotAdded.addListener(this._handleBotAdded);
        this._game.onBotUpdated.addListener(this._handleBotUpdated);
        this._game.onBotRemoved.addListener(this._handleBotRemoved);
        this._game.onCameraRigTypeChanged.addListener(
            this._handleCameraRigTypeChanged
        );
    }

    /**
     * Gets all the camera rig controls.
     */
    get cameraRigControllers() {
        return this._cameraRigControllers;
    }

    get overHtmlMixerIFrame() {
        return this._overHtmlMixerIFrame;
    }

    /**
     * Gets whether the camera controls should be enabled.
     */
    get cameraControlsEnabled() {
        return this._cameraControlsEnabled;
    }

    /**
     * Sets whether the camera controls should be enabled.
     */
    set cameraControlsEnabled(value: boolean) {
        this._cameraControlsEnabled = value;
    }

    /**
     * Adds the given operation to the operation list.
     * @param operation The operation to add.
     * @param disableCameraControls Whether to disable the camera controls while the operation is in effect.
     */
    addOperation(
        operation: IOperation,
        disableCameraControls: boolean = false
    ) {
        this._operations.push(operation);
        if (disableCameraControls) {
            this.setCameraControlsEnabled(false);
        }
    }

    /**
     * Removes and disposes any operations that have the given type.
     * @param type The class/type of the operations that should be canceled.
     */
    clearOperationsOfType(type: any) {
        this._operations = this._operations.filter((o) => {
            if (o instanceof type) {
                o.dispose();
                return false;
            }
            return true;
        });
    }

    /**
     * Removes and disposes of any operations that the given filter returns true for.
     * @param filter
     */
    clearOperations(filter: (operation: IOperation) => boolean) {
        this._operations = this._operations.filter((o) => {
            if (filter(o)) {
                o.dispose();
                return false;
            }
            return true;
        });
    }

    update(): void {
        // const calc = appManager.simulationManager.primary.helper.createContext();
        // Update active operations and dispose of any that are finished.
        this._operations = this._operations.filter((o) => {
            const calc = o.simulation
                ? o.simulation.helper.createContext()
                : null;
            o.update(calc);

            if (o.isFinished()) {
                o.dispose();
                return false;
            }

            return true;
        });

        //
        // Normal browser interaction.
        //
        const input = this._game.getInput();

        // Detect if we are over any html mixer iframe element.
        this._overHtmlMixerIFrame = false;
        const clientPos = input.getMouseClientPos();
        if (clientPos) {
            const htmlMixerContext = this._game.getHtmlMixerContext();
            if (htmlMixerContext) {
                this._overHtmlMixerIFrame =
                    htmlMixerContext.isOverAnyIFrameElement(clientPos);
            }
        }

        const noMouseInput =
            !input.getMouseButtonHeld(MouseButtonId.Left) &&
            !input.getMouseButtonHeld(MouseButtonId.Middle) &&
            !input.getMouseButtonHeld(MouseButtonId.Right);

        if (noMouseInput && input.getTouchCount() === 0) {
            // Always allow the iframes to recieve input when no inputs are being held.
            const webglCanvas = this._game.getRenderer().domElement;
            webglCanvas.style.pointerEvents = 'none';
        }

        if (!noMouseInput) {
            this.hideContextMenu();
        }

        if (this._operations.length === 0) {
            this.setCameraControlsEnabled(this._cameraControlsEnabled);
        }

        // Detect left click.
        this._handleMouseInput(input);
        this._handleControllerInput(input);
        this._handleTapCodes(input);
        this._handleCameraInput();

        this._updateAdditionalNormalInputs(input);

        this._updateHoveredBots();
        this._updateFocusedBots();
        this._updatePlayerBotTags();
        this._updateCursors();

        // Update camera controls after handing other inputs so that
        // we can enable/disable the controls before it tries using the input.
        this._updateCameraOffsets();
        this._updateCameraControls();
    }

    protected _updatePlayerBotTags() {}

    protected _updateCameraOffsets() {}

    protected _updateCursors() {
        let hasCursor = false;
        for (let bot of this._hoveredBots) {
            const cursor = getBotCursor(null, bot.bot);
            if (hasValue(cursor)) {
                // TODO: rework to do a better job of handling
                this._game.botCursor = cursor;
                hasCursor = true;
                break;
            }
        }

        if (!hasCursor) {
            this._game.botCursor = null;
        }
    }

    protected _updateCameraControls() {
        for (let controller of this._cameraRigControllers) {
            this._updateCameraController(controller);
        }
    }

    protected _updateCameraController(controller: CameraRigControls) {
        controller.controls.enableImmersive = this._game.allowImmersiveControls;
        controller.controls.update();
    }

    private _handleCameraInput() {
        for (let controller of this._cameraRigControllers) {
            const ray = cameraForwardRay(controller.rig.mainCamera);
            const { hit, gameObject } = this.findHoveredGameObjectFromRay(
                ray,
                (obj) => obj.focusable,
                controller.rig.viewport
            );

            if (gameObject) {
                this._setFocusedBot(gameObject);
            }
        }
    }

    private _handleTapCodes(input: Input) {
        this._tapCodeManager.recordTouches(input.getTouchCount());
        if (input.getKeyHeld('Alt')) {
            for (let i = 1; i <= 9; i++) {
                if (input.getKeyDown(i.toString())) {
                    this._tapCodeManager.recordTouches(i);
                }
            }
        }
        if (this._tapCodeManager.code.length >= this._maxTapCodeLength) {
            const code = this._tapCodeManager.code;
            console.log('[BaseInteractionManager] tap code: ', code);
            appManager.simulationManager.simulations.forEach((sim) => {
                sim.helper.action('onTapCode', null, code);
            });
            this._tapCodeManager.trim(this._maxTapCodeLength - 1);
        }
    }

    private _handleMouseInput(input: Input) {
        for (let buttonId of [
            MouseButtonId.Left,
            MouseButtonId.Middle,
            MouseButtonId.Right,
        ]) {
            const inputMethod: InputMethod = {
                type: 'mouse_or_touch',
                identifier: MOUSE_INPUT_METHOD_IDENTIFIER,
                buttonId,
            };
            const modality: InputModality = modalityForInputMethod(
                inputMethod,
                input.currentInputType
            );
            if (input.getMouseButtonDown(buttonId)) {
                if (!this._overHtmlMixerIFrame) {
                    this._disableIFramePointerEvents();
                }
                if (
                    input.isMouseButtonDownOnElement(
                        this._game.gameView.gameView
                    )
                ) {
                    const { gameObject, hit, block } =
                        this.findHoveredGameObject(
                            inputMethod,
                            (obj) => obj.pointable
                        );
                    if (gameObject) {
                        // Start game object click operation.
                        this._startClickingGameObject(
                            gameObject,
                            hit,
                            inputMethod,
                            modality,
                            block
                        );
                    } else {
                        this._startClickingEmptySpace(inputMethod, modality);
                    }
                } else if (
                    buttonId === MouseButtonId.Left &&
                    input.isMouseButtonDownOnAnyElements(
                        this._game.getUIHtmlElements()
                    )
                ) {
                    const element = input.getTargetData().inputDown;
                    const elementClickOperation =
                        this.createHtmlElementClickOperation(
                            element,
                            inputMethod
                        );
                    if (elementClickOperation !== null) {
                        this._operations.push(elementClickOperation);
                    }
                }
            } else if (input.getMouseButtonUp(buttonId)) {
                this._stopClickingGameObject(inputMethod);
            }
        }

        // Middle click or Right click.
        if (
            input.getMouseButtonDown(MouseButtonId.Middle) ||
            input.getMouseButtonDown(MouseButtonId.Right)
        ) {
            if (!this._overHtmlMixerIFrame) {
                this._disableIFramePointerEvents();
            }
            if (
                input.isMouseButtonDownOnElement(this._game.gameView.gameView)
            ) {
                // Always allow camera control with middle clicks.
                this.setCameraControlsEnabled(this._cameraControlsEnabled);
            }
        }

        if (input.supportsHoverEvents) {
            if (input.isMouseFocusingOnElement(this._game.gameView.gameView)) {
                const inputMethod: InputMethod = {
                    type: 'mouse_or_touch',
                    identifier: MOUSE_INPUT_METHOD_IDENTIFIER,
                    buttonId: null,
                };
                const { gameObject, block } = this.findHoveredGameObject(
                    inputMethod,
                    (obj) => obj.pointable
                );
                if (gameObject) {
                    // Set bot as being hovered on.
                    this._setHoveredBot(
                        gameObject,
                        modalityForInputMethod(
                            inputMethod,
                            input.currentInputType
                        ),
                        block
                    );
                }
            }
        }
    }

    private _handleControllerInput(input: Input) {
        for (let controller of input.controllers) {
            const inputMethod: InputMethod = {
                type: 'controller',
                controller: controller,
                identifier: controller.identifier,
            };
            const controllerModality: InputModality = {
                type: 'controller',
                hand: controller.inputSource.handedness,
            };
            if (input.getControllerPrimaryButtonDown(controller)) {
                const { gameObject, hit, block } = this.findHoveredGameObject(
                    inputMethod,
                    (obj) => obj.pointable
                );
                if (gameObject) {
                    this._startClickingGameObject(
                        gameObject,
                        hit,
                        inputMethod,
                        controllerModality,
                        block
                    );
                } else {
                    this._startClickingEmptySpace(
                        inputMethod,
                        controllerModality
                    );
                }
            } else if (input.getControllerPrimaryButtonUp(controller)) {
                this._stopClickingGameObject(inputMethod);
            }

            if (
                input.currentInputType === InputType.Controller &&
                controller.inputSource.targetRayMode !== 'screen'
            ) {
                const { gameObject, hit, block } = this.findHoveredGameObject(
                    inputMethod,
                    (obj) => obj.pointable
                );
                if (gameObject) {
                    // Set bot as being hovered on.
                    this._setHoveredBot(gameObject, controllerModality, block);
                }

                if (hit) {
                    controller.mesh.setPointerHitDistance(hit.distance);
                } else {
                    const grid = this.getDefaultGrid3D();
                    const inputRay = objectForwardRay(controller.ray);
                    const point = grid.getPointFromRay(inputRay);
                    if (point) {
                        const distance = point.distanceTo(
                            controller.ray.position
                        );
                        controller.mesh.setPointerHitDistance(distance);
                    } else {
                        controller.mesh.setPointerHitDistance(null);
                    }
                }

                for (let [finger, position] of controller.fingerTips) {
                    DebugObjectManager.drawPoint(
                        position.center.clone(),
                        position.radius
                    );
                    const { gameObject, hit, block } =
                        this.findIntersectedGameObject(
                            position,
                            (obj) => obj.pointable
                        );

                    if (gameObject) {
                        const modality = getFingerModality(
                            controller.inputSource.handedness,
                            finger,
                            position
                        );

                        // Set bot as being hovered on.
                        this._setHoveredBot(gameObject, modality, block);

                        const clickInProgress = this._operations.some((op) => {
                            if (op instanceof BaseClickOperation) {
                                if (
                                    op.modality.type === 'controller' ||
                                    op.modality.type === 'finger'
                                ) {
                                    return op.modality.hand === modality.hand;
                                }
                            }
                        });

                        if (!clickInProgress) {
                            this._startClickingGameObject(
                                gameObject,
                                hit,
                                inputMethod,
                                modality,
                                block
                            );
                        }
                    }
                }
            }
        }
    }

    private _stopClickingGameObject(method: InputMethod) {
        const pressedBots = this.getPressedBots(method.identifier);
        if (pressedBots.length > 0) {
            for (let press of pressedBots) {
                const pressedBot = press.bot;
                this.handlePointerUp(
                    pressedBot,
                    pressedBot.bot,
                    pressedBot.dimensionGroup.simulation3D.simulation,
                    press.modality,
                    press.block
                );
                this.clearPressedBot(method.identifier);
            }
        }
    }

    getPressedBots(inputMethodIdentifier: string) {
        return this._inputMethodMap.get(inputMethodIdentifier) ?? [];
    }

    setPressedBot(
        inputMethodIdentifier: string,
        bot: AuxBot3D,
        modality: InputModality,
        block: Block | null
    ) {
        let bots = this._inputMethodMap.get(inputMethodIdentifier);
        if (!bots) {
            bots = [];
            this._inputMethodMap.set(inputMethodIdentifier, bots);
        }

        let index = bots.findIndex(
            (b) => getModalityKey(b.modality) === getModalityKey(modality)
        );
        if (index >= 0) {
            bots[index] = {
                bot,
                modality,
                block,
            };
        } else {
            bots.push({
                bot,
                modality,
                block,
            });
        }
    }

    clearPressedBot(inputMethodIdentifier: string) {
        return this._inputMethodMap.delete(inputMethodIdentifier);
    }

    dragBot(simulation: Simulation, bot: Bot | BotTags, dimension: string) {
        if (
            !hasValue(bot) ||
            this._operations.some((op) => {
                const isDrag =
                    op instanceof BaseBotDragOperation ||
                    op instanceof BaseModDragOperation;
                const isReplaced =
                    op instanceof BaseClickOperation && op.replaced;
                return isDrag || isReplaced;
            })
        ) {
            // Skip because the base bot/mod drag operation should handle the event.
            return;
        }

        const input = this._game.getInput();
        let inputMethod: InputMethod = null;
        let modality: InputModality = null;
        if (input.currentInputType === InputType.Controller) {
            if (input.primaryController) {
                inputMethod = {
                    type: 'controller',
                    identifier: input.primaryController.identifier,
                    controller: input.primaryController,
                };
                modality = {
                    type: 'controller',
                    hand: input.primaryController.inputSource.handedness,
                };
            }
        } else if (
            input.currentInputType === InputType.Mouse ||
            input.currentInputType === InputType.Touch
        ) {
            inputMethod = {
                type: 'mouse_or_touch',
                identifier: MOUSE_INPUT_METHOD_IDENTIFIER,
                buttonId: MouseButtonId.Left, // Assume left click for dragging a bot
            };
            modality = {
                type:
                    input.currentInputType === InputType.Touch
                        ? 'touch'
                        : 'mouse',
                buttonId: 'left',
            };
        }

        if (inputMethod) {
            const botDragOperation = this.createBotDragOperation(
                simulation,
                bot,
                dimension,
                inputMethod,
                modality
            );
            if (botDragOperation !== null) {
                this.setCameraControlsEnabled(false);
                this._operations.push(botDragOperation);
            }
        }
    }

    private _startClickingEmptySpace(
        inputMethod: InputMethod,
        modality: InputModality
    ) {
        const emptyClickOperation = this.createEmptyClickOperation(
            inputMethod,
            modality
        );
        if (emptyClickOperation !== null) {
            this._operations.push(emptyClickOperation);
        }
        if (inputMethod.type !== 'controller') {
            this.setCameraControlsEnabled(this._cameraControlsEnabled);
        }
    }

    private _startClickingGameObject(
        gameObject: GameObject,
        hit: Intersection,
        method: InputMethod,
        modality: InputModality,
        block: Block | null
    ) {
        const gameObjectClickOperation = this.createGameObjectClickOperation(
            gameObject,
            hit,
            method,
            modality,
            block
        );
        if (gameObjectClickOperation !== null) {
            this.setCameraControlsEnabled(false);
            this._operations.push(gameObjectClickOperation);
        }
        if (gameObject instanceof AuxBot3D) {
            this.setPressedBot(method.identifier, gameObject, modality, block);
            this.handlePointerDown(
                gameObject,
                gameObject.bot,
                gameObject.dimensionGroup.simulation3D.simulation,
                modality,
                block
            );
        }
    }

    /**
     * Hover on the given game object if it represents an AuxBot3D.
     * @param gameObject GameObject for bot to start hover on.
     * @param modality The modality that is being used to hover the bot.
     * @param block The block that was hit.
     */
    protected _setHoveredBot(
        gameObject: GameObject,
        modality: InputModality,
        block: Block
    ): void {
        if (gameObject instanceof AuxBot3D) {
            const bot: Bot = gameObject.bot;
            const simulation: Simulation =
                gameObject.dimensionGroup.simulation3D.simulation;
            const key = getModalityKey(modality);

            let hoveredBot: HoveredBot = this._hoveredBots.find(
                (hoveredBot) => {
                    return (
                        hoveredBot.modalityKey === key &&
                        hoveredBot.bot.id === bot.id &&
                        hoveredBot.simulation.id === simulation.id
                    );
                }
            );
            let originalBlock = hoveredBot?.block;

            if (hoveredBot) {
                // Update the frame of the hovered bot to the current frame.
                hoveredBot.frame = this._game.getTime().frameCount;
            } else {
                // Create a new hovered bot object and add it to the list.
                hoveredBot = {
                    bot3D: gameObject,
                    bot,
                    simulation,
                    frame: this._game.getTime().frameCount,
                    modalityKey: key,
                    modality,
                    block,
                };
                this._hoveredBots.push(hoveredBot);
                this._updateHoveredBots();
                this.handlePointerEnter(gameObject, bot, simulation, modality);
            }

            if (block !== originalBlock) {
                hoveredBot.block = block;
                if (originalBlock) {
                    this.handleBlockPointerExit(
                        gameObject,
                        bot,
                        simulation,
                        modality,
                        originalBlock
                    );
                }
                if (block) {
                    this.handleBlockPointerEnter(
                        gameObject,
                        bot,
                        simulation,
                        modality,
                        block
                    );
                }
            }
        }
    }

    /**
     * Focus on the given game object if it represents an AuxBot3D.
     * @param gameObject GameObject for bot to start hover on.
     */
    protected _setFocusedBot(gameObject: GameObject): void {
        if (gameObject instanceof AuxBot3D) {
            const bot: Bot = gameObject.bot;
            const simulation: Simulation =
                gameObject.dimensionGroup.simulation3D.simulation;

            let focusedBot: HoveredBot = this._focusedBots.find(
                (focusedBot) => {
                    return (
                        focusedBot.bot.id === bot.id &&
                        focusedBot.simulation.id === simulation.id
                    );
                }
            );

            if (focusedBot) {
                // Update the frame of the hovered bot to the current frame.
                focusedBot.frame = this._game.getTime().frameCount;
            } else {
                // Create a new hovered bot object and add it to the list.
                focusedBot = {
                    bot3D: gameObject,
                    bot,
                    simulation,
                    frame: this._game.getTime().frameCount,
                    modalityKey: null,
                    modality: null,
                    block: null,
                };
                this._focusedBots.push(focusedBot);
                this._updateFocusedBots();
                this.handleFocusEnter(gameObject, bot, simulation);
            }
        }
    }

    /**
     * Check all hovered bots and release any that are no longer being hovered on.
     */
    protected _updateHoveredBots(): void {
        const curFrame = this._game.getTime().frameCount;

        this._hoveredBots = this._hoveredBots.filter((focusedBot) => {
            if (focusedBot.frame < curFrame) {
                // No longer hovering on this bot.
                this.handlePointerExit(
                    focusedBot.bot3D,
                    focusedBot.bot,
                    focusedBot.simulation,
                    focusedBot.modality
                );

                if (focusedBot.block) {
                    this.handleBlockPointerExit(
                        focusedBot.bot3D,
                        focusedBot.bot,
                        focusedBot.simulation,
                        focusedBot.modality,
                        focusedBot.block
                    );
                }
                return false;
            }

            // Still hovering on this bot.
            return true;
        });
    }

    /**
     * Check all hovered bots and release any that are no longer being hovered on.
     */
    protected _updateFocusedBots(): void {
        const curFrame = this._game.getTime().frameCount;

        this._focusedBots = this._focusedBots.filter((hoveredBot) => {
            if (hoveredBot.frame < curFrame) {
                // No longer hovering on this bot.
                this.handleFocusExit(
                    hoveredBot.bot3D,
                    hoveredBot.bot,
                    hoveredBot.simulation
                );
                return false;
            }

            // Still hovering on this bot.
            return true;
        });
    }

    protected _disableIFramePointerEvents(): void {
        // Dont allow iframes to capture input.
        const webglCanvas = this._game.getRenderer().domElement;
        webglCanvas.style.pointerEvents = 'auto';
    }

    /**
     * Handles any additional input events that the input manager might want to process.
     * @param input The input.
     */
    protected _updateAdditionalNormalInputs(input: Input) {}

    /**
     * Gets groups of draggables for input testing.
     */
    getDraggableGroups(): DraggableGroup[] {
        if (this._draggableGroupsDirty || !this._draggableGroups) {
            const dimensions = flatMap(
                this._game.getSimulations(),
                (s) => s.dimensions
            );
            if (dimensions && dimensions.length > 0) {
                let colliders = flatMap(
                    dimensions.filter((c) => !!c),
                    (f) => (f instanceof DimensionGroup3D ? f.colliders : [])
                ).filter((c) => !!c);

                this._draggableGroups = [
                    {
                        objects: colliders,
                        camera: this._game.getMainCameraRig().mainCamera,
                        viewport: this._game.getMainCameraRig().viewport,
                    },
                ];
            } else {
                this._draggableGroups = [];
            }
            this._draggableGroupsDirty = false;
        }
        return this._draggableGroups;
    }

    /**
     * Find the first game object that is underneath the current input device.
     */
    findHoveredGameObject(
        method: InputMethod,
        gameObjectFilter: (obj: GameObject) => boolean
    ) {
        if (method.type === 'controller') {
            return this.findHoveredGameObjectFromController(
                method.controller,
                gameObjectFilter
            );
        } else {
            return this.findHoveredGameObjectFromPagePosition(
                undefined,
                gameObjectFilter
            );
        }
    }

    findHitsFromScreenPosition(cameraRig: CameraRig, screenPos: Vector2) {
        const draggableGroups = this.getDraggableGroups();

        // Iterate through draggable groups until we hit an object in one of them.
        for (let i = 0; i < draggableGroups.length; i++) {
            const group = draggableGroups[i];
            const objects = group.objects;
            const camera = group.camera;
            const viewport = group.viewport;

            if (viewport !== cameraRig.viewport) {
                continue;
            }

            const raycastResult = Physics.raycastAtScreenPos(
                screenPos,
                objects,
                camera
            );

            return {
                hits: raycastResult.intersects,
                ray: raycastResult.ray,
            };
        }

        return null;
    }

    findHitsFromRay(cameraRig: CameraRig, ray: Ray) {
        const draggableGroups = this.getDraggableGroups();

        // Iterate through draggable groups until we hit an object in one of them.
        for (let i = 0; i < draggableGroups.length; i++) {
            const group = draggableGroups[i];
            const objects = group.objects;
            const camera = group.camera;
            const viewport = group.viewport;

            if (viewport !== cameraRig.viewport) {
                continue;
            }

            const raycastResult = Physics.raycast(ray, objects, camera);

            return {
                hits: raycastResult.intersects,
                ray: raycastResult.ray,
            };
        }

        return null;
    }

    findHoveredGameObjectFromPagePosition(
        pagePos?: Vector2,
        gameObjectFilter: (obj: GameObject) => boolean = null
    ) {
        pagePos = !!pagePos ? pagePos : this._game.getInput().getMousePagePos();

        const draggableGroups = this.getDraggableGroups();
        const viewports = this._game.getViewports();

        let hit: Intersection = null;
        let hitObject: GameObject = null;
        let block: Block = null;

        // Iterate through draggable groups until we hit an object in one of them.
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
            const raycastResult = Physics.raycastAtScreenPos(
                screenPos,
                objects,
                camera
            );
            const found = this.findFirstGameObject(
                raycastResult,
                gameObjectFilter
            );
            if (found) {
                [hit, hitObject] = found;
            }

            if (hit) {
                block = this.findBlockForHit(hit);
            }

            if (hitObject) {
                // We hit a game object in this simulation, stop searching through simulations.
                break;
            }
        }

        if (hitObject) {
            return {
                gameObject: hitObject,
                hit: hit,
                block: block,
            };
        } else {
            return {
                gameObject: null,
                hit: null,
                block: null,
            };
        }
    }

    /**
     * Finds the first game oject that is being pointed at by the given controller.
     * @param controller The controller.
     */
    findHoveredGameObjectFromController(
        controller: ControllerData,
        gameObjectFilter: (obj: GameObject) => boolean
    ) {
        const ray = objectForwardRay(controller.ray);
        const viewport = this._game.getMainCameraRig().viewport;
        return this.findHoveredGameObjectFromRay(
            ray,
            gameObjectFilter,
            viewport
        );
    }

    /**
     * Find the first game object that is being pointed at by the given ray.
     * @param ray The ray.
     */
    findHoveredGameObjectFromRay(
        ray: Ray,
        gameObjectFilter: (obj: GameObject) => boolean,
        viewport: Viewport = null
    ) {
        const draggableGroups = this.getDraggableGroups();

        let hit: Intersection = null;
        let hitObject: GameObject = null;
        let block: Block = null;

        // Iterate through draggable groups until we hit an object in one of them.
        for (let i = 0; i < draggableGroups.length; i++) {
            const group = draggableGroups[i];
            const objects = group.objects;
            const camera = group.camera;

            if (viewport && group.viewport !== viewport) {
                continue;
            }

            const raycastResult = Physics.raycast(ray, objects, camera);
            const found = this.findFirstGameObject(
                raycastResult,
                gameObjectFilter
            );
            if (found) {
                [hit, hitObject] = found;
            }
            if (hit) {
                block = this.findBlockForHit(hit);
            }

            if (hitObject) {
                // We hit a game object in this simulation, stop searching through simulations.
                break;
            }
        }

        if (hitObject) {
            return {
                gameObject: hitObject,
                hit: hit,
                block: block,
            };
        } else {
            return {
                gameObject: null,
                hit: null,
                block: null,
            };
        }
    }

    /**
     * Finds the first game object that is intersecting the given sphere.
     * @param sphere The sphere.
     */
    findIntersectedGameObject(
        sphere: Sphere,
        gameObjectFilter: (obj: GameObject) => boolean,
        viewport: Viewport = null
    ) {
        const draggableGroups = this.getDraggableGroups();

        let hit: Intersection = null;
        let hitObject: GameObject = null;
        let block: Block = null;

        // Iterate through draggable groups until we hit an object in one of them.
        for (let i = 0; i < draggableGroups.length; i++) {
            const group = draggableGroups[i];
            const objects = group.objects;

            if (viewport && group.viewport !== viewport) {
                continue;
            }

            const raycastResult = Physics.intersect(sphere, objects);
            const found = this.findFirstGameObject(
                raycastResult,
                gameObjectFilter
            );
            if (found) {
                [hit, hitObject] = found;
            }

            if (hit) {
                block = this.findBlockForHit(hit);
            }

            if (hitObject) {
                // We hit a game object in this simulation, stop searching through simulations.
                break;
            }
        }

        if (hitObject) {
            return {
                gameObject: hitObject,
                hit: hit,
                block: block,
            };
        } else {
            return {
                gameObject: null,
                hit: null,
                block: block,
            };
        }
    }

    /**
     * Finds the first pointable game object that is included in the given raycast result.
     * @param result
     */
    findFirstGameObject(
        result: Physics.RaycastResult | Physics.IntersectionResult,
        filter?: (obj: GameObject) => boolean
    ): [Intersection, GameObject] {
        for (let hit of result.intersects) {
            let found = this.findGameObjectForHit(hit);
            if (found) {
                if (!filter || filter(found)) {
                    return [hit, found];
                }
            }
        }

        return null;
    }

    findGameObjectForHit(hit: Intersection): GameObject {
        if (!hit) {
            return null;
        }

        if (!isObjectVisible(hit.object)) {
            return null;
        }

        return this.findGameObjectUpHierarchy(hit.object);
    }

    findGameObjectUpHierarchy(object: Object3D): GameObject {
        if (!object) {
            return null;
        }

        if (object instanceof AuxBot3D) {
            return object;
        } else {
            return this.findGameObjectUpHierarchy(object.parent);
        }
    }

    findBlockForHit(hit: Intersection): Block {
        if (!hit) {
            return null;
        }

        if (!isObjectVisible(hit.object)) {
            return null;
        }

        return this.findBlockUpHierarchy(hit.object);
    }

    findBlockUpHierarchy(object: Object3D): Block {
        if (!object) {
            return null;
        }

        if (object instanceof Block && (object as any).isUI === true) {
            return object;
        } else {
            return this.findBlockUpHierarchy(object.parent);
        }
    }

    toggleContextMenu(calc: BotCalculationContext) {
        if (this._contextMenuOpen) {
            this.hideContextMenu();
        } else {
            this.showContextMenu(calc);
        }
    }

    showContextMenu(calc: BotCalculationContext) {
        const input = this._game.getInput();
        const pagePos = input.getMousePagePos();
        const { gameObject, hit } = this.findHoveredGameObject(
            {
                type: 'mouse_or_touch',
                identifier: MOUSE_INPUT_METHOD_IDENTIFIER,
                buttonId: MouseButtonId.Right, // Assume right click for context menu.
            },
            (obj) => obj.pointable
        );
        const actions = this._contextMenuActions(calc, gameObject, hit.point);

        if (actions) {
            this._contextMenuOpen = true;
            this.setCameraControlsEnabled(false);

            // Now send the actual context menu event.
            let menuEvent: ContextMenuEvent = {
                pagePos: pagePos,
                actions: actions,
            };
            this._game.gameView.$emit('onContextMenu', menuEvent);
        }
    }

    hideContextMenu() {
        this._contextMenuOpen = false;
        this._game.gameView.$emit('onContextMenuHide');
    }

    async selectBot(bot: AuxBot3D) {}

    async clearSelection() {}

    protected _handleBotAdded(bot: Bot): void {
        this._markDirty();
    }

    protected _handleBotUpdated(bot: Bot): void {
        this._markDirty();
    }

    protected _handleBotRemoved(bot: Bot): void {
        this._markDirty();
    }

    protected _handleCameraRigTypeChanged(newCameraRig: CameraRig): void {
        const cameraRigControls = this._cameraRigControllers.find(
            (c) => c.rig.name === newCameraRig.name
        );

        if (cameraRigControls) {
            cameraRigControls.rig = newCameraRig;

            const viewport = cameraRigControls.controls.viewport;
            cameraRigControls.controls = new CameraControls(
                newCameraRig.mainCamera,
                this._game,
                viewport
            );

            cameraRigControls.controls.minZoom = Orthographic_MinZoom;
            cameraRigControls.controls.maxZoom = Orthographic_MaxZoom;

            if (
                cameraRigControls.rig.mainCamera instanceof OrthographicCamera
            ) {
                cameraRigControls.controls.screenSpacePanning = true;
            }
        }
    }

    /**
     * Set the enabled state of all camera controls that are managed by this interaction manager.
     * @param enabled
     */
    protected setCameraControlsEnabled(enabled: boolean): void {
        for (let rigControls of this._cameraRigControllers) {
            const sim = this._game.findSimulationForCameraRig(rigControls.rig);
            rigControls.controls.enabled =
                enabled && (!!sim ? sim.cameraControlsMode === 'player' : true);
        }
    }

    protected _markDirty() {
        this._draggableGroupsDirty = true;
    }

    //
    // Abstractions
    //

    abstract createBotDragOperation(
        simulation: Simulation,
        bot: Bot | BotTags,
        dimension: string,
        controller: InputMethod,
        modality: InputModality
    ): IOperation;
    abstract createGameObjectClickOperation(
        gameObject: GameObject,
        hit: Intersection,
        controller: InputMethod,
        modality: InputModality,
        block: Block | null
    ): IOperation;
    abstract createEmptyClickOperation(
        inputMethod: InputMethod,
        modality: InputModality
    ): IOperation;
    abstract createHtmlElementClickOperation(
        element: HTMLElement,
        inputMethod: InputMethod
    ): IOperation;
    abstract handlePointerEnter(
        bot3D: AuxBot3D,
        bot: Bot,
        simulation: Simulation,
        modality: InputModality
    ): void;
    abstract handlePointerExit(
        bot3D: AuxBot3D,
        bot: Bot,
        simulation: Simulation,
        modality: InputModality
    ): void;
    abstract handlePointerDown(
        bot3D: AuxBot3D,
        bot: Bot,
        simulation: Simulation,
        modality: InputModality,
        block: Block | null
    ): void;
    abstract handlePointerUp(
        bot3D: AuxBot3D,
        bot: Bot,
        simulation: Simulation,
        modality: InputModality,
        block: Block | null
    ): void;
    abstract handleFocusEnter(
        bot3D: AuxBot3D,
        bot: Bot,
        simulation: Simulation
    ): void;
    abstract handleFocusExit(
        bot3D: AuxBot3D,
        bot: Bot,
        simulation: Simulation
    ): void;
    abstract handleBlockPointerEnter(
        bot3D: AuxBot3D,
        bot: Bot,
        simulation: Simulation,
        modality: InputModality,
        block: Block
    ): void;
    abstract handleBlockPointerExit(
        bot3D: AuxBot3D,
        bot: Bot,
        simulation: Simulation,
        modality: InputModality,
        block: Block
    ): void;
    abstract getDefaultGrid3D(): Grid3D;

    protected abstract _createControlsForCameraRigs(): CameraRigControls[];
    protected abstract _contextMenuActions(
        calc: BotCalculationContext,
        gameObject: GameObject,
        point: Vector3
    ): ContextMenuAction[];
}
