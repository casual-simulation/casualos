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
import { IGameView } from '../IGameView';
import { GameObject } from '../scene/GameObject';
import {
    Orthographic_MinZoom,
    Orthographic_MaxZoom,
} from '../scene/CameraRigFactory';
import { TapCodeManager } from './TapCodeManager';
import { Simulation } from '../Simulation';
import { Simulation3D } from '../scene/Simulation3D';
import { DraggableGroup } from './DraggableGroup';
import { isObjectVisible } from '../scene/SceneUtils';

export abstract class BaseInteractionManager {
    protected _gameView: IGameView;
    protected _cameraControls: CameraControls;
    protected _tapCodeManager: TapCodeManager;
    protected _maxTapCodeLength: number;
    protected _hoveredObject: File;
    protected _hoveredSimulation: Simulation;

    protected _draggableGroups: DraggableGroup[];
    protected _draggableGroupsDirty: boolean;

    private _operations: IOperation[];
    private _overHtmlMixerIFrame: boolean;

    constructor(gameView: IGameView) {
        this._draggableGroupsDirty = true;
        this._gameView = gameView;
        this._cameraControls = new CameraControls(
            this._gameView.getMainCamera(),
            this._gameView
        );
        this._cameraControls.minZoom = Orthographic_MinZoom;
        this._cameraControls.maxZoom = Orthographic_MaxZoom;
        this._operations = [];
        this._tapCodeManager = new TapCodeManager();
        this._maxTapCodeLength = 4;
        this._hoveredObject = null;

        // Bind event handlers to this instance of the class.
        this._handleFileAdded = this._handleFileAdded.bind(this);
        this._handleFileUpdated = this._handleFileUpdated.bind(this);
        this._handleFileRemoved = this._handleFileRemoved.bind(this);
        this._handleCameraTypeChanged = this._handleCameraTypeChanged.bind(
            this
        );

        // Listen to file events from game view.
        this._gameView.onFileAdded.addListener(this._handleFileAdded);
        this._gameView.onFileUpdated.addListener(this._handleFileUpdated);
        this._gameView.onFileRemoved.addListener(this._handleFileRemoved);
        this._gameView.onCameraTypeChanged.addListener(
            this._handleCameraTypeChanged
        );
    }

    /**
     * Gets the camera controls.
     */
    get cameraControls() {
        return this._cameraControls;
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
            this._cameraControls.enabled = false;
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

        if (this._gameView.vrDisplay && this._gameView.vrDisplay.isPresenting) {
            const inputVR = this._gameView.getInputVR();

            // VR Mode interaction.
            for (let i = 0; i < 5; i++) {
                if (inputVR.getButtonDown(0, i)) {
                    console.log(
                        '[InteractionManager] VR button ' +
                            i +
                            ' down. frame: ' +
                            this._gameView.getTime().frameCount
                    );
                }

                if (inputVR.getButtonHeld(0, i)) {
                    console.log(
                        '[InteractionManager] VR button ' +
                            i +
                            ' held. frame: ' +
                            this._gameView.getTime().frameCount
                    );
                }

                if (inputVR.getButtonUp(0, i)) {
                    console.log(
                        '[InteractionManager] VR button ' +
                            i +
                            ' up. frame: ' +
                            this._gameView.getTime().frameCount
                    );
                }
            }
        } else {
            // Normal browser interaction.

            const input = this._gameView.getInput();

            // Detect if we are over any html mixer iframe element.
            this._overHtmlMixerIFrame = false;
            const clientPos = input.getMouseClientPos();
            if (clientPos) {
                const htmlMixerContext = this._gameView.getHtmlMixerContext();
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
                const webglCanvas = this._gameView.getRenderer().domElement;
                webglCanvas.style.pointerEvents = 'none';
            }

            if (this._operations.length === 0) {
                // Enable camera controls when there are no more operations.
                this._cameraControls.enabled = true;
            }

            this._cameraControls.update();

            // Detect left click.
            if (input.getMouseButtonDown(MouseButtonId.Left)) {
                if (!this._overHtmlMixerIFrame) {
                    this._disableIFramePointerEvents();
                }

                if (input.isMouseButtonDownOn(this._gameView.gameView)) {
                    let { gameObject, hit } = this.findHoveredGameObject();

                    if (gameObject) {
                        // Start game object click operation.
                        let gameObjectClickOperation = this.createGameObjectClickOperation(
                            gameObject,
                            hit
                        );
                        if (gameObjectClickOperation !== null) {
                            this._cameraControls.enabled = false;
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
                        this._cameraControls.enabled = true;
                    }
                } else if (
                    input.isMouseButtonDownOnAny(
                        this._gameView.getUIHtmlElements()
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

                if (input.isMouseButtonDownOn(this._gameView.gameView)) {
                    // Always allow camera control with middle clicks.
                    this._cameraControls.enabled = true;
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

                if (gameObject instanceof AuxFile3D) {
                    const file = gameObject.file;
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
                        this._hoveredSimulation =
                            gameObject.contextGroup.simulation3D.simulation;
                        if (this._hoveredObject) {
                            this.handlePointerEnter(
                                this._hoveredObject,
                                this._hoveredSimulation
                            );
                        }
                    }
                }
            }
        }
    }

    protected _disableIFramePointerEvents(): void {
        // Dont allow iframes to capture input.
        const webglCanvas = this._gameView.getRenderer().domElement;
        webglCanvas.style.pointerEvents = 'auto';
    }

    /**
     * Gets groups of draggables for input testing.
     */
    getDraggableGroups(): DraggableGroup[] {
        if (this._draggableGroupsDirty) {
            const contexts = flatMap(
                this._gameView.getSimulations(),
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
                        camera: this._gameView.getMainCamera(),
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
        pagePos = !!pagePos
            ? pagePos
            : this._gameView.getInput().getMousePagePos();

        const draggableGroups = this.getDraggableGroups();

        let hit: Intersection = null;
        let hitObject: GameObject = null;

        // Iterate through draggable groups until we hit and object in one of them.
        for (let i = 0; i < draggableGroups.length; i++) {
            const objects = draggableGroups[i].objects;
            const camera = draggableGroups[i].camera;
            const viewport = draggableGroups[i].viewport;

            let screenPos: Vector2;
            if (viewport) {
                screenPos = Input.screenPositionForViewport(
                    pagePos,
                    this._gameView.gameView,
                    viewport
                );
            } else {
                screenPos = Input.screenPosition(
                    pagePos,
                    this._gameView.gameView
                );
            }

            const raycastResult = Physics.raycastAtScreenPos(
                screenPos,
                new Raycaster(),
                objects,
                camera
            );
            hit = Physics.firstRaycastHit(raycastResult);
            hitObject = hit ? this.findGameObjectForHit(hit) : null;

            if (hitObject) {
                // We hit a game object in this simulation, stop searching through simulations.\
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
        const input = this._gameView.getInput();
        const pagePos = input.getMousePagePos();
        const { gameObject, hit } = this.findHoveredGameObject();
        const actions = this._contextMenuActions(
            calc,
            gameObject,
            hit.point,
            pagePos
        );

        if (actions) {
            this._cameraControls.enabled = false;

            // Now send the actual context menu event.
            let menuEvent: ContextMenuEvent = {
                pagePos: pagePos,
                actions: actions,
            };
            this._gameView.$emit('onContextMenu', menuEvent);
        }
    }

    async selectFile(file: AuxFile3D) {
        file.contextGroup.simulation3D.simulation.filePanel.search = '';
        const shouldMultiSelect = this._gameView
            .getInput()
            .getKeyHeld('Control');
        file.contextGroup.simulation3D.simulation.recent.addFileDiff(file.file);
        file.contextGroup.simulation3D.simulation.recent.selectedRecentFile = null;
        await file.contextGroup.simulation3D.simulation.selection.selectFile(
            <AuxFile>file.file,
            shouldMultiSelect
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

    protected _markDirty() {
        this._draggableGroupsDirty = true;
    }

    protected _handleCameraTypeChanged(
        mainCamera: PerspectiveCamera | OrthographicCamera
    ): void {
        this._cameraControls = new CameraControls(mainCamera, this._gameView);
        this._cameraControls.minZoom = Orthographic_MinZoom;
        this._cameraControls.maxZoom = Orthographic_MaxZoom;
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

    protected abstract _contextMenuActions(
        calc: FileCalculationContext,
        gameObject: GameObject,
        point: Vector3,
        pagePos: Vector2
    ): ContextMenuAction[];
}
