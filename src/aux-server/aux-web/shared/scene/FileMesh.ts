import {
    Object3D,
    Mesh, 
    BoxBufferGeometry,
    MeshStandardMaterial,
    Color,
    Vector3,
    Box3,
    Sphere,
    BufferGeometry,
    BufferAttribute,
    LineBasicMaterial,
    LineSegments
} from "three";
import { 
    Object,
    File,
    DEFAULT_WORKSPACE_SCALE,
    DEFAULT_WORKSPACE_GRID_SCALE,
    isArray,
    parseArray,
    isFormula,
    fileFromShortId,
    objectsAtWorkspaceGridPosition,
    FileCalculationContext,
    calculateFileValue,
    calculateNumericalTagValue
} from '@yeti-cgi/aux-common/Files';
import { ArgEvent } from '@yeti-cgi/aux-common/Events';
import { GameObject } from "./GameObject";
import { IGameView } from '../IGameView';
import { calculateGridTileLocalCenter } from "./grid/Grid";
import { Text3D } from "./Text3D";
import { File3D } from "./File3D";
import { Arrow3D } from "./Arrow3D";
import { find, flatMap, sumBy, sortBy } from "lodash";
import { appManager } from '../AppManager';
import { createLabel, convertToBox2, setLayer } from "./SceneUtils";
import { WorkspaceMesh } from "./WorkspaceMesh";
import { WordBubble3D } from "./WordBubble3D";
import { LayersHelper } from "./LayersHelper";
import { AppType } from "../AppManager";
import GameView from "../../aux-player/GameView/GameView";

/**
 * Defines a class that represents a mesh for an "object" file.
 */
export class FileMesh extends GameObject {

    private _gameView: IGameView | null;
    private _context: FileCalculationContext;

    /**
     * The data for the mesh.
     */
    file: Object;

    /**
     * The cube that acts as the visual representation of the file.
     */
    cube: Mesh;

    /**
     * The container for the cube.
     */
    cubeContainer: Object3D;

    /**
     * The world bubble for the cube.
     */
    wordBubble: WordBubble3D;
    
    /**
     * The optional label for the file.
     */
    label: Text3D | null;

    /**
     * The optional arrows for the file.
     */
    arrows: Arrow3D[];

    /**
     * The optional stroke outline for the file.
     */
    stroke: LineSegments;

    /**
     * Whether the file should be visible if it doesn't have a workspace.
     */
    allowNoWorkspace: boolean = false;

    /**
     * Event that is fired when this file mesh is updated.
     */
    public onUpdated: ArgEvent<FileMesh> = new ArgEvent<FileMesh>();

    constructor(gameView?: IGameView) {
        super();
        this._gameView = gameView;
        this.allowNoWorkspace = false;

        if (appManager.appType === AppType.Player) {
            // AUX Player does not use workspaces. FileMesh needs to operate without one.
            this.allowNoWorkspace = true;
        }
    }

    get boundingBox(): Box3 {
        return new Box3().setFromObject(this.cube);
    }

    get boundingSphere(): Sphere {
        let box = new Box3().setFromObject(this.cube);
        let sphere = new Sphere();
        sphere = box.getBoundingSphere(sphere);

        return sphere;
    }

    /**
     * Sets whether the debug information for the file should be shown.
     * @param debug Whether to show debug information.
     */
    showDebugInfo(debug: boolean) {
    }

    /**
     * Updates the mesh to correctly visualize the given file.
     * @param file The file. If not provided the mesh will re-update to match its existing data.
     * @param force Whether to force the mesh to update everything, not just the parts that have changed.
     */
    update(file?: File, force?: boolean) {
        if (!file) {
            return;
        }
        if (!this.file) {
            this.cubeContainer = new Object3D();
            this.cube = this._createCube(1);
            this.colliders.push(this.cube);
            this.cubeContainer.add(this.cube);
            this.add(this.cubeContainer);

            if (this._gameView) {
                this.label = createLabel(this._gameView, this);
                this.label.setLayer(LayersHelper.Layer_UIWorld);
            }

            this.wordBubble = new WordBubble3D({cornerRadius: 0});
            setLayer(this.wordBubble, LayersHelper.Layer_UIWorld, true);
            this.add(this.wordBubble);
        }
        this.file = (<Object>file) || this.file;

        this._context = appManager.fileManager.createContext();

        // visible if not destroyed, has a position, and not hidden
        this.visible = (!this.file.tags._destroyed && !!this.file.tags._position && !this.file.tags._hidden);

        // Tag: _position && scale
        this._tagUpdatePosition();

        // Tag: color
        this._tagUpdateColor();

        // Tag: label
        this._tagUpdateLabel();

        // Tag: stroke
        this._tagUpdateStroke();

        this.onUpdated.invoke(this);
    }

    public frameUpdate() {
        super.frameUpdate();

        if (this.label && this._gameView) {
            // update label scale

            let labelMode = this.file.tags['label.size.mode'];
            if (labelMode) {
                this._updateLabelSize();
                this.label.setPositionForObject(this.cube);
                this._updateWorldBubble();
            }
        }

        // Tag: line
        this._tagUpdateLine();
    }

    public dispose() {
        super.dispose();

        if (this.arrows) {
            this.arrows.forEach((a) => {
                a.dispose();
            })
        }
    }

    private _calculateScale(workspace: File3D): number {
        if(workspace) {
            const scale = workspace.file.tags.scale || DEFAULT_WORKSPACE_SCALE;
            const gridScale = workspace.file.tags.gridScale || DEFAULT_WORKSPACE_GRID_SCALE;
            return scale * gridScale;
        } else {
            return DEFAULT_WORKSPACE_SCALE * DEFAULT_WORKSPACE_GRID_SCALE;
        }
    }

    private _getColor(color: string): Color {
        return new Color(color);
    }

    private _createCube(size: number): Mesh {
        let geometry = new BoxBufferGeometry(size, size, size);
        let material = new MeshStandardMaterial({
            color: 0x00ff00,
            metalness: .1,
            roughness: 0.6
        });
        const cube = new Mesh(geometry, material);
        cube.castShadow = true;
        cube.receiveShadow = false;
        return cube;
    }

    private _tagUpdatePosition(): void {
        
        if (appManager.appType === AppType.Builder) {

            const workspace = this._gameView ? this._gameView.getFile(this.file.tags._workspace) : null;
            const scale = this._calculateScale(workspace);
            const cubeScale = calculateScale(this._context, this.file, scale);
            if (workspace) {
                (<WorkspaceMesh>workspace.mesh).container.add(this);
                this.cubeContainer.scale.set(cubeScale.x, cubeScale.y, cubeScale.z);
                this.cubeContainer.position.set(0, cubeScale.y / 2, 0);
            } else {
                if (!this.allowNoWorkspace) {
                    console.log('[FileMesh] File should be deleted', this.file.id, this.file.tags._workspace);
                }
                this.visible = this.allowNoWorkspace;
                this.parent = null;
                this.cubeContainer.scale.set(cubeScale.x, cubeScale.y, cubeScale.z);
                this.cubeContainer.position.set(0, 0, 0);
            }
    
            if (this.file.tags._position && workspace) {
                const localPosition = calculateObjectPositionOnWorkspace(this._context, this.file, scale );
                this.position.set(localPosition.x, localPosition.y, localPosition.z);
            } else {
                // Default position
                this.position.set(0, 0, 0);
            }
    
            // We must call this function so that child objects get their positions updated too.
            // Three render function does this automatically but there are functions in here that depend
            // on accurate positioning of child objects.
            this.updateMatrixWorld(true);

        } else if (appManager.appType === AppType.Player) {
            const cubeScale = calculateScale(this._context, this.file, 1.0);
            this.cubeContainer.scale.set(cubeScale.x, cubeScale.y, cubeScale.z);
            this.cubeContainer.position.set(0, cubeScale.y / 2, 0);

            const userContext = (<GameView>this._gameView).userContext;
            const localPosition = calculateObjectPositionInContext(this._context, this.file, userContext);
            this.position.set(localPosition.x, localPosition.y, localPosition.z);

            // We must call this function so that child objects get their positions updated too.
            // Three render function does this automatically but there are functions in here that depend
            // on accurate positioning of child objects.
            this.updateMatrixWorld(true);
        }
    }

    private _tagUpdateColor(): void {
        if (this.file.tags.color) {
            const material = <MeshStandardMaterial>this.cube.material;
            material.color = this._getColor(this.file.tags.color);
        } else {
            const material = <MeshStandardMaterial>this.cube.material;
            material.color = new Color(0xFFFFFF);
        }
    }

    private _tagUpdateLabel(): void {
        if (!this.label) {
            return;
        }

        let label = this.file.tags.label;

        if (label) {

            if (isFormula(label)) {
                let calculatedValue = appManager.fileManager.calculateFormattedFileValue(this.file, 'label');
                this.label.setText(calculatedValue);
            } else {
                this.label.setText(label);
            }
            
            this._updateLabelSize();
            this.label.setPositionForObject(this.cube);
            this._updateWorldBubble();

            let labelColor = this.file.tags['label.color'];
            if (labelColor) {

                if (isFormula(labelColor)) {
                    let calculatedValue = appManager.fileManager.calculateFormattedFileValue(this.file, 'label.color');
                    this.label.setColor(this._getColor(calculatedValue));
                } else {
                    this.label.setColor(this._getColor(labelColor));
                }
            }

        } else {
            this.label.setText("");
        }
    }

    private _updateLabelSize() {
        let labelSize = calculateNumericalTagValue(this._context, this.file, 'label.size', 1) * Text3D.defaultScale;
        if (this.file.tags['label.size.mode']) {
            let mode = appManager.fileManager.calculateFileValue(this.file, 'label.size.mode');
            if (mode === 'auto') {
                const distanceToCamera = this._gameView.mainCamera.position.distanceTo(this.label.getWorldPosition());
                const extraScale = distanceToCamera / Text3D.virtualDistance;
                const finalScale = labelSize * extraScale;
                this.label.setScale(finalScale);
                return;
            }
        }
        this.label.setScale(labelSize);
    }

    private _tagUpdateLine(): void {

        if(!this._gameView) {
            return;
        }

        // Only draw lines in the Builder client.
        if (appManager.appType !== AppType.Builder) {
            return;
        }

        let lineTo = this.file.tags['line.to'];
        let validLineIds: string[];

        if (lineTo) {

            let files: Object[];
            validLineIds = [];

            // Local function for setting up a line. Will add the targetFileId to the validLineIds array if successful.
            let trySetupLine = (targetFileId: string, color?: Color): void => {
                
                // Undefined target filed id.
                if (!targetFileId) return;
                // Can't create line to self.
                if (this.file.id === targetFileId) return;
                
                let targetFile = this._gameView.getFile(targetFileId);
                if (!targetFile) {

                    // If not matching file is found on first try then it may be a short id.
                    // Lets try searching for it.

                    if (!files) {
                        // Init the searchable files list from file manager.
                        files = appManager.fileManager.objects;
                    }

                    let file = fileFromShortId(files, targetFileId);
                    if (file) {
                        // Found file with short id.
                        targetFile = this._gameView.getFile(file.id);
                    } else {
                        // Not file found for short id.
                        return;
                    }

                }

                // Initialize arrows array if needed.
                if (!this.arrows) this.arrows = [];

                let targetArrow: Arrow3D = find(this.arrows, (a: Arrow3D) => { return a.targetFile3d === targetFile });
                if (!targetArrow) {
                    // Create arrow for target.
                    let sourceFile = this._gameView.getFile(this.file.id);
                    targetArrow = new Arrow3D(this._gameView, sourceFile, targetFile);
                    this.arrows.push(targetArrow);
                }

                if (targetArrow) {
                    targetArrow.setColor(color);
                    targetArrow.update();
                    // Add the target file id to the valid ids list.
                    validLineIds.push(targetFile.file.id);
                }
            }

            let lineColorTagValue = this.file.tags['line.color'];
            let lineColor: Color;

            if (lineColorTagValue) {
                if (isFormula(lineColorTagValue)) {
                    let calculatedValue = appManager.fileManager.calculateFormattedFileValue(this.file, 'line.color');
                    lineColor = this._getColor(calculatedValue);
                } else {
                    lineColor = this._getColor(lineColorTagValue);
                }
            }

            // Parse the line.to tag.
            // It can either be a formula or a handtyped string.
            if (isFormula(lineTo)) {
                let calculatedValue = appManager.fileManager.calculateFileValue(this.file, 'line.to');
                
                if (Array.isArray(calculatedValue)) { 
                    // Array of objects.
                    calculatedValue.forEach((o) => { if (o) { trySetupLine(o.id, lineColor); } });
                } else {
                    // Single object.
                    if (calculatedValue) { trySetupLine(calculatedValue.id, lineColor); }
                }
            } else {
                if (isArray(lineTo)) {
                    // Array of strings.
                    parseArray(lineTo).forEach((s) => { trySetupLine(s, lineColor); });
                } else {
                    // Single string.
                    trySetupLine(lineTo, lineColor);
                }
            }
        }
        
        if (this.arrows) {
            // Filter out lines that are no longer being used.
            this.arrows = this.arrows.filter((a) => {
                if (a && a.targetFile3d) {
                    if (validLineIds && validLineIds.indexOf(a.targetFile3d.file.id) >= 0) {
                        // This line is active, keep it in.
                        return true;
                    }
                }
                // This line is no longer used, filter it out.
                a.dispose();
                return false;
            });
        }
    }

    private _tagUpdateStroke() {
        if (!this.stroke) {
            // Create the stroke mesh
            const geo = this._createStrokeGeometry();
            const material = new LineBasicMaterial({
                color: 0x000000
            });
            
            this.stroke = new LineSegments(geo, material);
            this.cubeContainer.add(this.stroke);
        }

        this.stroke.visible = true;
        const colorValue = appManager.fileManager.calculateFileValue(this.file, 'stroke.color');
        const width:number = appManager.fileManager.calculateFileValue(this.file, 'stroke.width');

        const material = <LineBasicMaterial>this.stroke.material;
        if (typeof colorValue !== 'undefined') {
            material.color = this._getColor(colorValue);
        } else {
            material.color = new Color(0x999999);
        }

        if(typeof width !== 'undefined'){
            material.linewidth = width;
        } else {
            material.linewidth = 1;
        }
    }

    private _updateWorldBubble(): void {
        let cubeBoundingBox = new Box3().setFromObject(this.cube);
        let arrowPoint = new Vector3();
        cubeBoundingBox.getCenter(arrowPoint);

        let size = new Vector3();
        cubeBoundingBox.getSize(size);
        arrowPoint.y += size.y / 2;
        
        this.wordBubble.update(convertToBox2(this.label.boundingBox), arrowPoint);
    }

    private _createStrokeGeometry(): BufferGeometry {
        const geo = new BufferGeometry();

        let verticies: number[][] = [
            [-0.5, -0.5, -0.5], // left  bottom back  - 0
            [ 0.5, -0.5, -0.5], // right bottom back  - 1
            [-0.5,  0.5, -0.5], // left  top    back  - 2
            [ 0.5,  0.5, -0.5], // right top    back  - 3
            [-0.5, -0.5,  0.5], // left  bottom front - 4
            [ 0.5, -0.5,  0.5], // right bottom front - 5
            [-0.5,  0.5,  0.5], // left  top    front - 6
            [ 0.5,  0.5,  0.5], // right top    front - 7
        ];

        const indicies = [
            0,1,
            0,2,
            0,4,

            4,5,
            4,6,

            5,7,
            5,1,

            1,3,

            2,3,
            2,6,

            3,7,

            6,7,
        ];
        const lines: number[] = flatMap(indicies, i => verticies[i]);
        const array = new Float32Array(lines);
        geo.addAttribute('position', new BufferAttribute(array, 3));

        return geo;
    }
}

/**
 * Calculates the scale of the given object. 
 * @param workspaceScale 
 */
export function calculateScale(context: FileCalculationContext, obj: Object, workspaceScale: number): Vector3 {
    const scaleX = calculateNumericalTagValue(context, obj, 'scale.x', 1);
    const scaleY = calculateNumericalTagValue(context, obj, 'scale.y', 1);
    const scaleZ = calculateNumericalTagValue(context, obj, 'scale.z', 1);

    return new Vector3(scaleX * workspaceScale, scaleZ * workspaceScale, scaleY * workspaceScale);
}

/**
 * Calculates the position of the file and returns it.
 * @param file The file.
 * @param scale The workspace scale. Usually calculated from the workspace scale.
 */
export function calculateObjectPositionOnWorkspace(context: FileCalculationContext, file: Object, scale: number): Vector3 {
    const localPosition = calculateGridTileLocalCenter(
        file.tags._position.x, 
        file.tags._position.y, 
        file.tags._position.z,
        scale);
    
    const objectsAtPosition = objectsAtWorkspaceGridPosition(context.objects, file.tags._workspace, file.tags._position);
    const sortedByIndex = sortBy(objectsAtPosition, o => o.tags._index || 0);
    const index = file.tags._index || 0;
    const objectsBelowThis = sortedByIndex.slice(0, index);
    const totalScales = sumBy(objectsBelowThis, obj => calculateNumericalTagValue(context, obj, 'scale.z', 1));

    const indexOffset = new Vector3(0, totalScales * scale, 0);
    localPosition.add(indexOffset);
    return localPosition;
}

/**
 * 
 * @param context The file calculation context to use to calculate forumula values.
 * @param file The file to calculate position for.
 * @param contextId The id of the context we want to get positional data for the given file.
 */
export function calculateObjectPositionInContext(context: FileCalculationContext, file: Object, contextId: string): Vector3 {
    let posX = calculateNumericalTagValue(context, file, contextId + '.x', 0);
    let posY = calculateNumericalTagValue(context, file, contextId + '.y', 0);
    let posZ = calculateNumericalTagValue(context, file, contextId + '.z', 0);

    // We need to flip the y position to match the way the coordinates on workspaces in AUX Builder work.
    posY = -posY;

    return new Vector3(posX, posZ, posY);
}