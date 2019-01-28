import { Object3D, Mesh, BoxBufferGeometry, MeshStandardMaterial, Color, Vector3 } from "three";
import { Object, File, DEFAULT_WORKSPACE_SCALE, DEFAULT_WORKSPACE_GRID_SCALE } from 'common/Files';
import { GameObject } from "./GameObject";
import GameView from '../GameView/GameView';
import { calculateGridTileLocalCenter } from "./grid/Grid";
import { WorkspaceMesh } from "./WorkspaceMesh";
import { Text3D } from "./Text3D";
import robotoFont from '../public/bmfonts/Roboto.json';
import robotoTexturePath from '../public/bmfonts/Roboto.png';
import { File3D } from "./File3D";

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

        // Tag: color
        if (this.file.tags.color) {
            const mesh = <Mesh>this.cube;
            const material = <MeshStandardMaterial>mesh.material;
            material.color = this._getColor(this.file.tags.color);
        } else {
            const mesh = <Mesh>this.cube;
            const material = <MeshStandardMaterial>mesh.material;
            material.color = new Color(0x00FF00);
        }

        // Tag: label
        if (this.file.tags.label) {
            this.label.setText(this.file.tags.label);
            this.label.setPositionForObject(this.cube);
        } else {
            this.label.setText("");
        }

        // Tag: _position
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

    private _calculateScale(workspace: File3D) {
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

    private _createLabel() {
        const label = new Text3D(this._gameView, this, robotoFont, robotoTexturePath);
        return label;
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