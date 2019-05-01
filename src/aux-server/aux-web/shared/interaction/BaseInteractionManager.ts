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
import { MouseButtonId, InputType, Input } from '../scene/Input';
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
import InventoryFile from 'aux-web/aux-player/InventoryFile/InventoryFile';

export abstract class BaseInteractionManager {
    protected _gameView: IGameView;
    protected _draggableColliders: Object3D[];
    protected _draggableObjectsDirty: boolean;
    protected _cameraControls: CameraControls;
    protected _tapCodeManager: TapCodeManager;
    protected _maxTapCodeLength: number;
    protected _hoveredObject: File;

    private _operations: IOperation[];

    constructor(gameView: IGameView) {
        this._draggableObjectsDirty = true;
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
        const calc = appManager.simulationManager.primary.helper.createContext();
        // Update active operations and dispose of any that are finished.
        this._operations = this._operations.filter(o => {
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

            // Enable camera controls when there are no more operations.
            if (this._operations.length === 0) {
                this._cameraControls.enabled = true;
            }

            this._cameraControls.update();
            const input = this._gameView.getInput();

            // Detect left click.
            if (input.getMouseButtonDown(MouseButtonId.Left)) {
                if (input.isMouseButtonDownOn(this._gameView.gameView)) {
                    const screenPos = input.getMouseScreenPos();
                    const raycastResult = Physics.raycastAtScreenPos(
                        screenPos,
                        new Raycaster(),
                        this.getDraggableObjects(),
                        this._gameView.getMainCamera()
                    );
                    const hit = Physics.firstRaycastHit(raycastResult);

                    if (hit) {
                        const gameObject = this.findGameObjectObjectForHit(hit);

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
                if (input.isMouseButtonDownOn(this._gameView.gameView)) {
                    // Always allow camera control with middle clicks.
                    this._cameraControls.enabled = true;
                }
            }

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
                appManager.simulationManager.primary.helper.action(
                    'onTapCode',
                    null,
                    code
                );
                this._tapCodeManager.trim(this._maxTapCodeLength - 1);
            }

            if (input.currentInputType === InputType.Mouse) {
                const file = this._findHoveredFile(input);

                if (file !== this._hoveredObject) {
                    if (this._hoveredObject) {
                        this.handlePointerExit(this._hoveredObject);
                    }
                    this._hoveredObject = file;
                    if (this._hoveredObject) {
                        this.handlePointerEnter(this._hoveredObject);
                    }
                }
            }
        }
    }

    protected _findHoveredFile(input: Input): File {
        const screenPos = input.getMouseScreenPos();
        const raycastResult = Physics.raycastAtScreenPos(
            screenPos,
            new Raycaster(),
            this.getDraggableObjects(),
            this._gameView.getMainCamera()
        );
        const hit = Physics.firstRaycastHit(raycastResult);
        const gameObject = hit ? this.findGameObjectObjectForHit(hit) : null;

        if (gameObject instanceof AuxFile3D) {
            return gameObject.file;
        } else {
            return null;
        }
    }

    handlePointerEnter(file: File) {
        appManager.simulationManager.primary.helper.action('onPointerEnter', [
            file,
        ]);
    }

    handlePointerExit(file: File) {
        appManager.simulationManager.primary.helper.action('onPointerExit', [
            file,
        ]);
    }

    showContextMenu(calc: FileCalculationContext) {
        const input = this._gameView.getInput();
        const pagePos = input.getMousePagePos();
        const screenPos = input.getMouseScreenPos();
        const raycastResult = Physics.raycastAtScreenPos(
            screenPos,
            new Raycaster(),
            this.getDraggableObjects(),
            this._gameView.getMainCamera()
        );
        const hit = Physics.firstRaycastHit(raycastResult);

        this._cameraControls.enabled = false;
        const gameObject = this.findGameObjectObjectForHit(hit);
        const actions = this._contextMenuActions(
            calc,
            gameObject,
            hit.point,
            pagePos
        );

        if (actions) {
            // Now send the actual context menu event.
            let menuEvent: ContextMenuEvent = {
                pagePos: pagePos,
                actions: actions,
            };
            this._gameView.$emit('onContextMenu', menuEvent);
        }
    }

    findGameObjectObjectForHit(hit: Intersection): GameObject {
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

    async selectFile(file: AuxFile3D) {
        appManager.simulationManager.primary.filePanel.search = '';
        const shouldMultiSelect = this._gameView
            .getInput()
            .getKeyHeld('Control');
        appManager.simulationManager.primary.recent.addFileDiff(file.file);
        appManager.simulationManager.primary.recent.selectedRecentFile = null;
        await appManager.simulationManager.primary.selection.selectFile(
            <AuxFile>file.file,
            shouldMultiSelect
        );
    }

    async clearSelection() {
        appManager.simulationManager.primary.filePanel.search = '';
        await appManager.simulationManager.primary.selection.clearSelection();
    }

    getDraggableObjects() {
        if (this._draggableObjectsDirty) {
            const contexts = this._gameView.getContexts();
            if (contexts && contexts.length > 0) {
                this._draggableColliders = flatMap(
                    contexts.filter(c => !!c),
                    f => f.colliders
                ).filter(c => this._isVisible(c));
            } else {
                this._draggableColliders = [];
            }
            this._draggableObjectsDirty = false;
        }
        return this._draggableColliders;
    }

    isEmptySpace(screenPos: Vector2): boolean {
        const raycastResult = Physics.raycastAtScreenPos(
            screenPos,
            new Raycaster(),
            this.getDraggableObjects(),
            this._gameView.getMainCamera()
        );
        const clickedObject = Physics.firstRaycastHit(raycastResult);

        return clickedObject === undefined || clickedObject === null;
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

    protected _isVisible(obj: Object3D) {
        if (!obj) {
            return false;
        }
        while (obj) {
            if (!obj.visible) {
                return false;
            }
            obj = obj.parent;
        }
        return true;
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

    protected _handleCameraTypeChanged(
        mainCamera: PerspectiveCamera | OrthographicCamera
    ): void {
        this._cameraControls = new CameraControls(mainCamera, this._gameView);
        this._cameraControls.minZoom = Orthographic_MinZoom;
        this._cameraControls.maxZoom = Orthographic_MaxZoom;
    }

    protected _markDirty() {
        this._draggableObjectsDirty = true;
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

    protected abstract _contextMenuActions(
        calc: FileCalculationContext,
        gameObject: GameObject,
        point: Vector3,
        pagePos: Vector2
    ): ContextMenuAction[];
}
