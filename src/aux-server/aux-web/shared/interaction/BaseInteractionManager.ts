import { Vector2, Vector3, Intersection, Raycaster, Object3D, PerspectiveCamera, OrthographicCamera } from 'three';
import { ContextMenuEvent, ContextMenuAction } from './ContextMenuEvent';
import { 
    Object,
    filtersMatchingArguments,
    AuxFile,
    FileCalculationContext,
    COMBINE_ACTION_NAME,
    getFileConfigContexts,
} from '@casual-simulation/aux-common';
import { Physics } from '../scene/Physics';
import { flatMap, union } from 'lodash';
import { CameraControls } from './CameraControls';
import { MouseButtonId } from '../scene/Input';
import { appManager } from '../AppManager';
import { IOperation } from './IOperation';
import { AuxFile3D } from '../scene/AuxFile3D';
import { IGameView } from '../IGameView';
import { GameObject } from '../scene/GameObject';
import { Orthographic_MinZoom, Orthographic_MaxZoom } from '../scene/CameraRigFactory';

export abstract class BaseInteractionManager {

    protected _gameView: IGameView;
    protected _draggableColliders: Object3D[];
    protected _draggableObjectsDirty: boolean;
    protected _cameraControls: CameraControls;

    private _operations: IOperation[];

    constructor(gameView: IGameView) {
        this._draggableObjectsDirty = true;
        this._gameView = gameView;
        this._cameraControls = new CameraControls(this._gameView.getMainCamera(), this._gameView);
        this._cameraControls.minZoom = Orthographic_MinZoom;
        this._cameraControls.maxZoom = Orthographic_MaxZoom;
        this._operations = [];

        // Bind event handlers to this instance of the class.
        this._handleFileAdded = this._handleFileAdded.bind(this);
        this._handleFileUpdated = this._handleFileUpdated.bind(this);
        this._handleFileRemoved = this._handleFileRemoved.bind(this);
        this._handleCameraTypeChanged = this._handleCameraTypeChanged.bind(this);

        // Listen to file events from game view.
        this._gameView.onFileAdded.addListener(this._handleFileAdded);
        this._gameView.onFileUpdated.addListener(this._handleFileUpdated);
        this._gameView.onFileRemoved.addListener(this._handleFileRemoved);
        this._gameView.onCameraTypeChanged.addListener(this._handleCameraTypeChanged);
    }

    update(): void {

        const calc = appManager.fileManager.createContext();
        // Update active operations and dispose of any that are finished.
        this._operations = this._operations.filter((o) => {
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
                    console.log('[InteractionManager] VR button ' + i + ' down. frame: ' + this._gameView.getTime().frameCount);
                }

                if (inputVR.getButtonHeld(0, i)) {
                    console.log('[InteractionManager] VR button ' + i + ' held. frame: ' + this._gameView.getTime().frameCount);
                }

                if (inputVR.getButtonUp(0, i)) {
                    console.log('[InteractionManager] VR button ' + i + ' up. frame: ' + this._gameView.getTime().frameCount);
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

                if (input.isMouseButtonDownOn(this._gameView.gameView)){
                    const screenPos = input.getMouseScreenPos();
                    const raycastResult = Physics.raycastAtScreenPos(screenPos, new Raycaster(), this.getDraggableObjects(), this._gameView.getMainCamera());
                    const hit = Physics.firstRaycastHit(raycastResult);

                    if (hit) {
                        const gameObject = this.findGameObjectObjectForHit(hit);

                        if (gameObject) {
                            // Start game object click operation.
                            let gameObjectClickOperation = this.createGameObjectClickOperation(gameObject, hit);
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
                } else if(input.isMouseButtonDownOnAny(this._gameView.getUIHtmlElements())) {

                    const element = input.getTargetData().inputDown;
                    
                    let elementClickOperation = this.createHtmlElementClickOperation(element);
                    if (elementClickOperation !== null) {
                        this._operations.push(elementClickOperation);
                    }
                }
            }

            // Middle click or Right click.
            if (input.getMouseButtonDown(MouseButtonId.Middle) || input.getMouseButtonDown(MouseButtonId.Right)) {

                if (input.isMouseButtonDownOn(this._gameView.gameView)) {
                    // Always allow camera control with middle clicks.
                    this._cameraControls.enabled = true;
                }
            }
        }
    }

    showContextMenu(calc: FileCalculationContext) {
        const input = this._gameView.getInput();
        const pagePos = input.getMousePagePos();
        const screenPos = input.getMouseScreenPos();
        const raycastResult = Physics.raycastAtScreenPos(screenPos, new Raycaster(), this.getDraggableObjects(), this._gameView.getMainCamera());
        const hit = Physics.firstRaycastHit(raycastResult);

        this._cameraControls.enabled = false;
        const gameObject = this.findGameObjectObjectForHit(hit);
        const actions = this._contextMenuActions(calc, gameObject, hit.point, pagePos);

        if (actions) {
            // Now send the actual context menu event.
            let menuEvent: ContextMenuEvent = { pagePos: pagePos, actions: actions };
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
        const shouldMultiSelect = this._gameView.getInput().getKeyHeld('Control');
        appManager.fileManager.recent.addFileDiff(file.file);
        appManager.fileManager.recent.selectedRecentFile = null;
        await appManager.fileManager.selection.selectFile(<AuxFile>file.file, shouldMultiSelect);
    }

    async clearSelection() {
        await appManager.fileManager.selection.clearSelection();
    }

    getDraggableObjects() {
        if (this._draggableObjectsDirty) {
            const contexts = this._gameView.getContexts();
            if (contexts && contexts.length > 0) {
                this._draggableColliders = flatMap(contexts.filter((c) => !!c), f => f.colliders).filter(c => this._isVisible(c));
            } else {
                this._draggableColliders = [];
            }
            this._draggableObjectsDirty = false;
        }
        return this._draggableColliders;
    }

    isEmptySpace(screenPos: Vector2): boolean {
        const raycastResult = Physics.raycastAtScreenPos(screenPos, new Raycaster(), this.getDraggableObjects(), this._gameView.getMainCamera());
        const clickedObject = Physics.firstRaycastHit(raycastResult);

        return clickedObject === undefined || clickedObject === null;
    }

    /**
     * Determines if the two files can be combined and includes the resolved events if so.
     * @param file The first file.
     * @param other The second file.
     */
    canCombineFiles(calc: FileCalculationContext, file: Object, other: Object): boolean {
        // TODO: Make this work even if the file is a "workspace"
        if (file && other && getFileConfigContexts(calc, file).length === 0 && getFileConfigContexts(calc, other).length === 0 && file.id !== other.id) {
            const tags = union(filtersMatchingArguments(calc, file, COMBINE_ACTION_NAME, [other]), filtersMatchingArguments(calc, other, COMBINE_ACTION_NAME, [file]));
            return tags.length > 0;
        }
        return false;
    }

    protected _isVisible(obj: Object3D) {
        if (!obj) {
            return false;
        }
        while(obj) {
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

    protected _handleCameraTypeChanged(mainCamera: PerspectiveCamera | OrthographicCamera): void {
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

    abstract createGameObjectClickOperation(gameObject: GameObject, hit: Intersection): IOperation;
    abstract createEmptyClickOperation(): IOperation;
    abstract createHtmlElementClickOperation(element: HTMLElement): IOperation;
    
    protected abstract _contextMenuActions(calc: FileCalculationContext, gameObject: GameObject, point: Vector3, pagePos: Vector2): ContextMenuAction[];
}
