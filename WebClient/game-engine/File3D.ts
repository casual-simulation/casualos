import {
    Math as ThreeMath,
    Mesh,
    Group,
    BoxBufferGeometry,
    MeshStandardMaterial,
    LineBasicMaterial,
    Object3D,
    TextureLoader,
    DoubleSide,
    MeshBasicMaterial,
    Color
} from "three";

import { File, Object, Workspace } from '../../common/Files'
import { Text3D } from './Text3D';
import { vg } from "von-grid";

// Assets
import robotoFont from '../public/bmfonts/Roboto.json';
import robotoTexturePath from '../public/bmfonts/Roboto.png';
import GameView from "WebClient/GameView/GameView";

/**
 * Defines an object that groups Three.js related information
 * with the object/workspace data that they represent.
 */
export class File3D {

    /**
     * The file (workspace or object) that this object represents.
     */
    public file: File;

    /**
     * The 3D mesh that represents the file.
     */
    public mesh: Mesh | Group;

    /**
     * The 3d text label for the file.
     */
    public label: Text3D;

    /**
     * The optional surface used for workspaces.
     * Surfaces are simply the special decoration that a workspace displays so that 
     * objects appear to be placed on them. Their only use is for visuals.
     */
    public surface: vg.Board | null;

    /**
     * The grid that is used to position objects on top of workspaces.
     * Grids are only visible while the user is dragging an object.
     */
    public grid: vg.Board | null;

    /**
     * The GameView that manages this file3d.
     */
    private _gameView: GameView;

    /**
     * Defines an object that groups Three.js related information
     * with the object/workspace data that they represent.
     * @param gameView The game view that manages this file3d.
     * @param file The file that this file3d represents.
     */
    constructor(gameView: GameView, file: File) {
        this.file = file;
        this._gameView = gameView;

        if (file.type === 'object') {

            this.mesh = this._createCube(0.2);
            this.surface = null;
            this.grid = null;

        } else {

            const surface = this._createWorkSurface(file);
            this.mesh = surface.board.group;
            this.grid = surface.sqrBoard;
            this.surface = surface.board;

        }

        this.mesh.name = `${file.type}_${file.id}`;
        this.label = new Text3D(this._gameView, this.mesh, robotoFont, robotoTexturePath);

        // Add this file3d's mesh to scene so that it and all its childre get rendered.
        this._gameView.scene.add(this.mesh);

        if (this.grid) {
            this.grid.group.name = `grid_${file.type}_${file.id}`;
        }
    }

    public generateTilemap(board: vg.Board, data: Workspace) {
        board.generateTilemap({
            extrudeSettings: {
                bevelEnabled: true,
                steps: 1,
                bevelSize: 0.015,
                bevelThickness: 0.00
            },
            material: new MeshStandardMaterial({
                color: 0x999999,
                roughness: .7,
            })
        });

        board.group.children[0].children.forEach(c => {
            c.castShadow = true;
            c.receiveShadow = true;
        });

        board.group.position.x = data.position.x;
        board.group.position.y = data.position.y + 0.4;
        board.group.position.z = data.position.z;
    }

    /**
     * Update the file that this file3d represents.
     * @param file The file data that this file3d represents.
     */
    public updateFile(file: File) {
        this.file = file;

        if (file.type === 'object') {
            this._updateObject();
        } else {
            this._updateWorkspace();
        }
    }

    private _updateObject() {

        const data = <Object>this.file;

        // visible if not destroyed, has a position, and not hidden
        this.mesh.visible = (!data.tags._destroyed && !!data.tags._position && !data.tags._hidden);
        const workspace = this._gameView.getFile(data.tags._workspace);
        this.file = data;
        if (workspace) {
            this.mesh.parent = workspace.mesh;
        } else {
            this.mesh.parent = null;
        }

        // Tag: color
        if (data.tags.color) {
            const mesh = <Mesh>this.mesh;
            const material = <MeshStandardMaterial>mesh.material;
            material.color = new Color(data.tags.color);
        } else {
            const mesh = <Mesh>this.mesh;
            const material = <MeshStandardMaterial>mesh.material;
            material.color = new Color(0x00FF00);
        }
        
        // Tag: label
        if (data.tags.label) {
            this.label.setText(data.tags.label);
        } else {
            this.label.setText("");
        }

        // Tag: position
        if (data.tags._position) {
            this.mesh.position.set(
                data.tags._position.x + 0,
                data.tags._position.y + 0.095,
                data.tags._position.z + 0);
        } else {
            // Default position
            this.mesh.position.set(0, 1, 0);
        }

    }

    private _updateWorkspace() {

        const data = <Workspace>this.file;

        this.mesh.position.x = this.grid.group.position.x = data.position.x || 0;
        this.mesh.position.y = this.grid.group.position.y = data.position.y || 0;
        this.mesh.position.z = this.grid.group.position.z = data.position.z || 0;

        if (typeof data.size !== 'undefined' && this.surface.grid.size !== data.size) {
            this.surface.grid.cells = {};
            this.surface.grid.numCells = 0;
            this.surface.grid.generate({
                size: data.size || 0
            });
            this.generateTilemap(this.surface, data);
            this.surface.group.position.y -= .4;
        }

        this.grid.group.position.y -= .45;
        this.grid.group.updateMatrixWorld(false);
    }

    /**
     * Call dispose allow this object to clean itself up when being removed.
     */
    public dispose(): void {
        this._gameView.scene.remove(this.mesh);
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

    private _createWorkSurface(data: Workspace) {
        const grid = new vg.HexGrid({
            cellSize: .3,
            cellHeight: 0.5
        });
        grid.generate({
            size: data.size || 0
        });

        const board = new vg.Board(grid);
        this.generateTilemap(board, data);

        const sqrGrid = new vg.SqrGrid({
            size: 14,
            cellSize: .12
        });

        const sqrBoard = new vg.Board(sqrGrid);
        const mat = new LineBasicMaterial({
            color: 0xFFFFFF,
            opacity: 1
        });

        sqrBoard.generateOverlay(18, mat);

        sqrBoard.group.position.x = data.position.x;
        sqrBoard.group.position.y = data.position.y;
        sqrBoard.group.position.z = data.position.z;

        return { board, sqrBoard };
    }
}