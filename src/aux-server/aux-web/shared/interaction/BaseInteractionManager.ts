import {
    Vector2,
    Vector3,
    Intersection,
    Raycaster,
    Object3D,
    PerspectiveCamera,
    OrthographicCamera,
} from 'three';
import { ContextMenuEvent, ContextMenuAction } from './ContextMenuEvent';
import {
    Object,
    filtersMatchingArguments,
    AuxFile,
    FileCalculationContext,
    COMBINE_ACTION_NAME,
    getFileConfigContexts,
    File,
} from '@casual-simulation/aux-common';
import { Physics } from '../scene/Physics';
import { flatMap, union, debounce } from 'lodash';
import { CameraControls } from './CameraControls';
import { MouseButtonId, InputType, Input, TargetData } from '../scene/Input';
import { appManager } from '../AppManager';
import { IOperation } from './IOperation';
import { AuxFile3D } from '../scene/AuxFile3D';
import { GameObject } from '../scene/GameObject';
import {
    Orthographic_MinZoom,
    Orthographic_MaxZoom,
    CameraRig,
} from '../scene/CameraRigFactory';
import { TapCodeManager } from './TapCodeManager';
import { Simulation } from '@casual-simulation/aux-vm';
import { Simulation3D } from '../scene/Simulation3D';
import { DraggableGroup } from './DraggableGroup';
import { isObjectVisible } from '../scene/SceneUtils';
import { CameraRigControls } from './CameraRigControls';
import { Game } from '../scene/Game';
import { WebVRDisplays } from '../WebVRDisplays';
import {
    VRController3D,
    VRController_ClickColor,
    VRController_DefaultColor,
} from '../scene/vr/VRController3D';

export abstract class BaseInteractionManager {
    protected _game: Game;
    protected _cameraRigControllers: CameraRigControls[];
    protected _tapCodeManager: TapCodeManager;
    protected _maxTapCodeLength: number;
    protected _hoveredObject: File;
    protected _hoveredSimulation: Simulation;

    protected _draggableGroups: DraggableGroup[];
    protected _draggableGroupsDirty: boolean;

    private _operations: IOperation[];
    private _overHtmlMixerIFrame: boolean;

    constructor(game: Game) {
        this._draggableGroupsDirty = true;
        this._game = game;
        this._cameraRigControllers = this._createControlsForCameraRigs();
        this._operations = [];
        this._tapCodeManager = new TapCodeManager();
        this._maxTapCodeLength = 4;
        this._hoveredObject = null;

        // Bind event handlers to this instance of the class.
        this._handleFileAdded = this._handleFileAdded.bind(this);
        this._handleFileUpdated = this._handleFileUpdated.bind(this);
        this._handleFileRemoved = this._handleFileRemoved.bind(this);
        this._handleCameraRigTypeChanged = this._handleCameraRigTypeChanged.bind(
            this
        );

        // Listen to file events from game view.
        this._game.onFileAdded.addListener(this._handleFileAdded);
        this._game.onFileUpdated.addListener(this._handleFileUpdated);
        this._game.onFileRemoved.addListener(this._handleFileRemoved);
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

    update(): void {
        // const calc = appManager.simulationManager.primary.helper.createContext();
        // Update active operations and dispose of any that are finished.
        this._operations = this._operations.filter(o => {
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

        if (WebVRDisplays.isPresenting()) {
            const inputVR = this._game.getInputVR();

            // VR Mode interaction.
            for (let i = 0; i < inputVR.controllerCount; i++) {
                const controller3D = inputVR.getController3D(i);

                // Change color of controller to indicate that primary button is being pressed.
                if (controller3D.getPrimaryButtonDown()) {
                    controller3D.setColor(VRController_ClickColor);
                } else if (controller3D.getPrimaryButtonUp()) {
                    controller3D.setColor(VRController_DefaultColor);
                }
            }
        } else {
            // Normal browser interaction.

            const input = this._game.getInput();

            // Detect if we are over any html mixer iframe element.
            this._overHtmlMixerIFrame = false;
            const clientPos = input.getMouseClientPos();
            if (clientPos) {
                const htmlMixerContext = this._game.getHtmlMixerContext();
                this._overHtmlMixerIFrame = htmlMixerContext.isOverAnyIFrameElement(
                    clientPos
                );
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

            if (this._operations.length === 0) {
                // Enable camera controls when there are no more operations.
                this.setCameraControlsEnabled(true);
            }

            this._cameraRigControllers.forEach(rigControls =>
                rigControls.controls.update()
            );

            // Detect left click.
            if (input.getMouseButtonDown(MouseButtonId.Left)) {
                if (!this._overHtmlMixerIFrame) {
                    this._disableIFramePointerEvents();
                }

                if (
                    input.isMouseButtonDownOnElement(
                        this._game.gameView.gameView
                    )
                ) {
                    let { gameObject, hit } = this.findHoveredGameObject();

                    if (gameObject) {
                        // Start game object click operation.
                        let gameObjectClickOperation = this.createGameObjectClickOperation(
                            gameObject,
                            hit
                        );
                        if (gameObjectClickOperation !== null) {
                            this.setCameraControlsEnabled(false);
                            this._operations.push(gameObjectClickOperation);
                        }

                        if (gameObject instanceof AuxFile3D) {
                            this.handlePointerDown(
                                gameObject.file,
                                gameObject.contextGroup.simulation3D.simulation
                            );
                        }
                    } else {
                        let emptyClickOperation = this.createEmptyClickOperation();
                        if (emptyClickOperation !== null) {
                            this._operations.push(emptyClickOperation);
                        }
                        this.setCameraControlsEnabled(true);
                    }
                } else if (
                    input.isMouseButtonDownOnAnyElements(
                        this._game.getUIHtmlElements()
                    )
                ) {
                    const element = input.getTargetData().inputDown;

                    let elementClickOperation = this.createHtmlElementClickOperation(
                        element
                    );
                    if (elementClickOperation !== null) {
                        this._operations.push(elementClickOperation);
                    }
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
                    input.isMouseButtonDownOnElement(
                        this._game.gameView.gameView
                    )
                ) {
                    // Always allow camera control with middle clicks.
                    this.setCameraControlsEnabled(true);
                }
            }
            ``;
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
                console.log('[InteractionManager] TapCode: ', code);
                appManager.simulationManager.simulations.forEach(sim => {
                    sim.helper.action('onTapCode', null, code);
                });
                this._tapCodeManager.trim(this._maxTapCodeLength - 1);
            }

            if (input.currentInputType === InputType.Mouse) {
                let { gameObject } = this.findHoveredGameObject();

                let file: File = null;
                let simulation: Simulation = null;

                if (gameObject instanceof AuxFile3D) {
                    file = gameObject.file;
                    simulation =
                        gameObject.contextGroup.simulation3D.simulation;
                }

                const fileId = file ? file.id : null;
                const hoveredId = this._hoveredObject
                    ? this._hoveredObject.id
                    : null;
                if (fileId !== hoveredId) {
                    if (this._hoveredObject) {
                        this.handlePointerExit(
                            this._hoveredObject,
                            this._hoveredSimulation
                        );
                    }
                    this._hoveredObject = file;
                    this._hoveredSimulation = simulation;
                    if (this._hoveredObject) {
                        this.handlePointerEnter(
                            this._hoveredObject,
                            this._hoveredSimulation
                        );
                    }
                }
            }

            this._updateAdditionalNormalInputs(input);
        }
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
        if (this._draggableGroupsDirty) {
            const contexts = flatMap(
                this._game.getSimulations(),
                s => s.contexts
            );
            if (contexts && contexts.length > 0) {
                let colliders = flatMap(
                    contexts.filter(c => !!c),
                    f => f.colliders
                ).filter(c => isObjectVisible(c));

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
     * Find the first game object that is underneath the given page position. If page position is not given, the current 'mouse' page position will be used.
     * @param pagePos [Optional] The page position to test underneath.
     */
    findHoveredGameObject(pagePos?: Vector2) {
        pagePos = !!pagePos ? pagePos : this._game.getInput().getMousePagePos();

        const draggableGroups = this.getDraggableGroups();
        const viewports = this._game.getViewports();

        let hit: Intersection = null;
        let hitObject: GameObject = null;

        // Iterate through draggable groups until we hit and object in one of them.
        for (let i = 0; i < draggableGroups.length; i++) {
            const objects = draggableGroups[i].objects;
            const camera = draggableGroups[i].camera;
            const viewport = draggableGroups[i].viewport;

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
                new Raycaster(),
                objects,
                camera
            );
            hit = Physics.firstRaycastHit(raycastResult);
            hitObject = hit ? this.findGameObjectForHit(hit) : null;

            if (hitObject) {
                // We hit a game object in this simulation, stop searching through simulations.
                break;
            }
        }

        if (hitObject) {
            return {
                gameObject: hitObject,
                hit: hit,
            };
        } else {
            return {
                gameObject: null,
                hit: null,
            };
        }
    }

    findGameObjectForHit(hit: Intersection): GameObject {
        if (!hit) {
            return null;
        }

        return this.findGameObjectUpHierarchy(hit.object);
    }

    findGameObjectUpHierarchy(object: Object3D): GameObject {
        if (!object) {
            return null;
        }

        if (object instanceof AuxFile3D) {
            return object;
        } else {
            return this.findGameObjectUpHierarchy(object.parent);
        }
    }

    showContextMenu(calc: FileCalculationContext) {
        const input = this._game.getInput();
        const pagePos = input.getMousePagePos();
        const { gameObject, hit } = this.findHoveredGameObject();
        const actions = this._contextMenuActions(
            calc,
            gameObject,
            hit.point,
            pagePos
        );

        if (actions) {
            this.setCameraControlsEnabled(false);

            // Now send the actual context menu event.
            let menuEvent: ContextMenuEvent = {
                pagePos: pagePos,
                actions: actions,
            };
            this._game.gameView.$emit('onContextMenu', menuEvent);
        }
    }

    async selectFile(file: AuxFile3D) {
        file.contextGroup.simulation3D.simulation.filePanel.search = '';
        const shouldMultiSelect = this._game.getInput().getKeyHeld('Control');
        file.contextGroup.simulation3D.simulation.recent.addFileDiff(file.file);
        file.contextGroup.simulation3D.simulation.recent.selectedRecentFile = null;
        await file.contextGroup.simulation3D.simulation.selection.selectFile(
            <AuxFile>file.file,
            shouldMultiSelect,
            file.contextGroup.simulation3D.simulation.filePanel
        );
    }

    async clearSelection() {
        appManager.simulationManager.primary.filePanel.search = '';
        await appManager.simulationManager.primary.selection.clearSelection();
    }

    isEmptySpace(screenPos: Vector2): boolean {
        const { gameObject } = this.findHoveredGameObject(screenPos);
        return gameObject == null || gameObject == undefined;
    }

    /**
     * Determines if the two files can be combined and includes the resolved events if so.
     * @param file The first file.
     * @param other The second file.
     */
    canCombineFiles(
        calc: FileCalculationContext,
        file: Object,
        other: Object
    ): boolean {
        // TODO: Make this work even if the file is a "workspace"
        if (
            file &&
            other &&
            getFileConfigContexts(calc, file).length === 0 &&
            getFileConfigContexts(calc, other).length === 0 &&
            file.id !== other.id
        ) {
            const tags = union(
                filtersMatchingArguments(calc, file, COMBINE_ACTION_NAME, [
                    other,
                ]),
                filtersMatchingArguments(calc, other, COMBINE_ACTION_NAME, [
                    file,
                ])
            );
            return tags.length > 0;
        }
        return false;
    }

    protected _handleFileAdded(file: AuxFile): void {
        this._markDirty();
    }

    protected _handleFileUpdated(file: AuxFile): void {
        this._markDirty();
    }

    protected _handleFileRemoved(file: AuxFile): void {
        this._markDirty();
    }

    protected _handleCameraRigTypeChanged(newCameraRig: CameraRig): void {
        const cameraRigControls = this._cameraRigControllers.find(
            c => c.rig.name === newCameraRig.name
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
        this._cameraRigControllers.forEach(
            rigControls => (rigControls.controls.enabled = enabled)
        );
    }

    protected _markDirty() {
        this._draggableGroupsDirty = true;
    }

    //
    // Abstractions
    //

    abstract createGameObjectClickOperation(
        gameObject: GameObject,
        hit: Intersection
    ): IOperation;
    abstract createEmptyClickOperation(): IOperation;
    abstract createHtmlElementClickOperation(element: HTMLElement): IOperation;
    abstract handlePointerEnter(file: File, simulation: Simulation): IOperation;
    abstract handlePointerExit(file: File, simulation: Simulation): IOperation;
    abstract handlePointerDown(file: File, simulation: Simulation): IOperation;

    protected abstract _createControlsForCameraRigs(): CameraRigControls[];
    protected abstract _contextMenuActions(
        calc: FileCalculationContext,
        gameObject: GameObject,
        point: Vector3,
        pagePos: Vector2
    ): ContextMenuAction[];
}
