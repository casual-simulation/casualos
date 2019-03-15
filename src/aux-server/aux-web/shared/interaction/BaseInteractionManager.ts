import { Vector2, Vector3, Intersection, Raycaster, Object3D, Ray } from 'three';
import { ContextMenuEvent, ContextMenuAction } from './ContextMenuEvent';
import { 
    File, 
    Object,
    tagsMatchingFilter,
    isMinimized,
    AuxFile,
    objectsAtContextGridPosition,
    getFileIndex,
    FileCalculationContext,
    getContextMinimized,
    getContextGrid,
    getContextSize,
    getContextScale,
    isFileStackable,
    getContextDefaultHeight,
    getContextColor
} from '@yeti-cgi/aux-common';
import { Physics } from '../scene/Physics';
import { flatMap, minBy, keys, maxBy, union, differenceBy } from 'lodash';
import { CameraControls } from './CameraControls';
import { Axial, realPosToGridPos, gridDistance, keyToPos, posToKey } from '../scene/hex';
import { MouseButtonId, Input } from '../scene/Input';
import { EventBus } from '../EventBus';
import { appManager } from '../AppManager';
import { IOperation } from './IOperation';
import { AuxFile3D } from '../scene/AuxFile3D';
import { ContextGroup3D } from '../scene/ContextGroup3D';
import { IGameView } from '../IGameView';

export abstract class BaseInteractionManager {

    protected _gameView: IGameView;
    protected _raycaster: Raycaster;
    protected _draggableColliders: Object3D[];
    protected _draggableObjectsDirty: boolean;
    protected _cameraControls: CameraControls;

    private _operations: IOperation[];

    constructor(gameView: IGameView) {
        this._draggableObjectsDirty = true;
        this._gameView = gameView;
        this._raycaster = new Raycaster();
        this._cameraControls = new CameraControls(this._gameView.mainCamera, this._gameView);
        this._operations = [];

        // Bind event handlers to this instance of the class.
        this._handleFileAdded = this._handleFileAdded.bind(this);
        this._handleFileUpdated = this._handleFileUpdated.bind(this);
        this._handleFileRemoved = this._handleFileRemoved.bind(this);

        // Listen to file events from game view.
        this._gameView.onFileAdded.addListener(this._handleFileAdded);
        this._gameView.onFileUpdated.addListener(this._handleFileUpdated);
        this._gameView.onFileRemoved.addListener(this._handleFileRemoved);
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
            
            const inputVR = this._gameView.inputVR;

            // VR Mode interaction.
            for (let i = 0; i < 5; i++) {
                if (inputVR.getButtonDown(0, i)) {
                    console.log('[InteractionManager] VR button ' + i + ' down. frame: ' + this._gameView.time.frameCount);
                }

                if (inputVR.getButtonHeld(0, i)) {
                    console.log('[InteractionManager] VR button ' + i + ' held. frame: ' + this._gameView.time.frameCount);
                }

                if (inputVR.getButtonUp(0, i)) {
                    console.log('[InteractionManager] VR button ' + i + ' up. frame: ' + this._gameView.time.frameCount);
                }
            }

        } else {

            // Normal browser interaction.

            // Enable camera controls when there are no more operations.
            if (this._operations.length === 0) {
                this._cameraControls.enabled = true;
            }
            
            this._cameraControls.update();
            const input = this._gameView.input;

            // Detect left click.
            if (input.getMouseButtonDown(MouseButtonId.Left)) {

                if (input.isMouseButtonDownOn(this._gameView.gameView)){
                    const screenPos = input.getMouseScreenPos();
                    const raycastResult = Physics.raycastAtScreenPos(screenPos, this._raycaster, this.getDraggableObjects(), this._gameView.mainCamera);
                    const clickedObject = Physics.firstRaycastHit(raycastResult);

                    if (clickedObject) {
                        const file = this.findObjectForIntersection(clickedObject);

                        if (file) {
                            // Start file click operation on file.
                            let fileClickOperation = this.createFileClickOperation(file, clickedObject);
                            if (fileClickOperation !== null) {
                                this._cameraControls.enabled = false;
                                this._operations.push(fileClickOperation);
                            }
                        }
                    } else {
                        let emptyClickOperation = this.createEmptyClickOperation();
                        if (emptyClickOperation !== null) {
                            this._operations.push(emptyClickOperation);
                        }
                        this._cameraControls.enabled = true;
                    }
                } else if(input.isMouseButtonDownOnAny(this._gameView.uiHtmlElements)) {

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
        const input = this._gameView.input;
        const pagePos = input.getMousePagePos();
        const screenPos = input.getMouseScreenPos();
        const raycastResult = Physics.raycastAtScreenPos(screenPos, this._raycaster, this.getDraggableObjects(), this._gameView.mainCamera);
        const hit = Physics.firstRaycastHit(raycastResult);

        this._cameraControls.enabled = false;
        const file = this.findObjectForIntersection(hit);
        const actions = this._contextMenuActions(calc, file, hit.point, pagePos);

        if (actions) {
            // Now send the actual context menu event.
            let menuEvent: ContextMenuEvent = { pagePos: pagePos, actions: actions };
            this._gameView.$emit('onContextMenu', menuEvent);
        }
    }

    findObjectForIntersection(obj: Intersection): AuxFile3D | null {
        if (!obj) {
            return null;
        }
        
        return this.findObjectForMesh(obj.object);
    }

    findObjectForMesh(mesh: Object3D): AuxFile3D | null {
        if (!mesh) {
            return null;
        }

        if (mesh instanceof AuxFile3D) {
            return mesh;
        } else {
            return this.findObjectForMesh(mesh.parent);
        }
    }

    selectFile(file: AuxFile3D) {
        appManager.fileManager.selectFile(<AuxFile>file.file);
    }

    getDraggableObjects() {
        if (this._draggableObjectsDirty) {
            this._draggableColliders = flatMap(this._gameView.getContexts(), f => f.colliders).filter(c => this._isVisible(c));
            this._draggableObjectsDirty = false;
        }
        return this._draggableColliders;
    }

    isEmptySpace(screenPos: Vector2): boolean {
        const raycastResult = Physics.raycastAtScreenPos(screenPos, new Raycaster(), this.getDraggableObjects(), this._gameView.mainCamera);
        const clickedObject = Physics.firstRaycastHit(raycastResult);

        return clickedObject === undefined || clickedObject === null;
    }

    /**
     * Determines if the two files can be combined and includes the resolved events if so.
     * @param file The first file.
     * @param other The second file.
     */
    canCombineFiles(file: Object, other: Object): boolean {
        // TODO: Make this work even if the file is a "workspace"
        if (file && other && !file.tags['aux.builder.context'] && !other.tags['aux.builder.context'] && file.id !== other.id) {
            const context = appManager.fileManager.createContext();
            const tags = union(tagsMatchingFilter(file, other, '+', context), tagsMatchingFilter(other, file, '+', context));
            return tags.length > 0;
        }
        return false;
    }

    protected _isVisible(obj: Object3D) {
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

    protected _markDirty() {
        this._draggableObjectsDirty = true;
    }



    //
    // Abstractions
    //

    abstract createFileClickOperation(file: AuxFile3D, hit: Intersection): IOperation;
    abstract createEmptyClickOperation(): IOperation;
    abstract createHtmlElementClickOperation(element: HTMLElement): IOperation;
    
    protected abstract _contextMenuActions(calc: FileCalculationContext, file: AuxFile3D | ContextGroup3D, point: Vector3, pagePos: Vector2): ContextMenuAction[];
}
