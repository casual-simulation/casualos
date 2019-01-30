import { Object3D, Mesh, BoxBufferGeometry, MeshStandardMaterial, Color, Vector3 } from "three";
import { Object, File, DEFAULT_WORKSPACE_SCALE, DEFAULT_WORKSPACE_GRID_SCALE } from 'common/Files';
import { GameObject } from "./GameObject";
import GameView from '../GameView/GameView';
import { calculateGridTileLocalCenter } from "./grid/Grid";
import { Text3D } from "./Text3D";
import robotoFont from '../public/bmfonts/Roboto.json';
import robotoTexturePath from '../public/bmfonts/Roboto.png';
import { File3D } from "./File3D";
import { ArgEvent } from '../../common/Events';
import { Arrow3D } from "./Arrow3D";
import { find } from "lodash";
import { isArray, parseArray, isFormula, getShortId, fileFromShortId } from '../../common/Files/FileCalculations'
import { appManager } from '../AppManager';

/**
 * Defines a class that represents a mesh for an "object" file.
 */
export class FileMesh extends GameObject {

    private _gameView: GameView;

    /**
     * The data for the mesh.
     */
    file: Object;

    /**
     * The cube that acts as the visual representation of the file.
     */
    cube: Mesh;

    /**
     * The optional label for the file.
     */
    label: Text3D;

    /**
     * The optional arrows for the file.
     */
    arrows: Arrow3D[];

    /**
     * Event that is fired when this file mesh is updated.
     */
    public onUpdated: ArgEvent<FileMesh> = new ArgEvent<FileMesh>();

    constructor(gameView: GameView) {
        super();
        this._gameView = gameView;
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
        if (file && file.type !== 'object') {
            return;
        }
        if (!this.file) {
            this.cube = this._createCube(1);
            this.label = this._createLabel();
            this.colliders.push(this.cube);
            this.add(this.cube);
        }
        this.file = (<Object>file) || this.file;

        // visible if not destroyed, has a position, and not hidden
        this.visible = (!this.file.tags._destroyed && !!this.file.tags._position && !this.file.tags._hidden);

        // Tag: _position
        this._tagUpdatePosition();

        // Tag: color
        this._tagUpdateColor();

        // Tag: label
        this._tagUpdateLabel();

        // Tag: line
        this._tagUpdateLine();

        this.onUpdated.invoke(this);
    }

    private _calculateScale(workspace: File3D): number {
        if(workspace && workspace.file.type === 'workspace') {
            const scale = workspace.file.scale || DEFAULT_WORKSPACE_SCALE;
            const gridScale = workspace.file.gridScale || DEFAULT_WORKSPACE_GRID_SCALE;
            return scale * gridScale;
        } else {
            return DEFAULT_WORKSPACE_SCALE * DEFAULT_WORKSPACE_GRID_SCALE;
        }
    }

    private _getColor(color: string): Color {
        return new Color(color);
    }

    private _createCube(size: number): Mesh {
        var geometry = new BoxBufferGeometry(size, size, size);
        var material = new MeshStandardMaterial({
            color: 0x00ff00,
            metalness: .1,
            roughness: 0.6
        });
        const cube = new Mesh(geometry, material);
        cube.castShadow = true;
        cube.receiveShadow = false;
        return cube;
    }

    private _createLabel(): Text3D {
        const label = new Text3D(this._gameView, this, robotoFont, robotoTexturePath);
        return label;
    }

    private _tagUpdatePosition(): void {
        
        const workspace = this._gameView.getFile(this.file.tags._workspace);
        const scale = this._calculateScale(workspace);
        if (workspace && workspace.file.type === 'workspace') {
            this.parent = workspace.mesh;
            this.cube.scale.set(scale, scale, scale);
            this.cube.position.set(0, scale / 2, 0);
        } else {
            this.parent = null;
            this.cube.scale.set(1, 1, 1);
            this.cube.position.set(0, 0, 0);
        }

        if (this.file.tags._position && workspace && workspace.file.type === 'workspace') {
            const localPosition = calculateObjectPosition(
                this.file,
                scale
            );
            
            this.position.set(
                localPosition.x,
                localPosition.y,
                localPosition.z);
        } else {
            // Default position
            this.position.set(0, 1, 0);
        }
    }

    private _tagUpdateColor(): void {
        if (this.file.tags.color) {
            const material = <MeshStandardMaterial>this.cube.material;
            material.color = this._getColor(this.file.tags.color);
        } else {
            const material = <MeshStandardMaterial>this.cube.material;
            material.color = new Color(0x00FF00);
        }
    }

    private _tagUpdateLabel(): void {
        if (this.file.tags.label) {
            this.label.setText(this.file.tags.label);
            this.label.setPositionForObject(this.cube);

            if (this.file.tags['label.color']) {
                this.label.setColor(this._getColor(this.file.tags['label.color']));
            }
        } else {
            this.label.setText("");
        }
    }

    private _tagUpdateLine(): void {

        var lineTo = this.file.tags['line.to'];
        var validLineIds: string[];

        if (lineTo) {

            var files: Object[];
            validLineIds = [];

            // Local function for setting up a line. Will add the targetFileId to the validLineIds array if successful.
            var trySetupLine = (targetFileId: string, color?: Color): void => {
                
                // Undefined target filed id.
                if (!targetFileId) return;
                // Can't create line to self.
                if (this.file.id === targetFileId) return;
                
                var targetFile = this._gameView.getFile(targetFileId);
                if (!targetFile) {

                    // If not matching file is found on first try then it may be a short id.
                    // Lets try searching for it.

                    if (!files) {
                        // Init the searchable files list from file manager.
                        files = appManager.fileManager.objects;
                    }

                    var file = fileFromShortId(files, targetFileId);
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

                var targetArrow: Arrow3D = find(this.arrows, (a: Arrow3D) => { return a.targetFile === targetFile });
                if (!targetArrow) {
                    // Create arrow for target.
                    var sourceFile = this._gameView.getFile(this.file.id);
                    targetArrow = new Arrow3D(this._gameView, this, sourceFile, targetFile);
                    this.arrows.push(targetArrow);
                    console.log("create arrow");
                }

                if (targetArrow) {
                    targetArrow.setColor(color);
                    targetArrow.update();
                    console.log("add target file id " + getShortId(targetFile.file) + " to valid line ids list.");
                    // Add the target file id to the valid ids list.
                    validLineIds.push(targetFile.file.id);
                }
            }

            console.log(lineTo);
            var lineColor = this._getColor(this.file.tags['line.color']);

            // Parse the line.to tag.
            // It can either be a formula or a handtyped string.
            if (isFormula(lineTo)) {
                console.log("is formula");
                var calculatedValue = appManager.fileManager.calculateFileValue(this.file, 'line.to');
                console.log("calculated values:");
                console.log(calculatedValue);
                
                if (Array.isArray(calculatedValue)) { 
                    // Array of objects.
                    console.log("is array of objects");
                    calculatedValue.forEach((o) => {
                        if (o) {
                            trySetupLine(o.id, lineColor);
                        }
                    });
                } else {
                    // Single object.
                    console.log("is single object");
                    if (calculatedValue) {
                        trySetupLine(calculatedValue.id, lineColor);
                    }
                }
            } else {
                if (isArray(lineTo)) {
                    // Array of strings.
                    console.log("line.to is string array");
                    var array = parseArray(lineTo);
                    array.forEach((s) => {
                        console.log("try setup " + s);
                        trySetupLine(s, lineColor);
                    });
                } else {
                    // Single string.
                    console.log("line.to is string single");
                    trySetupLine(lineTo, lineColor);
                }
            }
        }
        
        if (this.arrows) {
            // Filter out lines that are no longer being used.
            this.arrows = this.arrows.filter((a) => {
                if (a && a.targetFile) {
                    if (validLineIds && validLineIds.indexOf(a.targetFile.file.id) >= 0) {
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
}

/**
 * Calculates the position of the file and returns it.
 * @param file The file.
 * @param scale The fiel scale. Usually calculated from the workspace scale.
 */
export function calculateObjectPosition(file: Object, scale: number) {
    const localPosition = calculateGridTileLocalCenter(
        file.tags._position.x, 
        file.tags._position.y, 
        file.tags._position.z,
        scale);
    const index = file.tags._index || 0;
    const indexOffset = new Vector3(0, index * scale, 0);
    localPosition.add(indexOffset);
    return localPosition;
}